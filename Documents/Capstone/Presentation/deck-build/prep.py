"""Rebuild the assets folder from the v3 deck's pictures plus the fresh screenshots. usage: prep.py <scratchpad> <v3 deck>"""
import sys, os, re, json, hashlib, shutil
from PIL import Image
from pptx import Presentation
SP, DECK = sys.argv[1], sys.argv[2]
A, RAW = SP + "/assets", SP + "/assets/raw"
for sub in ("shots", "docs", "screens"):
    os.makedirs("%s/%s" % (A, sub), exist_ok=True)
key = lambda alt: re.sub(r"[^a-z0-9]+", "-", alt.lower()).strip("-")[:70]
# framed screenshots already in the deck
for name, alt in {"home": "Staff home screen of the platform, current build", "monitoring": "Monitoring Sheet, current build",
                  "rules": "Business Rules register, searched for withdraw", "matching": "Panel Matching with the score breakdown open",
                  "assistant": "Policy Assistant answering a question with its source"}.items():
    shutil.copy("%s/%s.png" % (RAW, key(alt)), "%s/shots/%s.png" % (A, name))
# frame the new screenshots the same way
base = Image.open(A + "/shots/home.png")
print("frame base", base.mode, base.size)
base = base.convert("RGBA")
bar, alpha = base.crop((0, 0, 1600, 40)), base.getchannel("A")
for name, src in {"calendar": "calendar", "scheduling": "sched-1", "reports": "reports-year2", "gate": "gate", "leave": "leave"}.items():
    im = Image.open("%s/shots/%s.png" % (SP, src)).convert("RGBA").resize((1600, 1000), Image.LANCZOS)
    out = Image.new("RGBA", (1600, 1040), (255, 255, 255, 0))
    out.paste(bar, (0, 0)); out.paste(im, (0, 40)); out.putalpha(alpha)
    out.save("%s/shots/%s.png" % (A, name), optimize=True)
shutil.copy(SP + "/shots/calendar-card.png", A + "/shots/calendar-card.png")
# documents
docs = {"letter-001.jpg": "Acceptance letter signed by the Dean of the Graduate School, 17 November 2026",
        "r2hi-012.jpg": "Round 2 UAT form, acceptance page signed by the Dean",
        "r1hi-012.jpg": "Round 1 UAT form, acceptance page signed by the former Associate Dean",
        "manual-001.jpg": "Cover of the approved Graduate School Operations Manual",
        "manual-003.jpg": "Operations Manual, contents", "manual-109.jpg": "Operations Manual, sign-off page"}
for fn, alt in docs.items():
    shutil.copy("%s/%s.jpg" % (RAW, key(alt)), "%s/docs/%s" % (A, fn))
shutil.copy("%s/%s.png" % (RAW, key("Sign-off table of the Operations Manual with names, dates and signatures")), A + "/docs/manual-signoff.png")
for rnd in (1, 2):
    for p in range(1, 13):
        k = (p - 1) // 3
        alt = "UAT form, Round %d (pages %d to %d), page %d" % (rnd, k * 3 + 1, k * 3 + 3, p)
        shutil.copy("%s/%s.jpg" % (RAW, key(alt)), "%s/docs/r%d-%03d.jpg" % (A, rnd, p))
# screens (in deck order) and the two check marks
screens, ticks = [], {}
for slide in Presentation(DECK).slides:
    for shp in slide.shapes:
        if shp.shape_type != 13:
            continue
        alt = shp._element.nvPicPr.cNvPr.get("descr") or ""
        if alt == "Done":
            ticks[hashlib.sha1(shp.image.blob).hexdigest()] = shp.image.blob
        elif alt.endswith(" screen") and shp.image.size == (1000, 625):
            cap = alt[:-7]
            fn = "%s/screens/%s.jpg" % (A, key(cap))
            if not os.path.exists(fn):
                open(fn, "wb").write(shp.image.blob)
            if (fn, cap) not in screens:
                screens.append((fn, cap))
json.dump(screens, open(A + "/screens.json", "w"))
import io
for blob in ticks.values():
    im = Image.open(io.BytesIO(blob)).convert("RGBA")
    r, g, b, a = im.getpixel((im.width // 2, im.height // 6))
    name = "tick-emerald" if g > 150 else "tick-green"
    open("%s/%s.png" % (A, name), "wb").write(blob)
    print(name, (r, g, b, a))
print("screens:", len(screens), "docs:", len(os.listdir(A + "/docs")), "shots:", sorted(os.listdir(A + "/shots")))
