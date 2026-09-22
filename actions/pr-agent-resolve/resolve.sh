#!/usr/bin/env bash
# Resolve PR Agent auto flags from event + profile.
# Caller scripts (describe-track) stay in the consumer checkout (C5).
set -euo pipefail

die() { echo "pr-agent-resolve: $*" >&2; exit 2; }

PROFILES="minimal standard full"

_profile_ok() {
  local p="$1" cand
  for cand in $PROFILES; do
    [[ "$cand" == "$p" ]] && return 0
  done
  return 1
}

_emit() {
  local file="${GITHUB_OUTPUT:?GITHUB_OUTPUT required}"
  printf '%s\n' \
    "auto_review=${auto_review}" \
    "auto_describe=${auto_describe}" \
    "auto_improve=${auto_improve}" \
    "annotate=${annotate}" \
    "oneshot_label=${oneshot_label}" \
    "run_pragent=${run_pragent}" \
    "base_sha=${base_sha}" \
    "head_sha=${head_sha}" \
    "author=${author}" \
    "number=${number}" \
    "same_repo=${same_repo}" \
    >> "$file"
}

_fill_from_pr_json() {
  python3 - <<'PY'
import json, os, sys
pr = json.loads(os.environ["PR_JSON"])
head_repo = ((pr.get("head") or {}).get("repo") or {}).get("full_name") or ""
same = "true" if head_repo == os.environ["GITHUB_REPOSITORY"] else "false"
sys.stdout.write(
    f"base_sha={pr['base']['sha']}\n"
    f"head_sha={pr['head']['sha']}\n"
    f"author={pr['user']['login']}\n"
    f"number={pr['number']}\n"
    f"same_repo={same}\n"
)
PY
}

_resolve_describe_tracker() {
  local override="${1:-}" here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -n "${override//[[:space:]]/}" && -f "$override" ]]; then
    printf '%s\n' "$override"
    return 0
  fi
  printf '%s\n' "${here}/../../scripts/pr-agent-describe-track.sh"
}

resolve() {
  local profile="${PROFILE:-}"
  _profile_ok "$profile" || die "unknown profile ${profile:-<empty>} (expected: ${PROFILES})"

  auto_review=false
  auto_describe=false
  auto_improve=false
  annotate=false
  oneshot_label=
  run_pragent=false
  base_sha=
  head_sha=
  author=
  number="${PR_NUMBER:-}"
  same_repo=false

  local event="${EVENT_NAME:-}"
  local action="${EVENT_ACTION:-}"
  local label="${LABEL_NAME:-}"
  local comment="${COMMENT_BODY:-}"
  local track
  track="$(_resolve_describe_tracker "${DESCRIBE_TRACK_SCRIPT:-}")"

  if [[ "$event" == "pull_request" ]]; then
    case "$action" in
      opened|reopened|ready_for_review)
        auto_review=true
        auto_describe=true
        auto_improve=true
        annotate=true
        run_pragent=true
        ;;
      labeled)
        if [[ "$profile" != "minimal" ]]; then
          run_pragent=true
          if [[ "$label" == "pr-agent:run" ]]; then
            auto_review=true
            auto_improve=true
            annotate=true
            oneshot_label="pr-agent:run"
          elif [[ "$label" == "pr-agent:improve" ]]; then
            auto_improve=true
            annotate=true
            oneshot_label="pr-agent:improve"
          elif [[ "$label" == "pr-agent:describe" ]]; then
            auto_describe=true
            oneshot_label="pr-agent:describe"
          else
            run_pragent=false
          fi
        fi
        ;;
      closed)
        if [[ "$profile" != "minimal" && "${PR_MERGED:-}" == "true" && -n "${number}" && -n "${PR_HEAD:-}" ]]; then
          if [[ -f "$track" ]]; then
            if bash "$track" --needs-merge-describe "$number" "${PR_HEAD}"; then
              auto_describe=true
              run_pragent=true
            fi
          fi
        fi
        ;;
    esac
  elif [[ "$event" == "issue_comment" ]]; then
    run_pragent=true
    if [[ "$comment" == *"/improve"* ]]; then
      annotate=true
    fi
  elif [[ "$event" == "workflow_dispatch" ]]; then
    run_pragent=true
  fi

  if [[ -n "${PR_HEAD:-}" ]]; then
    if [[ "${HEAD_REPO:-}" == "${GITHUB_REPOSITORY:-}" ]]; then
      same_repo=true
    fi
    base_sha="${PR_BASE:-}"
    head_sha="${PR_HEAD}"
    author="${PR_AUTHOR:-}"
    number="${PR_NUMBER:-}"
    _emit
    return 0
  fi

  if [[ -z "$number" ]]; then
    same_repo=false
    echo "PR Agent dispatch without a pull request — skipping contacts"
    _emit
    return 0
  fi

  if [[ -z "${PR_JSON:-}" ]]; then
    PR_JSON="$(gh api "repos/${GITHUB_REPOSITORY}/pulls/${number}")"
    export PR_JSON
  fi
  local parsed
  parsed="$(_fill_from_pr_json)"
  base_sha="$(printf '%s\n' "$parsed" | awk -F= '/^base_sha=/{print substr($0,10); exit}')"
  head_sha="$(printf '%s\n' "$parsed" | awk -F= '/^head_sha=/{print substr($0,10); exit}')"
  author="$(printf '%s\n' "$parsed" | awk -F= '/^author=/{print substr($0,8); exit}')"
  number="$(printf '%s\n' "$parsed" | awk -F= '/^number=/{print substr($0,8); exit}')"
  same_repo="$(printf '%s\n' "$parsed" | awk -F= '/^same_repo=/{print substr($0,11); exit}')"
  _emit
}

