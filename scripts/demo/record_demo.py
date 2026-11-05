"""Record demo parts as slow, narration-ready videos (no audio) by replaying the walkthrough capture cases.

The click paths are the tested ones in ``scripts/docs/walkthrough/capture/case_*.py``; this script only changes how
they are shown: one browser tab per part (roles switch by signing out and typing the next login, as a presenter
would), a visible pointer, typed text, a pause wherever the walkthrough takes a screenshot (no title cards: the videos are short), and a timeline (``<part>.timeline.json``) for writing the narration.

Use a FRESH throw-away database and a port of your own (the cases change demo students):

    DATABASE_URL=sqlite:///E:/Temp/claude/demo-rec/demo.sqlite3 FLASK_PORT=5091 GOOGLE_API_KEY=off DEMO_MODE=1 \
        DEMO_PASSWORD='DemoPass123!' .venv/Scripts/python.exe app.py       # first start seeds
    WT_BASE=http://127.0.0.1:5091 .venv/Scripts/python.exe scripts/demo/record_demo.py --out <dir> [--only 2d 2h-1]

mp4 conversion needs an ffmpeg: ``--ffmpeg <path>`` (e.g. from the imageio-ffmpeg package); without it the .webm stays.
"""
from __future__ import annotations

import argparse
import importlib
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "docs" / "walkthrough"))

from playwright.sync_api import Locator, sync_playwright  # noqa: E402

import capture.common as common  # noqa: E402
from capture.common import Runtime  # noqa: E402

VIEW = {"width": 1600, "height": 900}
SLOW_MO = 80           # ms added to every browser action
SHOT_PAUSE = 1400      # minimum ms held wherever the walkthrough takes a screenshot
TYPE_DELAY = 12        # ms per typed character
WORDS_PER_SEC = 2.7    # brisk speech (~160 words a minute); a hold lasts as long as its narration line
NARRATION = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))


def speak_ms(key: str, minimum: int = SHOT_PAUSE) -> int:
    words = len(NARRATION.get(key, "").split())
    return max(minimum, int(words / WORDS_PER_SEC * 1000) + 250)

# (key, capture module, title (file name and corner caption), one-line description)
PARTS = [
    ("2d", "capture.case_05_monitoring_sheet", "Monitoring Sheet", "Add a student, add / edit / remove subject rows, change history"),
    ("2h-1", "capture.case_10_leave_of_absence", "Leave of Absence", "Student files, staff review, Dean approves, Registrar list"),
    ("2h-2", "capture.case_11_readmission", "Readmission", "Coming back from an approved leave"),
    ("2h-3", "capture.case_12_awol", "AWOL and Return from AWOL", "Flagged from records, the student files a return, the Dean decides"),
    ("2l", "tour_reports", "Reports & Analytics", "What the Graduate School knows about all students at once"),
    ("2m", "tour_best_features", "Best Features", "Rules register, Policy Assistant, panel matching, defense scheduling, shared boards and reports"),
]

ROLE_NAMES = {
    "staff@usls.edu.ph": "Graduate School Staff",
    "dean@usls.edu.ph": "Dean",
    "academic@usls.edu.ph": "Academic Coordinator",
    "research@usls.edu.ph": "Research Coordinator",
}

# Pointer dot and caption chip, re-installed on every page load; the caption survives navigation in sessionStorage.
OVERLAY_JS = r"""
(() => {
  if (window.__demoOverlay) return; window.__demoOverlay = true;
  const add = () => {
    if (!document.body) return setTimeout(add, 30);
    const st = document.createElement('style');
    st.textContent = `
      #__dot{position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;
        background:rgba(255,196,0,.55);border:2px solid rgba(200,120,0,.9);z-index:2147483647;pointer-events:none;
        transition:transform .28s ease-out, width .15s, height .15s;box-shadow:0 0 0 4px rgba(255,196,0,.18)}
      #__dot.down{width:34px;height:34px;margin:-17px 0 0 -17px;background:rgba(255,140,0,.6)}
      #__cap{position:fixed;right:14px;bottom:12px;z-index:2147483646;pointer-events:none;font:600 13px/1.2 system-ui,Segoe UI,sans-serif;
        color:#fff;background:rgba(15,63,46,.82);padding:6px 10px;border-radius:8px;letter-spacing:.2px}
      `;
    document.head.appendChild(st);
    const dot = document.createElement('div'); dot.id='__dot'; document.body.appendChild(dot);
    const cap = document.createElement('div'); cap.id='__cap'; document.body.appendChild(cap);
    const xy = sessionStorage.getItem('__xy') || (innerWidth/2+','+innerHeight/2); if (xy) { const [x,y]=xy.split(','); dot.style.transform=`translate(${x}px,${y}px)`; }
    cap.textContent = sessionStorage.getItem('__cap') || ''; cap.style.display = cap.textContent ? '' : 'none';
    document.addEventListener('mousemove', e => { dot.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;
      sessionStorage.setItem('__xy', e.clientX+','+e.clientY); }, true);
    document.addEventListener('mousedown', () => dot.classList.add('down'), true);
    document.addEventListener('mouseup', () => setTimeout(() => dot.classList.remove('down'), 180), true);
    window.__demoCaption = t => { sessionStorage.setItem('__cap', t); cap.textContent=t; cap.style.display = t ? '' : 'none'; };
  };
  add();
})();
"""

