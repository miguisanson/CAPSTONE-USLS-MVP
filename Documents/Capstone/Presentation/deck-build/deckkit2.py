"""Small layout kit on top of python-pptx for the CAP-2521-IT defense deck."""
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.oxml.ns import qn
from lxml import etree
from PIL import ImageFont, Image

W, H = 13.333, 7.5
DARK, DARK2, GREEN, EMERALD = "0A3B2C", "13573F", "14804F", "25B36E"
MINT, PAGE, WHITE, LIGHT = "E3F2E9", "F3F8F5", "FFFFFF", "F4F8F6"
INK, TEXT, MUTED, LINE = "0F2A20", "2B3D36", "5E716A", "D3E3DA"
GOLD, GOLD_BG, GOLD_INK = "D99A1C", "FBF0D6", "6B4A05"
ON_DARK, ON_DARK_SOFT = "FFFFFF", "B5E0C8"
FONT = "Arial"
_AR = "/System/Library/Fonts/Supplemental/Arial.ttf"
_ARB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
_fonts = {}
WARN = []


def _f(bold):
    if bold not in _fonts:
        _fonts[bold] = ImageFont.truetype(_ARB if bold else _AR, 200)
    return _fonts[bold]


def text_w(s, size, bold=False):
    """width in inches of a string in Arial at `size` pt"""
    return _f(bold).getlength(s) * size / 200.0 / 72.0


def n_lines(s, size, bold, width):
    lines, cur = 1, 0.0
    space = text_w(" ", size, bold)
    for word in s.split():
        w = text_w(word, size, bold)
        if cur == 0:
            cur = w
        elif cur + space + w <= width:
            cur += space + w
        else:
            lines += 1
            cur = w
    return lines


def rgb(h):
    return RGBColor.from_string(h)