_read_out() {
  awk -F= -v key="$1" '$0 ~ "^" key "=" { print substr($0, length(key)+2); exit }' "$2"
}

_run_self_test() {
  local failed=0 tmp
  tmp="$(mktemp)"
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  _check() {
    local name="$1" want_run="$2" want_review="$3"
    : >"$tmp"
    set +e
    GITHUB_OUTPUT="$tmp" GITHUB_REPOSITORY=Gen-AI-Partners/example \
      bash "$HERE/resolve.sh"
    local rc=$?
    set -e
    local got_run got_review
    got_run="$(_read_out run_pragent "$tmp")"
    got_review="$(_read_out auto_review "$tmp")"
    if [[ "$rc" -eq 0 && "$got_run" == "$want_run" && "$got_review" == "$want_review" ]]; then
      echo "OK: $name"
    else
      echo "FAIL: $name (rc=$rc run=${got_run} review=${got_review} want ${want_run}/${want_review})" >&2
      cat "$tmp" >&2 || true
      failed=1
    fi
  }

  set +e
  PROFILE=bogus EVENT_NAME=workflow_dispatch PR_HEAD='' PR_NUMBER='' \
    GITHUB_OUTPUT="$tmp" bash "$HERE/resolve.sh"
  local rc=$?
  set -e
  if [[ "$rc" -ge 2 ]]; then
    echo "OK: unknown profile fail-closed"
  else
    echo "FAIL: unknown profile should exit 2 (rc=$rc)" >&2
    failed=1
  fi

  PROFILE=minimal EVENT_NAME=pull_request EVENT_ACTION=opened \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=1 HEAD_REPO=Gen-AI-Partners/example \
    _check "minimal opened runs" true true

  PROFILE=minimal EVENT_NAME=pull_request EVENT_ACTION=labeled LABEL_NAME=pr-agent:run \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=1 HEAD_REPO=Gen-AI-Partners/example \
    _check "minimal labeled ignored" false false

  PROFILE=full EVENT_NAME=pull_request EVENT_ACTION=labeled LABEL_NAME=pr-agent:run \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=1 HEAD_REPO=Gen-AI-Partners/example \
    _check "full labeled run" true true

  PROFILE=full EVENT_NAME=pull_request EVENT_ACTION=labeled LABEL_NAME=unrelated \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=1 HEAD_REPO=Gen-AI-Partners/example \
    _check "full unrelated label ignored" false false

  PROFILE=minimal EVENT_NAME=pull_request EVENT_ACTION=closed PR_MERGED=true \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=1 HEAD_REPO=Gen-AI-Partners/example \
    _check "minimal closed ignored" false false

  PROFILE=full EVENT_NAME=issue_comment COMMENT_BODY="/review please" \
    PR_HEAD='' PR_NUMBER='' \
    _check "dispatch-less issue_comment still flags run" true false

  PROFILE=standard EVENT_NAME=workflow_dispatch PR_HEAD='' PR_NUMBER='' \
    _check "workflow_dispatch runs" true false

  local mock
  mock="$(mktemp)"
  printf '%s\n' '#!/bin/sh' 'exit 0' >"$mock"
  chmod +x "$mock"
  PROFILE=full EVENT_NAME=pull_request EVENT_ACTION=closed PR_MERGED=true \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=9 HEAD_REPO=Gen-AI-Partners/example \
    DESCRIBE_TRACK_SCRIPT="$mock" \
    _check "full merge-describe when tracker says yes" true false
  rm -f "$mock"

  printf '%s\n' '#!/bin/sh' 'exit 1' >"$mock"
  chmod +x "$mock"
  PROFILE=full EVENT_NAME=pull_request EVENT_ACTION=closed PR_MERGED=true \
    PR_BASE=b PR_HEAD=h PR_AUTHOR=a PR_NUMBER=9 HEAD_REPO=Gen-AI-Partners/example \
    DESCRIBE_TRACK_SCRIPT="$mock" \
    _check "full merge-describe skip when tracker says no" false false
  rm -f "$mock"

  local bundled expected_bundled
  bundled="$(_resolve_describe_tracker "")"
  expected_bundled="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../scripts/pr-agent-describe-track.sh"
  if [[ "$bundled" == "$expected_bundled" && -f "$bundled" ]] &&
    bash "$bundled" --self-test; then
    echo "OK: empty merge-describe override selects executable bundled tracker"
  else
    echo "FAIL: empty merge-describe override selected ${bundled}" >&2
    failed=1
  fi

  rm -f "$tmp"

  [[ "$failed" -eq 0 ]] || die "self-test failed"
  echo "pr-agent-resolve self-test OK"
}

case "${1:-}" in
  --self-test) _run_self_test ;;
  -h|--help) sed -n '1,3p' "$0" ;;
  "") resolve ;;
  *) die "unknown argument: $1" ;;
esac
