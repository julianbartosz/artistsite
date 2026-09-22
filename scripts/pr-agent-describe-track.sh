#!/usr/bin/env bash
# Track which PR head SHA last received an auto/manual describe, and decide
# whether a one-shot merge describe is needed (pushes after open/ready, no
# synchronize refresh).
#
# Env: GH_TOKEN or GITHUB_TOKEN, GITHUB_REPOSITORY
#
# Usage:
#   pr-agent-describe-track.sh --needs-merge-describe <pr_number> <head_sha>
#   pr-agent-describe-track.sh --record-head <pr_number> <head_sha>
#   pr-agent-describe-track.sh --self-test
set -euo pipefail

die() {
  echo "pr-agent-describe-track: $*" >&2
  exit 2
}

_python() {
  python3 - "$@" <<'PY'
import json
import os
import re
import sys
import urllib.error
import urllib.request

MARKER_PREFIX = "<!-- pr-agent-described-head:"
MARKER_SUFFIX = " -->"
MARKER_RE = re.compile(r"<!-- pr-agent-described-head:([0-9a-f]{40}) -->")
COMMENTS_PAGE_SIZE = 100
COMMENTS_PAGE_CAP = 50


def die(msg: str) -> None:
    print(f"pr-agent-describe-track: {msg}", file=sys.stderr)
    raise SystemExit(2)


def token() -> str:
    value = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    if not value:
        die("GH_TOKEN is required")
    return value


def repo() -> str:
    value = os.environ.get("GITHUB_REPOSITORY") or ""
    if not value:
        die("GITHUB_REPOSITORY is required")
    return value


def gh_api(method: str, path: str, payload: dict | None = None):
    url = f"https://api.github.com/repos/{repo()}{path}"
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {token()}")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as exc:
        die(f"GitHub API {method} {path} failed: {exc.code} {exc.read().decode()[:400]}")
    return json.loads(raw) if raw else None


def issue_comments(pr_number: str) -> list:
    items: list = []
    page = 1
    while page <= COMMENTS_PAGE_CAP:
        batch = gh_api(
            "GET",
            f"/issues/{pr_number}/comments?per_page={COMMENTS_PAGE_SIZE}&page={page}",
        )
        if not isinstance(batch, list):
            die("unexpected comments payload")
        items.extend(batch)
        if len(batch) < COMMENTS_PAGE_SIZE:
            return items
        page += 1
    die(f"comment pagination exceeded {COMMENTS_PAGE_CAP} pages")
    return items


def is_track_comment(comment: dict) -> bool:
    body = comment.get("body") or ""
    if MARKER_PREFIX not in body:
        return False
    user = comment.get("user") or {}
    user_type = user.get("type") or ""
    login = (user.get("login") or "").lower()
    return user_type == "Bot" or login.endswith("[bot]")


def described_head(comments: list) -> str | None:
    found = None
    for comment in comments:
        if not is_track_comment(comment):
            continue
        match = MARKER_RE.search(comment.get("body") or "")
        if match:
            found = match.group(1)
    return found


def find_track_comment(comments: list) -> dict | None:
    found = None
    for comment in comments:
        if is_track_comment(comment):
            found = comment
    return found


def needs_merge_describe(pr_number: str, head_sha: str) -> None:
    if len(head_sha) != 40:
        die("head_sha must be a 40-char commit SHA")
    comments = issue_comments(pr_number)
    recorded = described_head(comments)
    if recorded == head_sha:
        print(f"pr-agent-describe-track: head {head_sha[:7]} already described — skip merge describe")
        raise SystemExit(1)
    if recorded:
        print(
            f"pr-agent-describe-track: head {head_sha[:7]} differs from described "
            f"{recorded[:7]} — merge describe needed"
        )
    else:
        print("pr-agent-describe-track: no described-head marker — merge describe needed")
    raise SystemExit(0)


def record_head(pr_number: str, head_sha: str) -> None:
    if len(head_sha) != 40:
        die("head_sha must be a 40-char commit SHA")
    body = f"{MARKER_PREFIX}{head_sha}{MARKER_SUFFIX}\n"
    comments = issue_comments(pr_number)
    existing = find_track_comment(comments)
    if existing is None:
        gh_api("POST", f"/issues/{pr_number}/comments", {"body": body})
        print(f"pr-agent-describe-track: recorded described head {head_sha[:7]}")
        return
    gh_api("PATCH", f"/issues/comments/{existing['id']}", {"body": body})
    print(f"pr-agent-describe-track: updated described head {head_sha[:7]}")


def self_test() -> None:
    failed = 0

    def check(name: str, cond: bool) -> None:
        nonlocal failed
        if cond:
            print(f"OK: {name}")
        else:
            print(f"FAIL: {name}", file=sys.stderr)
            failed = 1

    sample = "<!-- pr-agent-described-head:abc123def4567890123456789012345678901234 -->"
    match = MARKER_RE.search(sample)
    check("marker parse", match and match.group(1).startswith("abc123"))
    check(
        "bot track comment",
        is_track_comment(
            {
                "body": sample,
                "user": {"login": "github-actions[bot]", "type": "Bot"},
            }
        ),
    )
    check(
        "skip human comment",
        not is_track_comment(
            {
                "body": sample,
                "user": {"login": "alice", "type": "User"},
            }
        ),
    )
    comments = [
        {
            "id": 1,
            "body": "<!-- pr-agent-described-head:aaa0000000000000000000000000000000000001 -->",
            "user": {"type": "Bot"},
        },
        {
            "id": 2,
            "body": "<!-- pr-agent-described-head:bbb0000000000000000000000000000000000002 -->",
            "user": {"type": "Bot"},
        },
    ]
    check("latest described head", described_head(comments) == "bbb0000000000000000000000000000000000002")

    if failed:
        raise SystemExit(1)
    print("pr-agent-describe-track.sh self-test OK")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "--self-test":
        self_test()
    elif cmd == "--needs-merge-describe":
        if len(sys.argv) != 4:
            die("usage: pr-agent-describe-track.sh --needs-merge-describe <pr_number> <head_sha>")
        needs_merge_describe(sys.argv[2], sys.argv[3])
    elif cmd == "--record-head":
        if len(sys.argv) != 4:
            die("usage: pr-agent-describe-track.sh --record-head <pr_number> <head_sha>")
        record_head(sys.argv[2], sys.argv[3])
    else:
        die("usage: pr-agent-describe-track.sh --self-test | --needs-merge-describe | --record-head")
PY
}

case "${1:-}" in
  --self-test)
    _python --self-test
    ;;
  --needs-merge-describe)
    _python --needs-merge-describe "${2:-}" "${3:-}"
    ;;
  --record-head)
    _python --record-head "${2:-}" "${3:-}"
    ;;
  -h|--help)
    sed -n '1,12p' "$0"
    ;;
  *)
    die "usage: $0 --self-test | --needs-merge-describe <pr> <sha> | --record-head <pr> <sha>"
    ;;
esac
