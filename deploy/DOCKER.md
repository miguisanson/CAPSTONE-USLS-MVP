# Run the whole site with Docker and put it on https://miguisanson.dev

Two containers: **app** (the website, demo data built on first start) and **tunnel** (Cloudflare's
connector that makes the site public). Data (database, uploads, session secret) lives in a Docker
volume, so it survives restarts. Run every command below in PowerShell, inside the project folder.

## A. Docker Desktop (once)

1. Start **Docker Desktop** and wait until it says "Engine running".
2. Docker Desktop > Settings (gear) > General > turn on **Start Docker Desktop when you sign in**.
3. If Docker says "virtualization is not enabled": restart the PC, enter the BIOS (Del key), turn on
   **SVM Mode** (AMD) / **Intel VT-x**, save. The engine cannot run without it.

## B. First start (local only)

```powershell
docker compose up -d --build
```

The first build takes several minutes. Then open <http://127.0.0.1:8080/api/health>: you should see
`{"status":"ok", ...}`. The site itself is at <http://127.0.0.1:8080/>. (Port 8080 is only reachable from this PC.)

## C. Make it public (Cloudflare, once)

The domain must be on Cloudflare first.

1. Cloudflare dashboard > **Add a domain** (or "Onboard a domain") > type `miguisanson.dev` > choose the **Free** plan.
2. Cloudflare shows **two nameservers**. Copy them.
3. Go to the website where you bought the domain, find the domain's **Nameservers** setting, replace the
   existing ones with the two from Cloudflare, save.
4. Back in Cloudflare wait until the domain says **Active** (minutes to a few hours). `.dev` domains need HTTPS; Cloudflare provides it.
   If the DNS page has an old `A` or `CNAME` record for `miguisanson.dev` (the root), delete it.
5. Dashboard > **Networking** > **Tunnels** > **Create Tunnel** > type **Cloudflared** > name it `usls-uat` > Save.
6. On the next page (Install and Run) pick **Docker**. In the command shown, copy ONLY the long token (the text after `--token`). Do not run that command.
7. Make the token file: copy `deploy\tunnel.env.example` to `deploy\tunnel.env`, open it in Notepad, and
   replace the placeholder so the line reads `TUNNEL_TOKEN=<your token>`. Save. (This file is never committed to git.)
8. Back in the dashboard open the tunnel > **Routes** > **Add route** > **Published application**:
   Subdomain: leave empty. Domain: `miguisanson.dev`. Service URL: `http://localhost:5000`. Save.
   (The same route works without Docker too: `deploy\START-SITE.cmd`.)
   (Optional: add a second route with subdomain `www`, same Service URL.)
9. Start the tunnel together with the app:

```powershell
docker compose --profile tunnel up -d
```

10. Open <https://miguisanson.dev/api/health>. In the dashboard the tunnel should say **Healthy**.

Not using Cloudflare Access: the demo logins are open on purpose (decision IM36: the sign-in page lists the demo accounts).

## D. Every day

The site runs only when you start it (it never comes back on its own after a restart). Two desktop
buttons do it: **USLS site - Start** (`deploy\site-start.ps1`: starts Docker Desktop if needed, the site
and the tunnel, and keeps the PC awake while the site runs) and **USLS site - Stop** (`deploy\site-stop.ps1`).
Keep-awake does not change any power setting; on a laptop, closing the lid can still put it to sleep.

Two more buttons (double-click in the `deploy` folder, no typing):

- **`UPDATE-SITE.cmd`**: needs Docker Desktop running (start the site first). It gets the latest code (`git pull --ff-only`),
  rebuilds the site, waits until it answers, resets the demo data by itself only when the new version needs it (the
  rebuilt site reports an older database), and restarts the tunnel once if https://miguisanson.dev does not answer.
  It stops with a message if this folder has unsaved changes or the pull fails; nothing on the site changes in that case.
- **`RESET-DEMO-DATA.cmd`**: rebuilds the demo data after you type `YES`. It resets the Docker site when Docker runs it
  (otherwise the local file; close the local site first).

| Do this | Command |
|---|---|
| Start everything | `docker compose --profile tunnel up -d` |
| Stop everything | `docker compose --profile tunnel stop` |
| See what runs | `docker compose --profile tunnel ps` |
| Watch the site log | `docker compose logs -f app` |
| Reset the demo data | double-click `deploy\RESET-DEMO-DATA.cmd` |
| Update to the latest code | double-click `deploy\UPDATE-SITE.cmd` |

Reset removes everything testers entered (the app is stopped while the database is rebuilt). Reset on the morning of the meeting.
Nothing comes back by itself: after a restart of the PC, press **USLS site - Start** again. To also wipe uploads and the session secret: `docker compose --profile tunnel down -v` (deletes the volume).
The Docker site always uses its own SQLite file inside the `usls_data` volume. A `DATABASE_URL` line in `.env` does not move it (`docker-compose.yml` sets it).

## E. Google Calendar (optional)

Whoever owns the Google Cloud project (Natalie) adds this under **Authorized redirect URIs** of the Web client:
`https://miguisanson.dev/api/integrations/google-calendar/callback`
Her client ID and secret go in a file named `.env` in the project folder (see `.env.example`:
`GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY`). The same
`.env` can hold `GOOGLE_API_KEY` (Policy Assistant). Then `docker compose up -d`. More detail: UAT.md step 5.

## F. Keep the PC awake

Windows Settings > System > Power > Screen and sleep > **When plugged in, put my device to sleep after: Never**.
If the PC sleeps or goes offline, the site is down. Check <https://miguisanson.dev/api/health> from your phone before the meeting.

## Trouble

| Sign | Try |
|---|---|
| Cloudflare error 502 / 1033 | `docker compose --profile tunnel ps`: both must be "running"; check the Service URL is exactly `http://localhost:5000` |
| `env file ... tunnel.env not found` | step C7 not done (only needed with `--profile tunnel`) |
| Port 8080 busy | change `8080` in `docker-compose.yml` (the number before `:5000`) |

## G. Without Docker (`START-SITE.cmd`)

If Docker Desktop cannot run on this PC (for example, CPU virtualization is still off, part A3), the same site runs
directly on Windows, with the same Cloudflare route (`http://localhost:5000`). Use this path only when Docker is not
running the site; the two must not run at the same time.

1. Do part C steps 1-8 (domain, tunnel, token in `deploy\tunnel.env`, route). In step 6 any install option is fine:
   you only need the token.
2. Double-click **`deploy\START-SITE.cmd`**. It starts the site (`npm run uat`) on http://127.0.0.1:5000 if it is not
   already running, and the Cloudflare tunnel with your token (the official connector is already downloaded to
   `E:\DevCache\cloudflared\`; no install or admin rights needed). Leave both windows open.
3. To reset the demo data: close the "USLS site - keep open" window, double-click **`deploy\RESET-DEMO-DATA.cmd`**, type `YES`,
   then `START-SITE.cmd` again. (If the Docker site exists, that same button resets the Docker database instead.)

Do not run the Docker app and `START-SITE.cmd` at the same time with the tunnel: both would answer for the domain.
