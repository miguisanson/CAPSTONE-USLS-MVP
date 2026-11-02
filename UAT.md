# Running User Acceptance Testing (UAT) at https://miguisanson.dev

The app runs on this Windows 11 PC. A free **Cloudflare Tunnel** (`cloudflared`) connects
`https://miguisanson.dev` to it, so testers only need a browser. Nothing on your router changes.
Data is the demo data (`npm run seed`). The app sends no e-mail.

If the PC is off, asleep or offline, the site is down. Plan for that (step 6).

## 1. One-time: the tunnel

Your domain must already be on Cloudflare (its nameservers point to Cloudflare).

In PowerShell:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel login                 # opens a browser: pick miguisanson.dev
cloudflared tunnel create usls-uat       # prints a Tunnel ID and writes <ID>.json
cloudflared tunnel route dns usls-uat miguisanson.dev
```

Then copy `deploy\cloudflared\config.yml.example` to `config.yml`, put your Tunnel ID in the two
`<TUNNEL-ID>` places, and save `config.yml` plus `<ID>.json` in
`C:\Windows\System32\config\systemprofile\.cloudflared\` (create the folder; the Windows service
reads from there). Run PowerShell **as Administrator** for these two commands:

```powershell
cloudflared service install              # starts with Windows
Start-Service cloudflared
```

(Easier alternative: create the tunnel in the Cloudflare dashboard under Zero Trust > Networks >
Tunnels, set the public hostname `miguisanson.dev` to `http://127.0.0.1:5000`, and run the one
`cloudflared service install <token>` command the dashboard shows. No config file needed.)

## 2. One-time: the app settings

In the project folder run `npm run setup:env -- --uat`. It creates or updates `.env` (it never
prints or overwrites a value you already have) and adds `SESSION_COOKIE_SECURE=1` and the Google
Calendar redirect address. Then open `.env` in Notepad and set:

| Line | What to put |
|---|---|
| `SECRET_KEY=` | a long random text (run `python -c "import secrets; print(secrets.token_hex(32))"`), so testers stay signed in after a restart |
| `DEMO_SHOW_ACCOUNTS=0` | **Add this line.** It stops the public sign-in page from listing the demo logins and the shared password (see step 4). Staff can still use the "Reset demo case" button |
| `GOOGLE_API_KEY=` | your Gemini key (free at aistudio.google.com/apikey), or leave empty: the Policy Assistant then uses local search only |
| `GOOGLE_CALENDAR_*` | see step 5; leave empty to skip Google Calendar (the page shows a preview only) |

`.env.example` lists every setting the app understands.

## 3. Every UAT start

```powershell
npm run seed        # only to reset the data (step 7) - the very first start builds it by itself
npm run build:web   # only after the screens (frontend) changed
npm run uat         # starts the site on 127.0.0.1:5000; the tunnel makes it public
```

Leave that window open. Open `https://miguisanson.dev/api/health` in a browser: you should see
`{"status":"ok", ...}`. To start it automatically at sign-in (optional), in a normal PowerShell:

```powershell
schtasks /Create /TN "USLS UAT" /SC ONLOGON /TR "cmd /c cd /d <PROJECT FOLDER> && npm run uat"
```

## 4. Demo logins

The password is the shared demo password. It is not written in the README: it is the value
`SIM_STUDENT_PASSWORD` in `app.py`. With `DEMO_SHOW_ACCOUNTS=0` (step 2) the public sign-in page shows
no **Demo accounts** panel and the two lists behind it answer "not found", so strangers cannot read
the password. **Hand each tester their login privately** (the table below plus the password, by
message or e-mail). On your own PC, leave `DEMO_SHOW_ACCOUNTS` unset and the panel works as before.

| Role | E-mail |
|---|---|
| GS Staff | `staff@usls.edu.ph` |
| Academic Coordinator | `academic@usls.edu.ph` |
| Research Coordinator | `research@usls.edu.ph` |
| Administrator | `admin@usls.edu.ph` |
| Dean | `dean@usls.edu.ph` |
| Faculty | `liwayway.bautista@usls.edu.ph` |
| Student (Miguel Yu, research) | `student@usls.edu.ph` |

