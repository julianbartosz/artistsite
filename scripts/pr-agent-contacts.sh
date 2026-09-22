#!/usr/bin/env bash
# Annotate Qodo "PR Code Suggestions" rows with prior git authors.
#
# Qodo never receives git history. Asking the model for blame invents names.
# This script blames the suggested HEAD line range, drops the PR opener and
# bots, and inserts **Prior author** under each file link in the suggestion cell.
#
# Env (--annotate):
#   BASE_SHA, HEAD_SHA, PR_NUMBER, PR_AUTHOR_LOGIN, GITHUB_REPOSITORY, GH_TOKEN
set -euo pipefail

die() {
  echo "pr-agent-contacts: $*" >&2
  exit 2
}

ROOT="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
[[ -n "$ROOT" ]] || die "cannot resolve repo root (set GITHUB_WORKSPACE)"
cd "$ROOT"

_python() {
  python3 - "$@" <<'PY'
import html
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

AUTHOR_MARKER = "<!-- pr-agent-author -->"
SUGGESTIONS_HEADING = "## PR Code Suggestions"
DIFF_FRAGMENT = "/files#diff-"
MAX_AUTHORS = 4
ANNOTATE_ATTEMPTS = 6
ANNOTATE_RETRY_SECONDS = 5
COMMENTS_PAGE_SIZE = 100
COMMENTS_PAGE_CAP = 50
BOT_LOGINS = frozenset(
    {
        "github-actions[bot]",
        "github-actions",
        "dependabot[bot]",
        "dependabot",
        "renovate[bot]",
        "renovate",
    }
)


def die(msg: str) -> None:
    print(f"pr-agent-contacts: {msg}", file=sys.stderr)
    raise SystemExit(2)


def run_git(args: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        check=check,
        capture_output=True,
        text=True,
    )


def iter_markdown_links(text: str):
    pos = 0
    while True:
        sep = text.find("](", pos)
        if sep < 0:
            return
        url_start = sep + 2
        url_end = text.find(")", url_start)
        if url_end < 0:
            return
        depth = 1
        open_idx = None
        i = sep - 1
        while i >= 0:
            ch = text[i]
            if ch == "]":
                depth += 1
            elif ch == "[":
                depth -= 1
                if depth == 0:
                    open_idx = i
                    break
            i -= 1
        if open_idx is not None:
            yield open_idx, url_end + 1, text[open_idx + 1 : sep], text[url_start:url_end]
        pos = url_end + 1


def parse_range_label(label: str):
    right = label.rfind("]")
    left = label.rfind("[", 0, right)
    if left < 0 or right < 0:
        return None
    inner = label[left + 1 : right]
    path = label[:left].strip()
    if not path or not inner:
        return None
    if "-" in inner:
        start_s, end_s = inner.split("-", 1)
    else:
        start_s = end_s = inner
    if not start_s.isdigit() or not end_s.isdigit():
        return None
    start, end = int(start_s), int(end_s)
    if start <= 0 or end <= 0:
        return None
    if end < start:
        start, end = end, start
    return path, start, end


def safe_repo_path(path: str) -> bool:
    if path.startswith("/") or path.startswith("\\"):
        return False
    return all(part not in ("", ".", "..") for part in path.replace("\\", "/").split("/"))


def github_identity(name: str, mail: str):
    mail = mail.strip().strip("<>").lower()
    name = name.strip()
    if mail.endswith("@users.noreply.github.com"):
        local = mail.split("@", 1)[0]
        login = local.split("+", 1)[1] if "+" in local else local
        if not login:
            return None
        lowered = login.lower()
        if lowered in BOT_LOGINS or lowered.endswith("[bot]"):
            return None
        return ("mention", login)
    if not name:
        return None
    lowered = name.lower()
    if lowered in BOT_LOGINS or "[bot]" in lowered:
        return None
    return ("name", name)


def is_pr_author(identity: tuple[str, str], pr_login: str) -> bool:
    if not pr_login:
        return False
    return identity[1].lower() == pr_login.lower()


def file_exists(rev: str, path: str) -> bool:
    return run_git(["cat-file", "-e", f"{rev}:{path}"], check=False).returncode == 0


def blame_identities(rev: str, path: str, start: int, end: int) -> list[tuple[str, str, str]]:
    proc = run_git(
        [
            "blame",
            "--line-porcelain",
            "-w",
            "-M",
            f"-L{start},{end}",
            rev,
            "--",
            path,
        ],
        check=False,
    )
    if proc.returncode != 0:
        return []
    rows: list[tuple[str, str, str]] = []
    sha = author = mail = ""
    for line in proc.stdout.splitlines():
        if not line:
            continue
        if line[0] in "\t":
            if sha:
                rows.append((sha, author, mail))
            sha = author = mail = ""
            continue
        if " " not in line:
            continue
        key, value = line.split(" ", 1)
        if len(key) == 40 and all(c in "0123456789abcdef" for c in key.lower()):
            sha = key
        elif key == "author":
            author = value
        elif key == "author-mail":
            mail = value
    return rows


def prior_authors(path: str, start: int, end: int, merge_base: str, head: str, pr_login: str) -> str:
    if not safe_repo_path(path):
        return "unknown"
    if not file_exists(head, path):
        return "new file"
    pr_commits = set()
    rev_list = run_git(["rev-list", f"{merge_base}..{head}"], check=False)
    if rev_list.returncode == 0:
        pr_commits = {line.strip() for line in rev_list.stdout.splitlines() if line.strip()}

    rows = blame_identities(head, path, start, end)
    prior_rows = [row for row in rows if row[0] not in pr_commits]
    if not prior_rows and file_exists(merge_base, path):
        prior_rows = blame_identities(merge_base, path, start, end)
    if not rows and not prior_rows:
        return "unknown"
    if not prior_rows:
        return "this PR"

    ordered: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for _sha, author, mail in prior_rows:
        ident = github_identity(author, mail)
        if ident is None or is_pr_author(ident, pr_login) or ident in seen:
            continue
        seen.add(ident)
        ordered.append(ident)
        if len(ordered) >= MAX_AUTHORS:
            break
    if not ordered:
        return "this PR"
    parts = []
    for kind, value in ordered:
        if kind == "mention":
            parts.append(f"@{value}")
        else:
            parts.append(html.escape(value, quote=False))
    return ", ".join(parts)


def strip_existing_authors(body: str) -> str:
    out = []
    i = 0
    while True:
        hit = body.find(AUTHOR_MARKER, i)
        if hit < 0:
            out.append(body[i:])
            break
        out.append(body[i:hit])
        nl = body.find("\n", hit)
        i = len(body) if nl < 0 else nl + 1
    return "".join(out)


def suggestion_targets(body: str):
    for start, end, label, url in iter_markdown_links(body):
        if DIFF_FRAGMENT not in url:
            continue
        parsed = parse_range_label(label)
        if parsed is None:
            continue
        yield start, end, parsed


def annotate_body(body: str, merge_base: str, head: str, pr_login: str) -> str:
    body = strip_existing_authors(body)
    inserts: list[tuple[int, str]] = []
    for _start, end, (path, line_start, line_end) in suggestion_targets(body):
        authors = prior_authors(path, line_start, line_end, merge_base, head, pr_login)
        inserts.append((end, f"\n{AUTHOR_MARKER}**Prior author:** {authors}\n"))
    if not inserts:
        return body
    parts = []
    cursor = 0
    for end, snippet in inserts:
        parts.append(body[cursor:end])
        parts.append(snippet)
        cursor = end
    parts.append(body[cursor:])
    return "".join(parts)


def gh_api(method: str, path: str, payload: dict | None = None):
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    if not token:
        die("GH_TOKEN is required")
    repo = os.environ.get("GITHUB_REPOSITORY") or ""
    if not repo:
        die("GITHUB_REPOSITORY is required")
    url = f"https://api.github.com/repos/{repo}{path}"
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
    except urllib.error.HTTPError as exc:
        die(f"GitHub API {method} {path} failed: {exc.code} {exc.read().decode()[:400]}")
    return json.loads(raw) if raw else None


def is_suggestions_comment(comment: dict) -> bool:
    body = comment.get("body") or ""
    if SUGGESTIONS_HEADING not in body:
        return False
    user = comment.get("user") or {}
    login = user.get("login") or ""
    user_type = user.get("type") or ""
    return user_type == "Bot" or login.endswith("[bot]")


def latest_matching_comment(comments: list) -> dict | None:
    found = None
    for comment in comments:
        if is_suggestions_comment(comment):
            found = comment
    return found


def gh_issue_comments(pr_number: str) -> list:
    items: list = []
    page = 1
    while page <= COMMENTS_PAGE_CAP:
        path = (
            f"/issues/{pr_number}/comments"
            f"?per_page={COMMENTS_PAGE_SIZE}&page={page}"
        )
        batch = gh_api("GET", path)
        if not isinstance(batch, list):
            die("unexpected comments payload")
        items.extend(batch)
        if len(batch) < COMMENTS_PAGE_SIZE:
            return items
        page += 1
    die(f"comment pagination exceeded {COMMENTS_PAGE_CAP} pages")
    return items


def latest_suggestions_comment(pr_number: str):
    for attempt in range(1, ANNOTATE_ATTEMPTS + 1):
        found = latest_matching_comment(gh_issue_comments(pr_number))
        if found is not None:
            return found
        if attempt < ANNOTATE_ATTEMPTS:
            print(
                f"pr-agent-contacts: suggestions comment not visible yet "
                f"(attempt {attempt}/{ANNOTATE_ATTEMPTS})"
            )
            time.sleep(ANNOTATE_RETRY_SECONDS)
    return None


def annotate() -> None:
    base = os.environ.get("BASE_SHA") or ""
    head = os.environ.get("HEAD_SHA") or ""
    pr_number = os.environ.get("PR_NUMBER") or ""
    pr_login = os.environ.get("PR_AUTHOR_LOGIN") or ""
    if not base or not head or not pr_number:
        die("BASE_SHA, HEAD_SHA, and PR_NUMBER are required")
    merge = run_git(["merge-base", base, head], check=False)
    if merge.returncode != 0:
        die(f"merge-base failed: {merge.stderr.strip()}")
    merge_base = merge.stdout.strip()
    comment = latest_suggestions_comment(pr_number)
    if comment is None:
        print("pr-agent-contacts: no PR Code Suggestions comment yet")
        return
    updated = annotate_body(comment.get("body") or "", merge_base, head, pr_login)
    if updated == comment.get("body"):
        print("pr-agent-contacts: no file-range suggestions to annotate")
        return
    gh_api("PATCH", f"/issues/comments/{comment['id']}", {"body": updated})
    print(f"pr-agent-contacts: annotated comment {comment['id']}")


def self_test() -> None:
    failed = 0

    def check(name: str, cond: bool) -> None:
        nonlocal failed
        if cond:
            print(f"OK: {name}")
        else:
            print(f"FAIL: {name}", file=sys.stderr)
            failed = 1

    label = "frontend/src/app.ts [203-229]"
    parsed = parse_range_label(label)
    check("range label", parsed == ("frontend/src/app.ts", 203, 229))
    check("single line", parse_range_label("lib.sh [710]") == ("lib.sh", 710, 710))
    check("reject traversal", not safe_repo_path("../secret"))
    check(
        "noreply plus",
        github_identity("A", "<123+alice@users.noreply.github.com>") == ("mention", "alice"),
    )
    check(
        "skip actions bot",
        github_identity("x", "<41898282+github-actions[bot]@users.noreply.github.com>") is None,
    )
    check("display name", github_identity("Jane Doe", "<jane@example.com>") == ("name", "Jane Doe"))

    body = (
        "## PR Code Suggestions ✨\n"
        "[scripts/lib.sh [2-4]](https://github.com/example/repo/pull/1/files#diff-abcR2-R4)\n"
        "```diff\n+x\n```\n"
    )
    links = list(suggestion_targets(body))
    check("diff link detected", len(links) == 1 and links[0][2][0] == "scripts/lib.sh")
    qodo = (
        "[frontend/src/products/compliance/settings/GoogleWorkspaceRoutingSections.tsx [203-229]]"
        "(https://github.com/Gen-AI-Partners/subatomic_atlas/pull/800/files#diff-"
        "e538918f9f0b2a7269d3ed1816b82034d19e2b0f7436a3ce8d9920ba57b7464eR203-R229)"
    )
    qodo_links = list(suggestion_targets(qodo))
    check(
        "qodo table link",
        len(qodo_links) == 1
        and qodo_links[0][2]
        == (
            "frontend/src/products/compliance/settings/GoogleWorkspaceRoutingSections.tsx",
            203,
            229,
        ),
    )
    check(
        "bot suggestions",
        is_suggestions_comment(
            {
                "body": "## PR Code Suggestions ✨\n",
                "user": {"login": "github-actions[bot]", "type": "Bot"},
            }
        ),
    )
    check(
        "skip human copy",
        not is_suggestions_comment(
            {
                "body": "## PR Code Suggestions ✨\n",
                "user": {"login": "alice", "type": "User"},
            }
        ),
    )
    older = {"id": 1, "body": "## PR Code Suggestions\n", "user": {"type": "Bot"}}
    newer = {"id": 2, "body": "## PR Code Suggestions\n", "user": {"type": "Bot"}}
    check("latest of many", (latest_matching_comment([older, newer]) or {}).get("id") == 2)

    import tempfile
    from pathlib import Path

    tmp = Path(tempfile.mkdtemp(prefix="pr-agent-contacts-"))
    subprocess.run(["git", "init"], cwd=tmp, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "alice"], cwd=tmp, check=True)
    subprocess.run(
        ["git", "config", "user.email", "1+alice@users.noreply.github.com"],
        cwd=tmp,
        check=True,
    )
    target = tmp / "scripts"
    target.mkdir()
    (target / "lib.sh").write_text("one\ntwo\nthree\nfour\n")
    subprocess.run(["git", "add", "scripts/lib.sh"], cwd=tmp, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "base"], cwd=tmp, check=True, capture_output=True)
    base_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=tmp, text=True).strip()
    subprocess.run(["git", "config", "user.name", "bob"], cwd=tmp, check=True)
    subprocess.run(
        ["git", "config", "user.email", "2+bob@users.noreply.github.com"],
        cwd=tmp,
        check=True,
    )
    (target / "lib.sh").write_text("one\ntwo-changed\nthree\nfour\n")
    subprocess.run(["git", "add", "scripts/lib.sh"], cwd=tmp, check=True, capture_output=True)
    subprocess.run(["git", "commit", "-m", "pr"], cwd=tmp, check=True, capture_output=True)
    head_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=tmp, text=True).strip()

    cwd = os.getcwd()
    os.chdir(tmp)
    try:
        merge_base = run_git(["merge-base", base_sha, head_sha]).stdout.strip()
        authors = prior_authors("scripts/lib.sh", 2, 4, merge_base, head_sha, "bob")
        check("blame prior author", authors == "@alice")
        annotated = annotate_body(body, merge_base, head_sha, "bob")
        check("inline marker", AUTHOR_MARKER in annotated and "@alice" in annotated)
        again = annotate_body(annotated, merge_base, head_sha, "bob")
        check("idempotent", again.count(AUTHOR_MARKER) == 1)
        only_pr = prior_authors("scripts/lib.sh", 2, 2, merge_base, head_sha, "alice")
        check("opener excluded", only_pr == "this PR")
    finally:
        os.chdir(cwd)

    if failed:
        raise SystemExit(1)
    print("pr-agent-contacts.sh self-test OK")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "--self-test":
        self_test()
    elif cmd == "--annotate":
        annotate()
    else:
        die("usage: pr-agent-contacts.sh --self-test | --annotate")
PY
}

case "${1:-}" in
  --self-test)
    _python --self-test
    ;;
  --annotate)
    _python --annotate
    ;;
  -h|--help)
    sed -n '1,12p' "$0"
    ;;
  *)
    die "usage: $0 --self-test | --annotate"
    ;;
esac
