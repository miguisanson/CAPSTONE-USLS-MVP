"""Makes deck v7 from the finished v6 file (no assets folder needed). usage: build_deck7.py <v6.pptx> <v7.pptx>

Owner 2026-11-19 (evening): slides are a 5-minute skim around a 30-minute live demonstration.
- Features are renumbered to the speaking order: Monitoring Sheet 1, Reports 2, Operations Manual 3, Business Rules 4,
  Policy Assistant 5, Panel Matching 6, Defense Scheduling 7, Google Calendar 8.
- Main run: title, scope, feature list, live demonstration, five UAT slides, conclusions, recommendations, thank you.
- The seven feature slides move behind "Thank you" as backup, in the new order.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from deckkit2 import Deck, rgb, DARK, LIGHT, LINE, MUTED, WHITE, EMERALD, ON_DARK, ON_DARK_SOFT

SRC, OUT = sys.argv[1], sys.argv[2]
prs = Presentation(SRC)
slides = list(prs.slides)
NEW = {6: 1, 7: 2, 8: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8}   # old feature number -> new feature number
inch = lambda v: Emu(v).inches


def set_text(shape, value):
    """replace the text but keep the first run's formatting"""
    runs = shape.text_frame.paragraphs[0].runs
    runs[0].text = value
    for extra in runs[1:]:
        extra._r.getparent().remove(extra._r)


# ---------------------------------------------------------------- slide 3: the eight cards, in the new order
s3 = slides[2]
G, CH = 0.2, 2.3
CW = (12.13 - 3 * G) / 4
cell = lambda n: (0.6 + ((n - 1) % 4) * (CW + G), 1.7 + ((n - 1) // 4) * (CH + G))
cur = None
for shp in s3.shapes:
    m = re.fullmatch(r"Feature (\d)", shp.name)
    if m:
        cur = int(m.group(1))
    if cur is None or inch(shp.top) > 6.6:      # header shapes come first; the legend sits under the cards
        continue
    (ox, oy), (nx, ny) = cell(cur), cell(NEW[cur])
    shp.left = shp.left + Inches(nx - ox)
    shp.top = shp.top + Inches(ny - oy)
    if m:
        shp.name = "Feature %d" % NEW[cur]
    elif shp.has_text_frame and shp.text_frame.text == str(cur) and abs(inch(shp.width) - 0.5) < 0.02:
        set_text(shp, str(NEW[cur]))
s3.notes_slide.notes_text_frame.text = (
    "These are the eight features added in Capstone 2. We will demonstrate them in the live system, in this order.\n\n"
    "Features 3 to 6 address the revisions required by the panel at the Capstone 1 defense. Features 1, 2, 7 and 8 are refinements.")

# ---------------------------------------------------------------- the seven feature slides: new numbers on the label, the tracker and the notes
for idx in range(3, 10):
    s = slides[idx]
    eyebrow = next(sh for sh in s.shapes if sh.name == "Eyebrow")
    old = [int(n) for n in re.findall(r"\d", eyebrow.text_frame.text.split(" OF ")[0])]
    new = sorted(NEW[n] for n in old)
    tail = eyebrow.text_frame.text.split(" · ", 1)[1]
    head = "FEATURE %d OF 8" % new[0] if len(new) == 1 else "FEATURES %d AND %d OF 8" % tuple(new)
    set_text(eyebrow, head + " · " + tail)
    shapes = list(s.shapes)
    for i, shp in enumerate(shapes):
        m = re.fullmatch(r"Feature (\d) marker", shp.name)
        if not m:
            continue
        on = int(m.group(1)) in new
        shp.fill.solid()
        shp.fill.fore_color.rgb = rgb(DARK if on else LIGHT)
        if on:
            shp.line.fill.background()
        else:
            shp.line.color.rgb = rgb(LINE)
            shp.line.width = Pt(0.75)
        shapes[i + 1].text_frame.paragraphs[0].runs[0].font.color.rgb = rgb(WHITE if on else MUTED)
    notes = s.notes_slide.notes_text_frame
    body = notes.text
    if len(old) == 1:
        body = body.replace("Feature %d," % old[0], "Feature %d," % new[0], 1)
    else:
        body = body.replace("Features %d and %d," % tuple(old), "Features %d and %d," % tuple(new), 1)
    notes.text = body

# ---------------------------------------------------------------- new slide: live demonstration (added at the end, moved into place below)
d = Deck.__new__(Deck)
d.prs, d.blank, d.cur, d.label, d.assets = prs, prs.slide_layouts[6], None, "", ""
d.dark("Live demonstration")
d.text(0.9, 0.9, 11, ["SYSTEM DEMONSTRATION"], size=13, bold=True, color=ON_DARK_SOFT, h=0.28)
d.text(0.9, 1.5, 11.5, ["Live demonstration"], size=44, bold=True, color=ON_DARK, h=0.85, name="Title")
d.text(0.9, 2.5, 11.5, ["The eight features added in Capstone 2, shown in the live system."], size=20, color=ON_DARK_SOFT, h=0.42)
order = ["Editable Monitoring Sheet", "Group views and reports", "Operations Manual", "Business rules in every workflow",
         "Policy library and assistant", "Explained panel matching", "Defense scheduling validation", "Google Calendar integration"]
for i, name in enumerate(order):
    c, r = divmod(i, 4)
    x, y = 0.9 + c * 6.0, 3.55 + r * 0.74
    d.num(x, y, i + 1, d=0.5, fill=EMERALD, color=DARK, size=17)
    d.text(x + 0.75, y, 5.0, [name], size=19, color=ON_DARK, h=0.5, anchor="m")
d.notes("We will now demonstrate the eight features in the live system, in this order.")

# ---------------------------------------------------------------- order: main run, backup feature slides, appendix
ids = list(prs.slides._sldIdLst)
live = ids[-1]
pick = lambda nums: [ids[n - 1] for n in nums]
new_order = pick([1, 2, 3]) + [live] + pick(range(11, 19)) + pick([8, 9, 10, 4, 5, 6, 7]) + pick(range(19, len(ids)))
assert len(new_order) == len(ids) and len(set(map(id, new_order))) == len(ids)
lst = prs.slides._sldIdLst
for el in ids:
    lst.remove(el)
for el in new_order:
    lst.append(el)

prs.save(OUT)
print("slides:", len(prs.slides))
for n, s in enumerate(prs.slides, 1):
    title = next((sh.text_frame.text.replace("\n", " ") for sh in s.shapes if sh.name == "Title"), "?")
    eyebrow = next((sh.text_frame.text for sh in s.shapes if sh.name == "Eyebrow"), "")
    if n <= 20:
        print("%2d | %s | %s" % (n, eyebrow, title))
