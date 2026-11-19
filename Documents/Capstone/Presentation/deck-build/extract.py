"""Pull every picture out of a deck this session built, named by its alt text. usage: extract.py <deck.pptx> <outdir>"""
import sys, os, re, json
from pptx import Presentation
from pptx.util import Emu
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
prs = Presentation(src)
seen, rows = {}, []
for n, slide in enumerate(prs.slides, 1):
    for shp in slide.shapes:
        if shp.shape_type != 13:
            continue
        alt = shp._element.nvPicPr.cNvPr.get("descr") or shp.name
        blob = shp.image.blob
        ext = shp.image.ext
        key = re.sub(r"[^a-z0-9]+", "-", alt.lower()).strip("-")[:70]
        if key in seen:
            continue
        seen[key] = 1
        fn = "%s.%s" % (key, ext)
        open(os.path.join(out, fn), "wb").write(blob)
        rows.append((n, alt, fn, shp.image.size))
for r in rows:
    print(r)