More student logins, one per workflow (practicum, graduation, withdrawal, enrollment, leave,
readmission, AWOL, ...), are listed in the Demo accounts panel when it is switched on (open it locally
with `DEMO_SHOW_ACCOUNTS` unset, or read the student e-mails from the demo-accounts table you keep for
the testers). A login disappears from that panel once someone changes its password; re-seeding brings
it back.

Only Graduate School staff and the administrator can reset a demo case. Students and faculty get a
"Only Graduate School staff can reset a demo case" message.

Other protections for the public site: each account may ask the Policy Assistant 30 questions an hour
(`ASSISTANT_MAX_PER_HOUR`), uploads over 30 MB are refused with a clear message (`MAX_UPLOAD_MB`), and
every page carries basic browser security headers. There is no Content-Security-Policy yet.

**Security warning.** If you leave `DEMO_SHOW_ACCOUNTS` on (the default) while the site is public,
anybody who finds the address can open that panel, read the password and sign in as Administrator.
Set `DEMO_SHOW_ACCOUNTS=0`, and for extra safety put **Cloudflare Access** in
front (Zero Trust > Access > Applications > Self-hosted > `miguisanson.dev`, an "Allow" policy for
the testers' e-mail addresses, free up to 50 people), or, for the strictest setup, set `DEMO_MODE=0` and hand out passwords
yourself. `DEMO_MODE=0` also removes the demo Reset buttons and gives new student accounts random
passwords. If you use Access, add a "Bypass" rule for the path `/api/calendar/feed/*` so calendar
subscriptions keep working.

## 5. Google Calendar (optional)

1. Google Cloud console > your project > **Google Auth Platform**.
2. **Branding**: under *Authorized domains* add `miguisanson.dev`. Home page link: `https://miguisanson.dev`.
3. **Clients** > your *Web application* client > *Authorized redirect URIs* > add exactly
   `https://miguisanson.dev/api/integrations/google-calendar/callback`.
4. **Data Access**: the scopes `openid`, `email`, `calendar.freebusy`, `calendar.events.owned`.
5. **Audience**: leave the app in **Testing** and add every tester's Google account under
   *Test users* (up to 100). Google refuses anyone else.
6. Put the client ID and secret in `.env` (`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`),
   keep the redirect address that `--uat` added, and set `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` to
   the output of `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
   Keep that key; changing it disconnects everyone. Restart `npm run uat`.

In Testing mode Google shows an "unverified app" warning (testers choose Continue) and **expires
each connection after 7 days**. Faculty reconnect from **My Calendar** in the Faculty Portal.

## 6. Keep the PC awake

In PowerShell as Administrator:

```powershell
powercfg /change standby-timeout-ac 0      # never sleep on mains power
powercfg /change hibernate-timeout-ac 0    # never hibernate
powercfg /change monitor-timeout-ac 10     # the screen may turn off
```

Keep it plugged in, set Windows Update *active hours* to cover testing, and do not shut down. Before
each session open `https://miguisanson.dev/api/health` from your phone on mobile data.

## 7. Reset the data

Stop `npm run uat` (Ctrl+C), run `npm run seed`, then `npm run uat` again. This rebuilds the
database to the same demo data for everyone and prints a fingerprint. Everything testers entered is
gone and every changed demo password is restored. To keep their entries, copy
`usls_gs_demo.sqlite3` somewhere safe first, while the app is stopped.

## 8. If something is wrong

| Sign | Try |
|---|---|
| Cloudflare error page (1033 / 502) | `Get-Service cloudflared`, then `Start-Service cloudflared`; is `npm run uat` running? |
| Sign-in does nothing | `.env` has `SESSION_COOKIE_SECURE=1` but the address used is not https |
| "Too many failed sign-ins" | wait; the counter also resets when the app restarts |
| Calendar says redirect_uri_mismatch | the address in the Google console and `GOOGLE_CALENDAR_REDIRECT_URI` differ by even one character |
| Port 5000 busy | set `FLASK_PORT=5001` in `.env` and change the tunnel's `service:` to the same port |
