#!/usr/bin/env python
"""Bring Section 5.10 (Screen Specifications) in step with the screens that exist (idempotent).

    python scripts/docs/sync_proposal_screens.py IN.docx OUT.docx

Reads the navigation of the running front end:
  * frontend/src/components/portalNav.jsx   the Dean, student and faculty portal pages (group, label, route)
  * frontend/src/components/Layout.jsx      the staff / coordinator navigation

and, with the wording in scripts/docs/proposal_screens.json,
  * inserts a Heading 3 entry for every staff-side screen added since the first version (Policy Documents,
    Business Rules, Form 1 Endorsements) before the Dean portal entry, and renumbers every 5.10.n heading;
  * renames 5.10 "Dean Approvals" to "Dean Portal" (the portal now has a sidebar of pages);
  * builds Tables 23.1, 23.2 and 23.3 (pages of the Dean, student and faculty portal) after the paragraph of each
    portal entry, replacing them when they exist.

It then prints every navigation label that Section 5.10 never mentions and every portal page without a sentence in
the JSON, so that a screen added later cannot silently stay undocumented.  Screens keep their figures; the new
entries have no screenshot (the screenshots are replaced separately).  Run after sync_proposal_inventories.py and
before build_proposal.py.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SCREENS = HERE / "proposal_screens.json"
PORTAL_NAV = ROOT / "frontend" / "src" / "components" / "portalNav.jsx"
LAYOUT = ROOT / "frontend" / "src" / "components" / "Layout.jsx"

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}
PORTAL_CONSTS = {"student": "STUDENT_NAV_GROUPS", "dean": "DEAN_NAV_GROUPS", "faculty": "FACULTY_NAV_GROUPS"}
RENAMES = {"Dean Approvals": "Dean Portal"}


def q(tag):
    return "{%s}%s" % (W, tag)


def parse_nav(text: str, const: str):
    """[(group, label, route, hide_when)] for `export const CONST = [ ... ];` in portalNav.jsx."""
    m = re.search(r"export const %s = \[(.*?)\n\];" % const, text, re.S)
    if not m:
        raise SystemExit(f"{const} not found in portalNav.jsx")
    out, group = [], None
    for line in m.group(1).splitlines():
        g = re.match(r'\s*label: "([^"]+)",\s*$', line)
        if g:
            group = g.group(1)
            continue
        for item in re.finditer(r'\{\s*to: "([^"]+)",\s*label: "([^"]+)"([^}]*)\}', line):
            hide = re.search(r'hideWhen: "(\w+)"', item.group(3))
            out.append((group, item.group(2), item.group(1), hide.group(1) if hide else None))
    return out


def parse_staff_labels(text: str):
    m = re.search(r"const NAV_GROUPS = \[(.*?)\n\];", text, re.S)
    return [re.sub(r"^\d+ · ", "", label) for label in re.findall(r'label: "([^"]+)", icon', m.group(1))] if m else []


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst")
    a = ap.parse_args(argv)

    from lxml import etree
    sys.path.insert(0, str(HERE))
    import add_business_rules_section as br

    data = json.loads(SCREENS.read_text(encoding="utf-8"))
    nav_text = PORTAL_NAV.read_text(encoding="utf-8")
    portals = {key: parse_nav(nav_text, const) for key, const in PORTAL_CONSTS.items()}
    staff_labels = parse_staff_labels(LAYOUT.read_text(encoding="utf-8"))

    with zipfile.ZipFile(a.src) as z:
        infos = z.infolist()
        parts = {i.filename: z.read(i.filename) for i in infos}
    root = etree.fromstring(parts["word/document.xml"])
    body = root.find(q("body"))

    def text_of(el):
        return "".join(t.text or "" for t in el.iter(q("t")))

    def style_of(el):
        s = el.find("w:pPr/w:pStyle", NS)
        return s.get(q("val")) if s is not None else ""

    def frag(xml):
        decl = " ".join(f'xmlns:{p}="{u}"' for p, u in root.nsmap.items() if p)
        return list(etree.fromstring(f"<root {decl}>{xml}</root>"))

    def section_bounds():
        kids = list(body)
        start = next(i for i, c in enumerate(kids) if c.tag == q("p") and style_of(c) == "Heading2"
                     and text_of(c).strip().startswith("5.10 Screen Specifications"))
        end = next(i for i in range(start + 1, len(kids)) if kids[i].tag == q("p") and style_of(kids[i]) == "Heading2")
        return start, end

    report = {}

    # ---- 1. new staff entries: remove earlier copies, insert before the Dean entry -----------------------
    titles = [e["title"] for e in data["new_staff_entries"]]
    start, end = section_bounds()
    kids = list(body)
    i = start + 1
    while i < end:
        el = kids[i]
        if el.tag == q("p") and style_of(el) == "Heading3" and re.sub(r"^5\.10\.\d+ ", "", text_of(el).strip()) in titles:
            body.remove(el)
            j = i + 1
            while j < end and not (kids[j].tag == q("p") and style_of(kids[j]) in ("Heading1", "Heading2", "Heading3")):
                body.remove(kids[j])
                j += 1
            i = j
        else:
            i += 1
    start, end = section_bounds()
    kids = list(body)
    dean = next(c for c in kids[start:end] if c.tag == q("p") and style_of(c) == "Heading3"
                and re.sub(r"^5\.10\.\d+ ", "", text_of(c).strip()) in ("Dean Approvals", "Dean Portal"))
    for e in data["new_staff_entries"]:
        xml = br.heading(3, "5.10.0 " + e["title"]) + br.body_para(e["text"])
        for el in frag(xml):
            dean.addprevious(el)
    report["new_staff_entries"] = len(data["new_staff_entries"])

    # ---- 2. renames and renumbering of the 5.10.n headings ------------------------------------------------
    start, end = section_bounds()
    n = 0
    for el in list(body)[start + 1:end]:
        if el.tag == q("p") and style_of(el) == "Heading3":
            n += 1
            txt = text_of(el).strip()
            title = re.sub(r"^5\.10\.\d+ ", "", txt)
            title = RENAMES.get(title, title)
            ts = list(el.iter(q("t")))
            ts[0].text = f"5.10.{n} {title}"
            for t in ts[1:]:
                t.text = ""
    report["headings"] = n

    # ---- 3. portal page tables -----------------------------------------------------------------------------
    missing = []
    for key, spec in data["portal_tables"].items():
        start, end = section_bounds()
        kids = list(body)
        anchor = next((c for c in kids[start:end] if c.tag == q("p") and text_of(c).strip().startswith(spec["after"])), None)
        if anchor is None:
            raise SystemExit(f"anchor paragraph not found for the {key} portal: {spec['after']!r}")
        cap_prefix = spec["caption"].split(".")[0] + "." + spec["caption"].split(".")[1]  # "Table 23.1"
        for c in list(body):
            if c.tag == q("p") and style_of(c) == "Heading5" and text_of(c).strip().startswith(cap_prefix + "."):
                nxt = c.getnext()
                after = nxt.getnext() if nxt is not None and nxt.tag == q("tbl") else None
                if nxt is not None and nxt.tag == q("tbl"):
                    body.remove(nxt)
                if after is not None and after.tag == q("p") and not text_of(after).strip() and style_of(after) == "":
                    body.remove(after)
                body.remove(c)
        rows = []
        for group, label, route, hide in portals[key]:
            desc = data["portal_pages"].get(route)
            if not desc:
                missing.append(route)
                desc = "Description pending."
            shown = label + (" (only where it applies)" if hide else "")
            rows.append([[[(shown, "b")], [(group, "sg")]], [[route]], [[desc]]])
        xml = br.caption(spec["caption"]) + br.table(["Page", "Route", "What the page shows"], rows,
                                                      [2500, 2500, 4360], size=18) + br.spacer()
        cursor = anchor
        for el in frag(xml):
            cursor.addnext(el)
            cursor = el
    report["portal_pages"] = {k: len(v) for k, v in portals.items()}

    # ---- 4. coverage check -----------------------------------------------------------------------------------
    start, end = section_bounds()
    # paragraphs only: the portal page tables (which repeat labels such as Defense Calendar) do not count
    blob = "\n".join(text_of(c) for c in list(body)[start:end] if c.tag == q("p")).lower()
    unmentioned = [lab for lab in staff_labels if lab.lower() not in blob
                   and lab.lower().replace(" & ", " and ") not in blob and lab.lower().split(" (")[0] not in blob]
    report["staff_labels_not_mentioned_in_5.10"] = unmentioned
    report["portal_pages_without_description"] = missing

    parts["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    with zipfile.ZipFile(a.dst, "w", zipfile.ZIP_DEFLATED) as z:
        for info in infos:
            z.writestr(info, parts[info.filename])
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
