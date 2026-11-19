"""Compare the text of the deck we built with the copy that came back from Google Slides. usage: gs_probe.py <ours.pptx> <google.pptx>"""
import sys, zipfile, re
from pptx import Presentation
ours, theirs = sys.argv[1], sys.argv[2]
def texts(path):
    out = []
    for s in Presentation(path).slides:
        row = []
        for shp in s.shapes:
            if shp.has_text_frame and shp.text_frame.text.strip():
                row.append(shp.text_frame.text)
        out.append(row)
    return out
A, B = texts(ours), texts(theirs)
print("ours slides:", len(A), "google slides:", len(B))
titles = lambda rows: [r[1] if len(r) > 1 else (r[0] if r else "") for r in rows]
print("google order:", [t[:38] for t in titles(B)][:24])
flatA = set(t for r in A for t in r)
diff = [t for r in B for t in r if t not in flatA]
print("texts that changed in Google's copy:", len(diff))
for t in diff[:40]:
    print("   ", repr(t[:110]))
z = zipfile.ZipFile(theirs)
names = [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml", n)]
x = z.read(sorted(names, key=lambda n: int(re.findall(r"\d+", n)[-1]))[1]).decode("utf8", "replace")
i = x.find("CAPSTONE")
print("eyebrow xml:", x[max(0, i - 700): i + 260])
fonts = set(re.findall(r'typeface="([^"]+)"', "".join(z.read(n).decode("utf8", "replace") for n in names)))
print("fonts in google copy:", sorted(fonts)[:20])
