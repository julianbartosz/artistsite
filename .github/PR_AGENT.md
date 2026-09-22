# PR Agent

ArtistSite uses [Qodo PR-Agent](https://github.com/qodo-ai/pr-agent) for automated pull request review, description, and improvement suggestions.

**Workflow:** [`.github/workflows/pr-agent.yml`](workflows/pr-agent.yml)  
**Config:** [`.pr_agent.toml`](../.pr_agent.toml) (default branch)  
**Pinned release:** **v0.39.0** (commit SHA in the workflow — not `@main`)

Behavior matches the platform **full** profile: label triggers, merge-describe tracking, and prior-author blame annotation. Implementation is vendored under `actions/pr-agent-*` and `scripts/pr-agent-*.sh` (this repo is isolated from the shared workflows platform).

## When it runs

| Trigger | Behavior |
|---------|----------|
| PR opened, reopened, or ready for review (non-draft, same-repo) | Auto review + describe + improve |
| PR synchronize (push to open PR) | Auto review; describe when head differs from last described SHA |
| Label `pr-agent:run` / `pr-agent:improve` / `pr-agent:describe` | One-shot re-run (label removed after success) |
| PR merged | Merge-describe if head changed since last described SHA |
| PR comment from member / owner / collaborator | Runs for `/review`, `/describe`, `/improve`, `/ask`, `/help`, `/reflect` |
| Actions → **PR Agent** → Run workflow | Manual `workflow_dispatch` |
| Label `pr-agent:skip` | Opt out of automatic PR events |

Bot senders are ignored. Fork PRs are ignored for automated pull_request events.

## Slash commands

| Command | What it does |
|---------|----------------|
| `/review` | Code review of the PR diff |
| `/describe` | Suggest / update PR title and description |
| `/improve` | Code improvement suggestions |
| `/ask <question>` | Ask a question about the PR |
| `/help` | List available commands |
| `/reflect` | Reflection / feedback on the review |

## Secrets and permissions

- **`OPENAI_API_KEY`** — required repository Actions secret (mapped to `OPENAI_KEY` for Qodo)
- **`GITHUB_TOKEN`** — provided by Actions
- Permissions: `contents: read`, `pull-requests: write`, `issues: write`

## Verification

1. Add `OPENAI_API_KEY` under **Settings → Secrets and variables → Actions**.
2. Open a non-draft PR (or add `pr-agent:run`) and confirm the **PR Agent** job succeeds.
3. Optionally comment `/review` on the PR.
4. Locally: `bash actions/pr-agent-resolve/resolve.sh --self-test` (also run in CI quality gates).
