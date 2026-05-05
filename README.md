# GuestChat

A simple guest-name + 6-digit-pin chat website. No email, no signup forms — just pick a name, pick a pin, start chatting.

🔗 **Live demo:** _(add your GitHub Pages URL once deployed)_

## Features

- **Guest login** — first time using a name+pin combo creates the account; same combo logs you back in.
- **Global chatroom** — everyone in one shared room.
- **Private 1-on-1 chats** — search anyone by username and message them directly.
- **Offline messaging** — like WhatsApp; send messages to users who aren't online, they'll see them when they return.
- **Online presence** — see who's online in real time.
- **File uploads** — share images and videos up to 10 MB.
- **Delete your messages** — both text and media (also removes from storage).

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Hosting:** GitHub Pages (free)
- **Backend:** [Supabase](https://supabase.com) free tier
  - Postgres for users and messages
  - Realtime channels for live chat and presence
  - Storage for media files

## Local Development

Just open `index.html` in a browser. That's it. No build, no server.

For development with hot reload, use any static server, e.g.:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project Structure

```
.
├── index.html          # Login page
├── chat.html           # Main chat app
├── css/
│   └── styles.css
└── js/
    ├── supabase-config.js   # Credentials & client init
    ├── auth.js              # Login / signup logic
    ├── chat.js              # Main chat orchestration
    ├── presence.js          # Online users tracking
    └── upload.js            # File upload to Supabase Storage
```

## Security Notes

This is a learning / personal project. The current setup:

- Stores PINs in **plain text**.
- Uses permissive Row Level Security policies (any anon user can read/write the tables).

For a production-grade app you'd want to: hash pins (bcrypt), add rate limiting, tighten RLS policies, and consider Supabase Auth instead of the custom guest system.

## Deployment to GitHub Pages

1. Push this folder to a GitHub repo (e.g. `guestchat`).
2. Repo → **Settings** → **Pages**.
3. Source: **Deploy from a branch** → `main` → `/ (root)` → Save.
4. Wait ~1 minute. URL will be `https://<your-username>.github.io/<repo-name>/`.

## License

MIT — do whatever you want.