_orig_fill = Locator.fill
PICKER_TYPES = {"date", "time", "datetime-local", "month", "week"}  # typing "2026-11-10" key by key breaks these inputs


def _typed_fill(self, value, **kw):
    """Type short text visibly instead of pasting it (date and time pickers are filled in one go)."""
    if isinstance(value, str) and 0 < len(value) <= 220 and (self.get_attribute("type") or "") not in PICKER_TYPES:
        _orig_fill(self, "", **kw)
        self.press_sequentially(value, delay=TYPE_DELAY)
    else:
        _orig_fill(self, value, **kw)


class _ContextShim:
    """``page.context`` for the cases: closing it must not end the recording of the part."""

    def __init__(self, ctx):
        self._ctx = ctx

    def close(self):
        pass

    def __getattr__(self, name):
        return getattr(self._ctx, name)


class RolePage:
    """Stands in for the page a case opened for one account; every use first makes sure that account is signed in."""

    def __init__(self, rt: "RecRuntime", email: str):
        self._rt, self._email = rt, email

    def __getattr__(self, name):
        self._rt.ensure(self._email)
        if name == "context":
            return _ContextShim(self._rt.page.context)
        return getattr(self._rt.page, name)


class RecRuntime(Runtime):
    def __init__(self, playwright, out: Path):
        self.pw = playwright
        self.browser = playwright.chromium.launch(channel="msedge", headless=True, slow_mo=SLOW_MO)
        self.log, self.case, self.out = [], "?", out
        self.page = None
        common.SHOTS.mkdir(parents=True, exist_ok=True)
        common.TEXTS.mkdir(parents=True, exist_ok=True)

    # -- one recording per part --------------------------------------------------
    def start_part(self, key: str, title: str, line: str) -> None:
        self.part_dir = self.out / f"_raw_{key}"
        shutil.rmtree(self.part_dir, ignore_errors=True)
        ctx = self.browser.new_context(viewport=VIEW, record_video_dir=str(self.part_dir), record_video_size=VIEW,
                                       accept_downloads=True)
        ctx.add_init_script(OVERLAY_JS)
        self.page = ctx.new_page()
        self.page.set_default_timeout(20000)
        self.page.on("dialog", lambda d: d.accept())
        self.t0 = time.time()
        self.events: list[dict] = []
        self.current: str | None = None
        self.urls: dict[str, str] = {}
        self.signins: dict[str, int] = {}
        self.key, self.title = key, title
        self.page.goto(common.BASE + "/login")
        self.page.wait_for_timeout(300)

    def end_part(self, ffmpeg: str | None) -> Path:
        self.mark("end", "end of part")
        self.page.wait_for_timeout(600)
        video = self.page.video
        self.page.context.close()
        raw = Path(video.path())
        dest = self.out / f"{self.key}-{re.sub(r'[^A-Za-z0-9]+', '-', self.title).strip('-')}"
        (dest.with_suffix(".timeline.json")).write_text(json.dumps(self.events, indent=1), encoding="utf-8")
        webm = dest.with_suffix(".webm")
        shutil.move(str(raw), webm)
        shutil.rmtree(self.part_dir, ignore_errors=True)
        if ffmpeg:
            # the recorder keeps a few still seconds after the context closes; cut them just after the end mark
            subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", str(webm), "-t", str(self.events[-1]["t"] + 1.0), "-vf", "scale=1920:1080:flags=lanczos",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30",
                            str(dest.with_suffix(".mp4"))], check=True)
            webm.unlink()
        return dest

    def mark(self, kind: str, label: str) -> None:
        self.events.append({"t": round(time.time() - self.t0, 1), "kind": kind, "label": label,
                            "role": ROLE_NAMES.get(self.current or "", "Student" if self.current else "")})

    def caption(self) -> None:
        role = ROLE_NAMES.get(self.current or "", "Student")
        self.page.evaluate("t => window.__demoCaption && window.__demoCaption(t)", f"{self.key} \u00b7 {self.title} \u00b7 {role}")

    # -- accounts ------------------------------------------------------------------
    def new_page(self, email=None, *, accept_dialogs=True):
        if email:
            self.ensure(email)
        return RolePage(self, email or self.current)

    def ensure(self, email: str) -> None:
        if email == self.current:
            return
        page = self.page
        if self.current:
            self.urls[self.current] = page.url
            try:
                page.keyboard.press("Escape")
                page.get_by_role("button", name=re.compile("sign out", re.I)).first.click(timeout=4000)
                page.wait_for_url(re.compile("/login"), timeout=10000)
            except Exception:  # noqa: BLE001 - a modal can hide the button; the API does the same
                page.request.post(common.BASE + "/api/auth/logout")
                page.goto(common.BASE + "/login")
        self.current = email
        role = ROLE_NAMES.get(email, "Student")
        self.settle(page, 200)
        # no on-screen card: this event only tells build_narration.py to start the sign-in line while the login is typed
        self.mark("card", f"Signing in as {role}")
        began = time.time()
        self.login(page, email)
        # keep the screen on the login result until the sign-in line has been said
        n = self.signins[role] = self.signins.get(role, 0) + 1
        line = f"{self.key}:signin:{role}"
        spoken = speak_ms(f"{line}:{n}" if f"{line}:{n}" in NARRATION else line, 0)
        page.wait_for_timeout(max(0, spoken - int((time.time() - began) * 1000)))
        self.caption()
        self.mark("signin", f"signed in as {role} ({email})")
        back = self.urls.get(email)
        if back and "/login" not in back:
            page.goto(back)
            self.settle(page, 300)

    def login(self, page, email, password=common.PASSWORD):
        page.goto(common.BASE + "/login")
        page.wait_for_load_state("networkidle")
        page.get_by_label(re.compile("email", re.I)).first.fill(email)
        page.locator("input[type=password]").first.fill(password)
        page.get_by_role("button", name=re.compile(r"^(sign in|log in)", re.I)).first.click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=20000)
        self.settle(page)

    # -- pacing ----------------------------------------------------------------------
    def shot(self, page, shot_id, *, full=False, locator=None, clip_to_main=False):
        real = self.page
        try:  # never hold on a spinner or skeleton: wait until the screen has finished loading
            real.wait_for_function(
                r"() => !/Loading[^\n]{0,40}(\.\.\.|…)|Checking account/.test(document.body.innerText)"
                r" && !document.querySelector('.animate-pulse')", timeout=20000)
        except Exception:  # noqa: BLE001
            pass
        self.mark("hold", shot_id)
        hold = speak_ms(shot_id)
        if full:  # show the whole page: hold, glide down, glide back
            real.wait_for_timeout(min(hold // 2, 3000))
            hold -= min(hold // 2, 3000)
            real.evaluate("""async () => { const s = [...document.querySelectorAll('main, div')].find(e =>
                e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY.match(/auto|scroll/)) || document.scrollingElement;
                const start = s.scrollTop, end = s.scrollHeight - s.clientHeight;
                for (let y = start; y < end; y += 30) { s.scrollTop = y; await new Promise(r => setTimeout(r, 16)); }
                await new Promise(r => setTimeout(r, 400));
                for (let y = s.scrollTop; y > start; y -= 60) { s.scrollTop = y; await new Promise(r => setTimeout(r, 16)); }
                s.scrollTop = start; }""")
        real.wait_for_timeout(max(hold - 1200, 300) if full else hold)
        return shot_id

    def step(self, label, fn):
        self.mark("step", label)
        if self.current:
            try:
                self.caption()
            except Exception:  # noqa: BLE001
                pass
        return super().step(label, fn)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--ffmpeg")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    Locator.fill = _typed_fill
    _settle = Runtime.settle  # the cases' fixed settle waits are for screenshots; half of them is enough on video (never less than the 300 ms the debounced loads need)
    Runtime.settle = staticmethod(lambda page, ms=900: _settle(page, max(300, ms // 2)))
    failures = 0
    with sync_playwright() as pw:
        rt = RecRuntime(pw, out)
        for key, module, title, line in PARTS:
            if args.only and key not in args.only:
                continue
            print(f"== {key} {title}")
            rt.case = module
            rt.start_part(key, title, line)
            importlib.import_module(module).run(rt)
            dest = rt.end_part(args.ffmpeg)
            bad = [e for e in rt.log if e["case"] == module and e["kind"] == "FAIL"]
            failures += len(bad)
            print(f"   saved {dest.name} ({len(bad)} failed steps)")
        (out / "_record_log.json").write_text(json.dumps(rt.log, indent=1), encoding="utf-8")
        rt.browser.close()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