class Deck:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width, self.prs.slide_height = Inches(W), Inches(H)
        self.blank = self.prs.slide_layouts[6]
        self.cur = None
        self.label = ""
        self.assets = ""

    # ---------- slides
    def _new(self, label):
        self.cur = self.prs.slides.add_slide(self.blank)
        self.label = label
        return self.cur

    def light(self, icon, eyebrow, title, size=28, footer=True, tw=11.25):
        s = self._new(title)
        s.background.fill.solid(); s.background.fill.fore_color.rgb = rgb(WHITE)
        self.tile(0.6, 0.47, 0.68, icon)
        self.text(1.48, 0.46, 11.0, [eyebrow], size=11.5, bold=True, color=GREEN, h=0.24, name="Eyebrow")
        self.text(1.48, 0.74, tw, [title], size=size, bold=True, color=INK, h=0.56, name="Title")
        if footer:
            self.footer()
        return s

    def icon(self, x, y, d, key, color="white"):
        pic = self.cur.shapes.add_picture("%s/icons/%s-%s.png" % (self.assets, key, color), Inches(x), Inches(y), Inches(d), Inches(d))
        pic._element.nvPicPr.cNvPr.set("descr", "")
        pic.name = "Icon"
        return pic

    def tile(self, x, y, d, key, fill=DARK, color="white", radius=0.1):
        """the deck's recurring marker: an icon on a rounded square"""
        self.box(x, y, d, d, fill=fill, radius=radius, name="Icon tile")
        pad = d * 0.24
        self.icon(x + pad, y + pad, d - 2 * pad, key, color)

    def tag(self, x, y, label, fill=GOLD_BG, color=GOLD_INK, size=8.5, h=0.26, pad=0.12):
        w = text_w(label, size, True) + 2 * pad
        self.box(x, y, w, h, fill=fill, radius=0.05, name="Tag")
        self.text(x, y, w, [label], size=size, bold=True, color=color, align="c", h=h, anchor="m", check=False)
        return w

    def card(self, x, y, w, h, fill=LIGHT, line=LINE, radius=0.08, name=None):
        return self.box(x, y, w, h, fill=fill, radius=radius, line=line, name=name)

    def dark(self, label):
        s = self._new(label)
        f = s.background.fill
        f.gradient(); f.gradient_angle = 35
        st = f.gradient_stops
        st[0].position, st[1].position = 0.0, 1.0
        st[0].color.rgb, st[1].color.rgb = rgb("072E22"), rgb(DARK2)
        self.oval(9.6, -2.6, 6.6, 6.6, EMERALD, alpha=9)
        self.oval(-2.2, 4.9, 5.2, 5.2, EMERALD, alpha=7)
        return s

    def footer(self, dark=False):
        col = ON_DARK_SOFT if dark else MUTED
        self.text(0.6, 7.07, 9.0, ["CAP-2521-IT | Graduate Student Lifecycle Monitoring and Analytics Platform"], size=9, color=col, h=0.2, name="Footer", check=False)
        tb = self.cur.shapes.add_textbox(Inches(11.73), Inches(7.07), Inches(1.0), Inches(0.2))
        tb.name = "Slide number"
        tf = tb.text_frame
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]; p.alignment = PP_ALIGN.RIGHT
        fld = etree.SubElement(p._p, qn("a:fld"), {"id": "{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}", "type": "slidenum"})
        rpr = etree.SubElement(fld, qn("a:rPr"), {"lang": "en-US", "sz": "900"})
        sf = etree.SubElement(rpr, qn("a:solidFill")); etree.SubElement(sf, qn("a:srgbClr"), {"val": col})
        etree.SubElement(rpr, qn("a:latin"), {"typeface": FONT})
        t = etree.SubElement(fld, qn("a:t")); t.text = "‹#›"

    def notes(self, body):
        if os.environ.get("DECK_NO_NOTES"):   # preview copies only (Keynote is used here just to look at slides)
            return
        self.cur.notes_slide.notes_text_frame.text = body

    # ---------- text
    def text(self, x, y, w, paras, size=14, bold=False, color=TEXT, align="l", h=None, anchor="t", line=1.0, gap=6, italic=False, spc=None, name=None, check=True):
        """paras: list of str or list of runs [(text, {bold,color,size,italic})]. Returns the estimated height in inches."""
        est = 0.0
        for i, para in enumerate(paras):
            runs = [(para, {})] if isinstance(para, str) else para
            psize = max((o.get("size", size) for _, o in runs), default=size)
            any_bold = any(o.get("bold", bold) for _, o in runs)
            joined = "".join(t for t, _ in runs)
            lines = sum(n_lines(part, psize, any_bold, w) for part in joined.split("\n")) if joined else 1
            est += lines * psize * 1.17 * line / 72.0 + (gap / 72.0 if i else 0)
        box_h = h if h is not None else est
        if check and h is not None and est > h + 0.03:
            WARN.append("[%s] text needs %.2f in but box is %.2f: %r" % (self.label[:28], est, h, "".join(t for t, _ in ([(paras[0], {})] if isinstance(paras[0], str) else paras[0]))[:50]))
        tb = self.cur.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(box_h))
        if name:
            tb.name = name
        tf = tb.text_frame
        tf.word_wrap = True
        tf.auto_size = MSO_AUTO_SIZE.NONE
        tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
        tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
        for i, para in enumerate(paras):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
            p.line_spacing = line
            p.space_before = Pt(gap if i else 0)
            p.space_after = Pt(0)
            runs = [(para, {})] if isinstance(para, str) else para
            for t, o in runs:
                r = p.add_run()
                r.text = t
                ft = r.font
                ft.name = FONT
                ft.size = Pt(o.get("size", size))
                ft.bold = o.get("bold", bold)
                ft.italic = o.get("italic", italic)
                ft.color.rgb = rgb(o.get("color", color))
        return est

    # ---------- shapes
    def _finish(self, shp, fill, line, shadow, alpha, name):
        if fill is None:
            shp.fill.background()
        else:
            shp.fill.solid(); shp.fill.fore_color.rgb = rgb(fill)
            if alpha is not None:
                clr = shp._element.spPr.find(qn("a:solidFill")).find(qn("a:srgbClr"))
                etree.SubElement(clr, qn("a:alpha"), {"val": str(int(alpha * 1000))})
        if line:
            shp.line.color.rgb = rgb(line); shp.line.width = Pt(0.75)
        else:
            shp.line.fill.background()
        shp.shadow.inherit = False
        if shadow:
            self._shadow(shp._element.spPr)
        if name:
            shp.name = name
        return shp

    @staticmethod
    def _shadow(sppr, blur=14, dist=4, alpha=16):
        eff = sppr.find(qn("a:effectLst"))
        if eff is None:
            eff = etree.SubElement(sppr, qn("a:effectLst"))
        for c in list(eff):
            eff.remove(c)
        sh = etree.SubElement(eff, qn("a:outerShdw"), {"blurRad": str(int(blur * 12700)), "dist": str(int(dist * 12700)), "dir": "5400000", "algn": "t", "rotWithShape": "0"})
        c = etree.SubElement(sh, qn("a:srgbClr"), {"val": "0A3B2C"})
        etree.SubElement(c, qn("a:alpha"), {"val": str(alpha * 1000)})

    def box(self, x, y, w, h, fill=WHITE, radius=0.12, line=None, shadow=False, alpha=None, name=None):
        kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
        shp = self.cur.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
        if radius:
            shp.adjustments[0] = min(0.5, radius / min(w, h))
        return self._finish(shp, fill, line, shadow, alpha, name)

    def oval(self, x, y, w, h, fill, alpha=None, name=None):
        shp = self.cur.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(w), Inches(h))
        return self._finish(shp, fill, None, False, alpha, name)

    def num(self, x, y, n, d=0.36, fill=GREEN, color=WHITE, size=None):
        """number in a filled circle (the deck's recurring marker)"""
        self.oval(x, y, d, d, fill, name="Marker %s" % n)
        self.text(x, y, d, [str(n)], size=size or round(d * 36), bold=True, color=color, align="c", h=d, anchor="m", check=False)

    def tick(self, x, y, d=0.32, fill=GREEN, color=WHITE):
        """check mark in a filled circle: a small picture, so it imports the same in PowerPoint, Keynote and Google Slides"""
        name = "tick-emerald" if fill == EMERALD else "tick-green"
        pic = self.cur.shapes.add_picture("%s/%s.png" % (self.assets, name), Inches(x), Inches(y), Inches(d), Inches(d))
        pic._element.nvPicPr.cNvPr.set("descr", "Done")
        pic.name = "Check"

    def pill(self, x, y, label, fill=MINT, color=GREEN, size=10.5, pad=0.14, h=0.3, w=None, bold=True):
        w = w or text_w(label, size, bold) + 2 * pad
        self.box(x, y, w, h, fill=fill, radius=h / 2, name="Tag")
        self.text(x, y, w, [label], size=size, bold=bold, color=color, align="c", h=h, anchor="m", check=False)
        return w

    def hline(self, x1, y, x2, color=LINE, width=1.0):
        ln = self.cur.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y), Inches(x2), Inches(y))
        ln.line.color.rgb = rgb(color); ln.line.width = Pt(width)
        return ln

    def chevron(self, x, y, w=0.26, h=0.34, fill=EMERALD):
        shp = self.cur.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
        return self._finish(shp, fill, None, False, None, "Arrow")

    def image(self, path, x, y, w=None, h=None, shadow=True, alt="", border=False, crop=None):
        """crop = (l, t, r, b) fractions removed from each side"""
        iw, ih = Image.open(path).size
        if crop:
            iw, ih = iw * (1 - crop[0] - crop[2]), ih * (1 - crop[1] - crop[3])
        if w is None:
            w = h * iw / ih
        if h is None:
            h = w * ih / iw
        pic = self.cur.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))
        if crop:
            pic.crop_left, pic.crop_top, pic.crop_right, pic.crop_bottom = crop
        pic._element.nvPicPr.cNvPr.set("descr", alt)
        pic.name = alt[:40] or "Picture"
        sppr = pic._element.spPr
        if border:
            ln = etree.SubElement(sppr, qn("a:ln"), {"w": "9525"})
            sf = etree.SubElement(ln, qn("a:solidFill")); etree.SubElement(sf, qn("a:srgbClr"), {"val": "C9D6CF"})
        if shadow:
            self._shadow(sppr, blur=18, dist=5, alpha=20)
        return w, h

    def save(self, path):
        self.prs.save(path)
