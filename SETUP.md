# Fluently: going live with accounts and offline mode

## What goes in your GitHub repo

Put all of these files side by side in the repo, at the same level:

| File | What it does |
|---|---|
| `index.html` | The app |
| `sw.js` | Offline mode. Saves the app and voice engine on the device. |
| `manifest.json` | Lets people install Fluently on their Home Screen like a real app |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | App icons |

Offline mode only works on the real website (https), not when you open the file directly from your computer.

---

## Step 1: Create a free Supabase project (about 5 minutes)

1. Go to **supabase.com** and sign up (the free plan is enough).
2. Click **New project**. Name it `fluently`, choose a database password (save it somewhere), and pick the region closest to you.
3. Wait about a minute for it to finish setting up.

## Step 2: Create the progress table

1. In the left menu, open **SQL Editor** and click **New query**.
2. Paste everything below and click **Run**:

```sql
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "Users read their own progress"
  on public.progress for select using (auth.uid() = user_id);
create policy "Users add their own progress"
  on public.progress for insert with check (auth.uid() = user_id);
create policy "Users update their own progress"
  on public.progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.progress to authenticated;
```

These rules make sure each person can only ever see and change their own progress.

## Step 3: Tell Supabase where your app lives

1. Go to **Authentication**, then **URL Configuration**.
2. Set **Site URL** to your GitHub Pages address, for example `https://yourname.github.io/fluently/`
3. Under **Redirect URLs**, add the same address.

This makes the "confirm your email" and "reset password" links open your app.

## Step 4: Connect the app to Supabase

1. Go to **Project Settings**, then **API** (or click **Connect** at the top).
2. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`).
3. Copy the **anon public** key (or the **publishable** key).
4. Open `index.html` and find this line near the top of the script:

```js
const CLOUD = { url:'', anonKey:'' };
```

5. Paste them in:

```js
const CLOUD = { url:'https://abcdefgh.supabase.co', anonKey:'your-key-here' };
```

Both values are meant to be public, so they are safe in GitHub. Never put the **service_role** or **secret** key in the app.

Or just send Claude the URL and key and ask it to put them in.

## Step 5: Upload and test

1. Upload all the files to your repo. GitHub Pages updates in a minute or two.
2. Open the site on your phone and create an account. You'll get a confirmation email: open the link on that phone.
3. Rate a few chunks with stars, then log in on your computer. They should show up there.
4. Turn on airplane mode and reopen the app. It should still open, and every sentence you've already heard will play.

---

## How it works

- **Saving:** everything saves on the device instantly, even with no internet. When online, it syncs to your account within a few seconds, when you reopen the app, and every 5 minutes.
- **Two devices:** changes from both are combined. For each chunk's stars or heart, the most recent change wins. Streaks and daily counts add up across all devices.
- **Offline:** after the first visit with internet, the app opens with no connection. The voice needs one online visit to download (about 60 MB); after that it speaks offline too.
- **Logging out** removes the progress from that device. It stays safe in the account.
- **"Continue without an account"** keeps progress on that device only. Creating an account later adds it to the account.

## Optional: skip email confirmation while testing

**Authentication**, then **Providers**, then **Email**: turn off **Confirm email**. People can then log in right after signing up. Turn it back on before sharing the app widely.

Free Supabase projects send only a few emails per hour. For more, add your own email sender under **Authentication**, then **Emails**, then **SMTP Settings**.
