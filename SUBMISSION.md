# Submission checklist (hoichoi Hackathon · Problem 3)

## Live demo (local now)

```bash
npm run dev
# http://localhost:3000/login
# editor@hoichoi.demo / HoichoiDemo2026!
```

## Vercel live URL (you deploy)

1. Neon Postgres and R2 are already the production data/media path.
2. Set env vars from `.env.example` in Vercel: `DATABASE_URL`, `BETTER_AUTH_*`, `CRON_SECRET`, R2, Cloudflare AI Gateway, OpenRouter fallback, and Pollinations video.
3. Create a Cloudflare token with **AI Gateway Run** + **Workers AI Read**. Add credits to the `default` AI Gateway.
4. Run `npx prisma db push`, then deploy with Vercel after GitHub approval.

## Explainer video script (≤5 min)

1. Problem + four modules (30s)  
2. Studio: Bengali brief → independently native BN/EN copy + visibly distinct channel art + Cloudflare Veo playable MP4 (75s)
3. Approval: full preview, edit, discard with feedback/regenerate, then adapter preflight (45s)
4. Publisher: schedule/publish + real character/aspect/size rejection evidence (45s)
5. Insights: normalized like-for-like comparison + claim-level post citations → opens the next brief (60s)
6. Provider provenance, Better Auth, durable rate limiting, tests (15s)

## GitHub

**Do not push until the owner explicitly says to.** Repo is ready locally.
