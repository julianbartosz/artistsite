# Deployment

Production runs on **Fly.io** (one always-on `shared-cpu-1x` / 1 GB machine in `iad`), **Neon Postgres** (Free plan), and **Azure Blob Storage** for uploads, served at `https://michalelena.art`. Every push to `main` deploys automatically once CI passes.

## How it fits together

- **Image** — `Dockerfile` builds the Next.js standalone server. Nothing is baked in at build time; configuration comes from Fly secrets or Admin → Settings (saved settings win).
- **Migrations** — Fly's `release_command` runs `scripts/release.sh` (`prisma migrate deploy` over the direct Neon connection) before new machines take traffic. A failed migration aborts the deploy and leaves the current release running.
- **Health checks** — Fly polls `/api/health/live`, which never touches the database so Neon can scale to zero. `/api/health` reports database, Stripe, and Mailchimp status.
- **Automations** — cart recovery, scheduled newsletters, social posts, digests, and expired stock holds run inside the server every 30 minutes once an automation secret exists. A database lease prevents overlapping runs (deploys briefly run two machines). Admin → Settings → *Run automations now* triggers a run on demand.
- **Checkout holds** — Stripe Checkout sessions expire after 31 minutes and stock is held slightly longer. Returning from Stripe via *back* or session expiry releases the hold immediately.
- **Canonical host** — `www.` redirects to the `NEXTAUTH_URL` host (or the reverse if the canonical host is `www.`).

## First-time setup

1. **Tools and accounts**
   - `brew install flyctl && fly auth login`
   - `gh auth login` (lets the script store the GitHub deploy token)
   - `az login` (only if the script should create the storage account)
   - Register `michalelena.art`.
   - Create a Neon project in **AWS US East (N. Virginia)**, next to Fly's `iad` region.
   - Stripe account (test mode for UAT) and an SMTP provider.
2. **Configure** — run `npm run fly:setup`. The first run writes `.env.fly` (gitignored); fill in the required values and run it again. The script:
   - verifies both Neon connection strings,
   - creates the Fly app, and the Azure storage account and container if needed,
   - registers the Stripe webhook (`checkout.session.completed`, `checkout.session.expired`),
   - generates `NEXTAUTH_SECRET`, `SETTINGS_ENCRYPTION_KEY`, and `CRON_SECRET` and imports all secrets into Fly,
   - allocates IPs, requests TLS certificates for the apex and `www`, prints the DNS records, and saves `FLY_API_TOKEN` to GitHub.
3. **DNS** — add the printed `A`, `AAAA`, and `www` `CNAME` records at the registrar. `fly certs show michalelena.art` reports when certificates are issued.
4. **Deploy** — `npm run deploy`, or merge to `main`.
5. **Admin account** — sign up at `/auth/signup` with an `ADMIN_EMAILS` address, then work through Admin → Settings until the readiness checklist is green.

Do not run `npm run db:seed` against production; it creates demo accounts and orders.

## Deploying changes

- **Automatic** — merge to `main`. CI runs type-check, lint, unit tests, build, and the security scan, then the `deploy` job runs `flyctl deploy`. Deploys queue rather than cancel each other.
- **Manual** — `npm run deploy`.
- **Rollback** — `fly releases --app michalelena --image` lists previous images; `fly deploy --image <image>` redeploys one. Migrations are forward-only, so roll back code only when the schema is compatible.
- **Logs and access** — `fly logs`, `fly status`, `fly ssh console`.

## Secrets

`.env.fly` is the local record of production configuration. Re-run `npm run fly:setup` after editing it; running machines restart with the new values.

| Secret | Notes |
| --- | --- |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon pooled string (app) and direct string (migrations), both with `&connect_timeout=15` |
| `NEXTAUTH_URL` | Canonical origin; password-reset links and the `www` redirect use it |
| `NEXTAUTH_SECRET`, `CRON_SECRET` | Generated; rotating `NEXTAUTH_SECRET` signs everyone out |
| `SETTINGS_ENCRYPTION_KEY` | Generated; **never change it** — saved integration secrets are encrypted with it |
| `AZURE_STORAGE_CONNECTION_STRING` | The account must allow anonymous blob access; uploaded images are public URLs |
| Stripe, SMTP, Google, contact emails | Optional here; can be entered in Admin → Settings instead |

## Neon Free plan limits

The Free plan includes 100 compute-hours a month and suspends the database after 5 idle minutes. Health checks never wake it; the automation schedule uses roughly 30 compute-hours a month, leaving the rest for traffic. If the allowance runs out, the database stays suspended until the next month, so upgrade to the Launch plan before real sales. The Free plan's restore window is short; take a `pg_dump` with `DATABASE_URL_UNPOOLED` before risky changes.

## Going live after UAT

1. Replace the Stripe test keys in `.env.fly` with live keys and clear `STRIPE_WEBHOOK_SECRET`.
2. Run `npm run fly:setup` — it registers the live-mode webhook and restarts the machine.
3. Place one real low-value order and refund it from Admin → Orders.

## UAT checklist

- Browse home, portfolio, shop, updates, bio, and contact on phone and desktop.
- Admin → Settings readiness is green; Site appearance changes show on the public site.
- Upload an artwork image and confirm it displays (Azure Blob).
- Buy with Stripe test card `4242 4242 4242 4242`: confirmation email arrives and the order appears in Admin → Orders.
- Start checkout, press *back* on the Stripe page: the piece is immediately purchasable again.
- Contact form and commission request reach the studio inbox and email.
- Password reset email links to `https://michalelena.art`.
- Newsletter signup, test send, and unsubscribe work.

The site is publicly indexable during UAT. Keep unfinished content as drafts.

## Troubleshooting

- **Deploy stopped at the release step** — `fly logs` shows the Prisma error; fix the migration and redeploy. The previous release keeps serving.
- **Uploads fail** — the storage account must allow anonymous blob access, or the connection string is missing.
- **First request after idle is slow** — Neon is waking (about a second).
- **Webhook signature errors** — `STRIPE_WEBHOOK_SECRET` must match the endpoint for the current Stripe mode.
