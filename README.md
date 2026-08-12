# HotelPilot AI — Stage 1 (Foundation)

Replaces the paper register. Built with Next.js, TypeScript, Tailwind, Supabase.

This is **Stage 1** from the build spec: project structure, auth, and database
schema (rooms, employees, guests, stays, payments, checkout_changes, shifts,
shift_events, audit_logs). Stages 2-8 (guests/stays UI, payments UI, shift
engine, AI tools, reports) build on top of this foundation.

## What's in this package

- `app/login`, `app/dashboard` - working login (Supabase Auth) + a real
  dashboard reading live room data.
- `app/auth/logout` - logout route.
- `proxy.ts` - session refresh + route protection (redirects unauthenticated
  users to `/login`).
- `lib/supabase/{client,server,admin}.ts` - the three Supabase client types
  you'll need (browser, server component, service-role/admin - admin is
  server-only and never touches the browser bundle).
- `supabase/migrations/0001_init.sql` - the 10 core tables + triggers.
- `supabase/migrations/0002_policies.sql` - Row Level Security so staff vs.
  Master Admin permissions are enforced by the database itself, not just the UI.
- `supabase/migrations/0003_audit_function.sql` - the only way to write an
  audit log row (direct inserts are locked down).

## 1. Connect Supabase

1. Go to your Supabase dashboard -> **New project**.
2. Once created, open **Project Settings -> API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key (keep this one server-side only)
3. Open **SQL Editor** in Supabase and run, in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_policies.sql`
   - `supabase/migrations/0003_audit_function.sql`
4. Insert your hotel + first Master Admin manually the first time (there is no
   public "create admin" page, on purpose):
   ```sql
   insert into hotels (name) values ('Your Hotel Name') returning id;
   -- create the user in Supabase Auth (Dashboard -> Authentication -> Add user)
   -- then link it as master_admin, using the hotel id and auth user id above:
   insert into employees (id, hotel_id, full_name, role)
   values ('<auth-user-uuid>', '<hotel-id>', 'Your Name', 'master_admin');
   ```

## 2. Local development

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
# SUPABASE_SERVICE_ROLE_KEY from Supabase step above
npm run dev
```

Visit `http://localhost:3000` -> redirects to `/login`.

## 3. Push to your GitHub repo (kiko1313/Hotelpilot)

From inside this folder:

```bash
git init
git add .
git commit -m "Stage 1: foundation, auth, database schema"
git branch -M main
git remote add origin https://github.com/kiko1313/Hotelpilot.git
git push -u origin main
```

(If the repo already has commits, use `git pull --rebase origin main` first,
or push to a new branch and open a PR.)

## 4. Deploy on Vercel

1. In your Vercel dashboard -> **Add New... -> Project** -> import
   `kiko1313/Hotelpilot` from GitHub.
2. Framework preset: Next.js (auto-detected).
3. Add environment variables (Project Settings -> Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (mark as sensitive/server-only)
   - `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` (needed later, in Stage 7)
4. Deploy. Vercel will rebuild automatically on every push to `main`.

## What's NOT built yet (next stages)

Per the spec's staged plan, Stage 1 stops at foundation. Next up:

- Stage 2: Guests + stays + check-in/check-out screens
- Stage 3: Payments UI
- Stage 4: Employee management screens (Master Admin adds staff - no public
  registration, matching what we locked in)
- Stage 5: Shift start/end/handover/takeover UI
- Stage 6: Audit log viewer
- Stage 7: AI tools (server-side, controlled functions only)
- Stage 8: Reports + polish

Say the word and I'll build Stage 2 next.
