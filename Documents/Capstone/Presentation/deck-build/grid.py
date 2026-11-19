import sys, glob
from PIL import Image, ImageDraw
out, cols, rows, tw = sys.argv[1], 2, 2, 1000
files = sorted(glob.glob(out + "/s-*.jpg"))
for g in range(0, len(files), cols * rows):
    chunk = files[g:g + cols * rows]
    th = int(tw * 9 / 16)
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, rows * (th + 38) + 8), (34, 34, 34))
    dr = ImageDraw.Draw(sheet)
    for i, f in enumerate(chunk):
        x, y = 8 + (i % cols) * (tw + 8), 8 + (i // cols) * (th + 38)
        dr.text((x + 4, y + 8), "Slide %d" % (g + i + 1), fill="white")
        sheet.paste(Image.open(f).convert("RGB").resize((tw, th)), (x, y + 30))
    sheet.save("%s/grid-%02d.jpg" % (out, g // (cols * rows) + 1), quality=82)
print("grids:", (len(files) + 3) // 4)
