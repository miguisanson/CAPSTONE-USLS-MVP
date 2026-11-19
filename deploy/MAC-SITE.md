# https://miguisanson.dev from this Mac (Docker + Cloudflare Tunnel)

Two containers: **app** (the website; demo data built on first start, kept in a Docker volume) and
**tunnel** (Cloudflare's connector that makes it public). Docker runs in **Colima** (`brew install colima
docker docker-compose`): no Docker Desktop window, no admin password.

## Once

1. **Tunnel token.** dash.cloudflare.com > Zero Trust > **Networks > Tunnels** > open the tunnel
   (`usls-uat`, made on the old PC) > **Configure** / "Install connector" > pick **Docker** > copy only the
   long text after `--token`. Copy `deploy/tunnel.env.example` to `deploy/tunnel.env` and make the line read
   `TUNNEL_TOKEN=<that text>`. (`deploy/tunnel.env` is gitignored; never paste the token anywhere else.)
   The tunnel's route must be: domain `miguisanson.dev`, Service URL `http://localhost:5000`.
   The old PC's connector is gone, so no other copy answers for the domain.

## Every day (you turn it on and off; nothing runs by itself)

In the project folder, double-click:

- **`Website ON.command`**: starts Docker, the site and the tunnel; keeps the Mac awake while it runs.
- **`Website OFF.command`**: stops the site, the tunnel and Docker (frees the memory). The demo data is kept.

The site is only up while the Mac is **awake, online and plugged in**. Closing the lid puts it to sleep.
After a restart of the Mac the site stays off until you press ON.
Check from your phone: https://miguisanson.dev/api/health should show `"status":"ok"`.

## Commands (Terminal, in the project folder)

| Do this | Command |
|---|---|
| See what runs | `docker-compose --profile tunnel ps` |
| Site log / tunnel log | `docker-compose logs -f app` / `docker-compose --profile tunnel logs tunnel` |
| Put new code on the site | `docker-compose --profile tunnel up -d --build` |
| Reset the demo data | `docker-compose stop app && docker-compose run --rm --no-deps app python app.py --seed && docker-compose start app` |

Cloudflare error 1033 / 502: the tunnel is not connected. Press OFF then ON, or
`docker-compose --profile tunnel restart tunnel`.
