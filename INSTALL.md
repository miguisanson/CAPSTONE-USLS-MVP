# Install on the demo laptop (Windows or Mac)

For the Capstone 2 defense. Branch: **`v7.0-defense`**. About 15 minutes, internet needed.
If anything here fails, send Migui a photo of the screen.

## 1. Install two programs (once)

| Program | Where | Note |
|---|---|---|
| Python 3.11 or newer | https://www.python.org/downloads/ | **Windows:** tick **Add python.exe to PATH** on the first installer screen. |
| Node.js 18 or newer (LTS) | https://nodejs.org/ | Keep the default options. |

GitHub Desktop (https://desktop.github.com/) is the easiest way to get the project.

## 2. Get the project

GitHub Desktop: **File > Clone repository > URL**, paste the address below, then choose the branch
**`v7.0-defense`** in the **Current branch** menu.

```
https://github.com/miguisanson/CAPSTONE-USLS-MVP.git
```

Or in a terminal:

```bash
git clone -b v7.0-defense https://github.com/miguisanson/CAPSTONE-USLS-MVP.git
```

## 3. Add the settings file

Migui sends one file named **`.env`**. Put it in the project folder, next to `app.py`.

- The name must be exactly `.env` (not `.env.txt`, not `env`).
- It holds the Claude key, the Gemini key and the Google Calendar settings. Do not share it or commit it.
- Mac: files that start with a dot are hidden in Finder. Press **Cmd + Shift + .** to see them.

## 4. Start the system

| Windows | Mac |
|---|---|
| Double-click **`Start.exe`** | Double-click **`Start.command`** |

The first start installs the packages, builds the pages and creates the demo data, so it takes several
minutes. The browser then opens **http://localhost:5000**. To stop: `Stop.exe` or `Stop.command`.

- Use the address `localhost:5000`, not `127.0.0.1`. Google Calendar only connects on `localhost:5000`.
- **Mac only:** if port 5000 is busy, turn off **System Settings > General > AirDrop & Handoff > AirPlay Receiver**, then start again.
- **Windows only:** if SmartScreen appears, click **More info > Run anyway**.
- **Mac only:** if `Start.command` will not open, right-click it and choose **Open**.

### If this laptop already ran an older version

Open a terminal in the project folder and run these two lines once, then start the system as above:

```bash
npm run install:python
```

```bash
npm run seed
```

The first line installs the new Claude package. The second rebuilds the demo data.

## 5. Check the three things the panel will see

Sign in from the sign-in page: **Demo accounts > Staff**.

| Check | Where | It works when |
|---|---|---|
| Policy Assistant | Staff > Policy Assistant. Ask: `Adding a subject is allowed until when?` | The answer names its document and page, and the label says **Answered by AI**. |
| Panel Matching | Staff > Panel Matching. Pick the student, open **Why this score**. | The list appears and the analysis label says **Keyword extraction assisted by AI**. |
| Google Calendar | Sign out. **Demo accounts > Faculty**. My Calendar > **Connect Google Calendar**. | Google asks to sign in, then the status on the page says **Connected**. |

If the label says **Offline answer**, the Claude key was not read: check that the file is named `.env`, that it is
next to `app.py`, and that step 4's "older version" lines were run. Then stop and start the system.

## Which AI service is running

- With `ANTHROPIC_API_KEY` in `.env`, **Claude** writes the Policy Assistant's answers and the panel-matching analysis.
- **Gemini** still makes the similarity numbers (embeddings) behind the document search and the panel match.
- To switch answer-writing back to Gemini, add the line `AI_PROVIDER=gemini` to `.env` and restart.
- With no key at all the system still runs; answers come from keyword search and are labelled **Offline answer**.

## Just before the defense

```bash
npm run seed
```

Run it the day before to rebuild all demo data. Then start the system, sign in once, and ask the Policy
Assistant one question so the first answer is not slow in front of the panel.
