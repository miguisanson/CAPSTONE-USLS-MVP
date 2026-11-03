# Start here — meeting prep (made overnight 3–4 Nov 2026)

## What is ready

| You asked for | Where |
|---|---|
| 1. Demo recording of your parts (slow, no audio) | `Documents/CAPSTONE_ONLY/Demo_Migui/videos/` — 2d Monitoring Sheet (4:29), 2h-1 Leave of Absence (6:36), 2h-2 Readmission (4:26), 2h-3 AWOL (5:06), 2l Reports (4:23). The videos are on this PC only (too big for GitHub). |
| Script for your voice-over | `NARRATION-SCRIPT.docx` / `.pdf` — each line with its start time. Each video also has a `.srt` file with the same lines: load it next to the video in CapCut/Clipchamp as a teleprompter, delete the subtitle track before export if you don't want captions. 2m Best Features is a spoken closing (no video), at the end of the script. |
| Cheat sheet for the meeting | `MEETING-CHEAT-SHEET.docx` / `.pdf` (6 pages): your parts step by step, rules with Handbook pages, likely questions with answers, open questions for the Graduate School, what to hand over, what to do if something breaks. |
| 2. UAT instrument reviewed | `Documents/CAPSTONE_ONLY/UAT/[CAP-IT2] UAT Instrument - Revised.docx` / `.pdf`, and `UAT-REVIEW-NOTES.md` (every change, why, and the source: ISO/IEC 25010, ISO 9241-11, SUS, Likert and form-design guides). |
| 3. USLS forms to be signed | `Documents/USLS_Forms/` — 44 forms (GS-F-01 … GS-F-44) + `GS-P-01 Forms Approval Sheet` (the page they sign) + `GS-P-02 Forms Routing Guide`. Print `USLS-GS-Forms-Pack.pdf` (approval sheet first). Every statement was checked against the Handbook and Research Protocol; open questions are at the end of `00-INVENTORY.md`. |
| 4. Natalie's e-mail question | See "Google Calendar" below. |
| 5. Server for miguisanson.dev | `deploy/DOCKER.md` (Docker) and `deploy/START-SITE.cmd` (no Docker). See "Put the site online" below. |

## Put the site online (you do this on the Cloudflare website, ~15 min + waiting)

Docker cannot start on this PC yet: **CPU virtualization (SVM Mode) is off in the BIOS**. You don't need Docker for
tomorrow — `deploy\START-SITE.cmd` runs the same site without it. (To use Docker later: restart, press Del, turn on
SVM Mode under Tweaker > Advanced CPU Settings, save; then follow `deploy/DOCKER.md`.)

1. Go to dash.cloudflare.com and sign in. Click **Add a domain** (or "Onboard a domain"), type `miguisanson.dev`, choose the **Free** plan.
2. Cloudflare shows **two nameservers**. Open the website where you bought `miguisanson.dev`, find **Nameservers**, replace them with Cloudflare's two, save.
3. Wait until Cloudflare shows the domain as **Active** (minutes to a few hours). If its DNS page has an old `A` or `CNAME` record for `miguisanson.dev`, delete it.
4. Cloudflare dashboard > **Networking** (or **Zero Trust > Networks**) > **Tunnels** > **Create a tunnel** > **Cloudflared** > name `usls-uat` > Save.
5. On the install page, choose **Windows**. Copy **only the long token** at the end of the command shown (don't run the command).
6. In the project folder, copy `deploy\tunnel.env.example` to `deploy\tunnel.env`, open it in Notepad, make the line `TUNNEL_TOKEN=<paste the token>`, save.
7. Back in Cloudflare: the tunnel > **Public hostname / Routes** > **Add** (Published application): subdomain **empty**, domain `miguisanson.dev`, service **HTTP**, URL `localhost:5000` (i.e. `http://localhost:5000`). Save.
8. Double-click `deploy\START-SITE.cmd`. Leave both windows it opens. (The site itself is already running on this PC
   since the night of 3 Nov, freshly seeded, in a window called "USLS site - keep open"; the script sees that and only
   starts the Cloudflare tunnel.) After a minute, open https://miguisanson.dev/api/health on your phone: it should say `"status":"ok"`.

Reset the demo data (the morning of the meeting): close the "USLS site" window, double-click `deploy\RESET-DEMO-DATA.cmd`, then `START-SITE.cmd` again.

## Google Calendar — should you send Natalie your e-mail?

Yes, send her a **personal Gmail** (not your school address — her note says the same). That is safe: she only adds it
as a **test user** in her Google Cloud project. While the Google app is in "Testing", Google lets only listed test users
connect a calendar, so without it you cannot test calendar sync. Her table maps each tester's Gmail to one demo
faculty profile (e.g. `liwayway.bautista@usls.edu.ph`): sign in to the portal as that faculty, open **My Calendar**,
click **Connect Google Calendar**, choose your Gmail, accept the "unverified app" warning (Continue).

For it to work on **miguisanson.dev** (not only on her laptop), she must also, in her Google Cloud project:
add `https://miguisanson.dev/api/integrations/google-calendar/callback` under the Web client's *Authorized redirect URIs*,
and `miguisanson.dev` under *Branding > Authorized domains*. Then she sends you (privately) the **client ID and
secret**, which go in your `.env` as `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`, plus a
`GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY` you generate once (UAT.md step 5 has the command). Connections expire every
7 days in Testing mode; reconnect from My Calendar. Google Calendar is optional: without it the site works and the
calendar page shows a preview.

## Note on the public site

You chose to show the demo accounts on the sign-in page. Anyone who finds https://miguisanson.dev can then sign in
as any demo role, Administrator included. Only demo data is on it, and a reset rebuilds it, so the risk is small;
to hide the list later, change `DEMO_SHOW_ACCOUNTS=1` to `0` in `deploy\START-SITE.cmd`.

## Policy Assistant runs without Gemini today

On the morning of 4 Nov Google's Gemini service answered with errors (HTTP 503 and timeouts), so every Policy Assistant
answer waited 8-13 seconds before showing the offline answer. `deploy\START-SITE.cmd` now starts the site with
`GOOGLE_API_KEY=off`: answers come in under a second, quoted and cited from the Handbook / Research Protocol, with the
badge "Offline answer". Panel matching also uses its built-in (offline) scoring. To use Gemini again, delete the line
`set GOOGLE_API_KEY=off` in `deploy\START-SITE.cmd` and restart the site.
