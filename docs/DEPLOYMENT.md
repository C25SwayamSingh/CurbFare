# Deploying Curbfare to curbfare.app

The exact sequence from "runs on my Mac" to "trucks can sign up." Written so
launch day is mechanical. Cross-check `PROJECT_STATE.md → Before Public
Release` before going live; `.env.example` documents every variable named
here.

Already done: curbfare.app on Cloudflare Registrar, Email Routing
(vendors@curbfare.app → Gmail), Resend account + API key, production build
compiles, resend-verification safety net shipped.

## 1. Hosted Supabase (the production database)

1. supabase.com → New project, org of your choice, region `us-east-1`
   (closest to NYC/NJ). Save the database password in a password manager.
2. Link and push the schema from the repo (never `db:reset`; migrations are
   forward-only and replay cleanly, storage bucket included):

   ```bash
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```

3. Dashboard → Authentication → URL Configuration:
   - Site URL: `https://curbfare.app`
   - Redirect URLs: `https://curbfare.app/auth/callback`,
     `https://curbfare.app/auth/confirm`, `https://curbfare.app/auth/recovery`,
     `https://curbfare.app/auth/verify`
4. Dashboard → Authentication → Emails → Templates. The hosted project does
   NOT read `supabase/config.toml`; paste by hand:
   - Confirm signup: subject `Confirm your email`, body from
     `supabase/templates/confirmation.html`
   - Reset password: subject `Reset your password`, body from
     `supabase/templates/recovery.html`
5. Dashboard → Authentication → Sign In / Up: confirm email ON. Multi-factor:
   TOTP enroll + verify ON.
6. SMTP (required before real vendors sign up — the built-in sender allows
   only a couple of emails per hour):
   - First verify curbfare.app in Resend (Resend → Domains → Add; paste the
     DNS records it gives you into Cloudflare; wait for Verified).
   - Dashboard → Project Settings → Auth → SMTP: host `smtp.resend.com`,
     port `465`, user `resend`, password = the Resend API key, sender
     `Curbfare <auth@curbfare.app>`.
   - Then Authentication → Rate Limits: raise email sends to something real
     (30/hour is plenty for launch).
7. Grant yourself platform admin (SQL Editor; writable only via service
   role by design):

   ```sql
   insert into public.platform_admins (user_id, note)
   select id, 'founder' from auth.users where email = 'YOUR_EMAIL'
   on conflict (user_id) do nothing;
   ```

   Run this AFTER you have signed up and verified on production.

## 2. Vercel (hosting)

1. Decide the branch: merging `feature/loyalty-mvp` → `main` first is
   cleanest (owner's call, never automatic).
2. vercel.com → Add New Project → import the GitHub repo. Framework
   auto-detects Next.js; no build settings needed.
3. Environment variables (Production), values per `.env.example`:

   | Variable                          | Value                                             |
   | --------------------------------- | ------------------------------------------------- |
   | `NEXT_PUBLIC_APP_URL`             | `https://curbfare.app`                            |
   | `NEXT_PUBLIC_APP_ENV`             | `production` (never `development`)                |
   | `NEXT_PUBLIC_SUPABASE_URL`        | from Supabase → Settings → API                    |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | same page                                         |
   | `SUPABASE_SERVICE_ROLE_KEY`       | same page (server-only)                           |
   | `GOOGLE_PLACES_API_KEY`           | existing server key                               |
   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | existing browser key                              |
   | `RESEND_API_KEY`                  | from Resend                                       |
   | `VENDOR_REVIEW_NOTIFY_EMAIL`      | `vendors@curbfare.app`                            |
   | `VENDOR_REVIEW_FROM_EMAIL`        | `applications@curbfare.app` (after domain verify) |

4. Deploy. Test the `*.vercel.app` preview URL end to end BEFORE touching
   DNS (auth links will point at curbfare.app and won't round-trip until
   step 3, but pages, maps, and discovery should all work).

## 3. Point curbfare.app at it

1. Vercel → Project → Settings → Domains → add `curbfare.app`. It shows the
   required DNS records.
2. Cloudflare → curbfare.app → DNS: add them. Keep Cloudflare proxy OFF
   (grey cloud) for these records; Vercel terminates TLS itself. Email
   Routing keeps working — its MX records are separate.
3. Wait for Vercel to show the domain as Valid; open https://curbfare.app.

## 4. Google key hygiene

- Browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`): Google Cloud Console →
  Credentials → add `https://curbfare.app/*` to allowed websites. Without
  this, maps and address autocomplete fail only in production.
- Server key: keep unrestricted-by-referrer (it is server-side), API
  restriction to Places API stays.

## Launch smoke test (run the whole loop before telling the trucks)

1. Sign up with a real Gmail → confirmation arrives → Verify button → in.
2. On /verify-email, "Send a fresh link" delivers a second email.
3. Apply as a vendor → doorbell email lands at vendors@curbfare.app.
4. Approve at /admin/applications (after the platform-admin grant).
5. Create a cart, publish rewards, go live with a real location.
6. Second phone, second account: discover the cart, open checkout QR, award
   points at the counter screen, redeem.
7. Password reset round-trip.
8. Check both light and dark mode on a phone.

## When something goes wrong

- Vercel → Deployments → previous build → Promote (instant rollback).
- Database: forward-only; fix with a new migration, never reset.
- Auth emails not arriving: Supabase → Logs → Auth, and Resend → Logs show
  every attempt and rejection reason.
- The 54 NYC hotspots and any local test data are local-only by design;
  production starts empty. Re-run the import scripts against production
  only when wanted.
