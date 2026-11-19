"""Makes deck v8 from the finished v7 file: wording only. usage: build_deck8.py <v7.pptx> <v8.pptx>

Owner rule 2026-11-19 (late): never say the Graduate School had no manual, and never say the group prepared it.
Say only that the Graduate School approved and signed it and that it is in Policy Documents.
"""
import sys
from pptx import Presentation

SRC, OUT = sys.argv[1], sys.argv[2]
prs = Presentation(SRC)

SHAPES = {
    "Prepared by the group; validated and signed by the Graduate School.":
        "Approved and signed by the Graduate School; available in Policy Documents.",
    "Operations Manual, validated and signed":
        "Operations Manual, approved and signed",
    "The Graduate School had no operations manual. The group prepared one; the Graduate School validated and signed it.":
        "The Graduate School approved and signed the Operations Manual. It is available in Policy Documents.",
    "Operations Manual prepared, validated, and signed":
        "Operations Manual approved and signed by the Graduate School",
}
NOTES = {
    "Feature 3, the Operations Manual. The Graduate School did not have an operations manual. Following the panel's "
    "suggestion, the group prepared one, and the Graduate School validated and signed it.":
        "Feature 3, the Operations Manual. The Graduate School approved and signed it. It is available in Policy "
        "Documents, with the Handbook and the Research Protocol.",
}
done = set()
for number, slide in enumerate(prs.slides, 1):
    for shape in slide.shapes:
        if shape.has_text_frame and shape.text_frame.text in SHAPES:
            old = shape.text_frame.text
            runs = shape.text_frame.paragraphs[0].runs
            runs[0].text = SHAPES[old]            # the first run keeps its formatting
            for extra in runs[1:]:
                extra._r.getparent().remove(extra._r)
            done.add(old)
            print("slide %d: %s" % (number, SHAPES[old]))
    if slide.has_notes_slide:
        frame = slide.notes_slide.notes_text_frame
        if frame.text in NOTES:
            old = frame.text
            frame.text = NOTES[old]
            done.add(old)
            print("slide %d notes: %s" % (number, NOTES[old]))
missing = [text for text in list(SHAPES) + list(NOTES) if text not in done]
assert not missing, missing
prs.save(OUT)
