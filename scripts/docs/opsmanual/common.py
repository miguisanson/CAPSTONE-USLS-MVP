"""Shared helpers for the Graduate School Operations Manual content.

The manual is data first: every chapter is a plain dict, every business rule is
one ``Rule`` row.  ``scripts/docs/build_operations_manual.py`` renders the same
data three ways (Word, Markdown, JSON) so they cannot drift apart.

Status values (the only three allowed):
  Official - stated in the Handbook or the Research Protocol.
  Practice - described by Graduate School staff in a consultation (or recorded
             in the group's consultation notes as a stakeholder-confirmed
             answer) but not written in an official source.
  Proposed - the group's proposal where no source exists.
"""

from __future__ import annotations

from dataclasses import dataclass, field

OFFICIAL = "Official"
PRACTICE = "Practice"
PROPOSED = "Proposed"
STATUSES = (OFFICIAL, PRACTICE, PROPOSED)

HB = "Handbook 2022-2023"
RP = "Research Protocol AY2024-2025"
GN = "Group working notes"
PLAT = "Platform (current build)"


def H(loc: str) -> tuple[str, str]:
    """Handbook citation; ``loc`` is the printed page, e.g. 'p. 49'."""
    return (HB, loc)


def P(loc: str) -> tuple[str, str]:
    """Research Protocol citation; ``loc`` is a section / step reference."""
    return (RP, loc)


def C(when: str, what: str = "") -> tuple[str, str]:
    """Consultation citation, e.g. C('21 July 2026')."""
    return (f"Consultation {when}", what)


def N(loc: str) -> tuple[str, str]:
    """Group working notes (the Overall Document)."""
    return (GN, loc)


@dataclass
class Rule:
    rid: str
    text: str
    sources: list[tuple[str, str]]
    status: str
    process: str = ""
    process_num: str = ""

    def __post_init__(self) -> None:
        if self.status not in STATUSES:
            raise ValueError(f"{self.rid}: bad status {self.status!r}")
        if isinstance(self.sources, tuple):
            self.sources = [self.sources]

    def source_text(self) -> str:
        if not self.sources:
            return "No source found; group proposal"
        parts = []
        for doc, loc in self.sources:
            parts.append(f"{doc}, {loc}" if loc else doc)
        return "; ".join(parts)

    def page_text(self) -> str:
        pages = [loc for doc, loc in self.sources if doc == HB and loc.startswith("p")]
        return "; ".join(pages)


def R(rid: str, text: str, sources, status: str) -> Rule:
    if sources is None:
        sources = []
    elif isinstance(sources, tuple):
        sources = [sources]
    return Rule(rid, text, list(sources), status)


@dataclass
class Process:
    """One process chapter; every chapter has exactly the same layout."""

    num: str            # e.g. "4.4"
    key: str            # rule-id prefix, e.g. "WD"
    title: str
    purpose: str
    who: list[str]
    trigger: str
    preconditions: list[str]
    steps: list[tuple[str, str, str, str]]   # who, what, form/record, time limit
    rules: list[Rule]
    exceptions: list[str]
    records: list[tuple[str, str]]           # record, where it goes
    platform: str
    platform_diff: str
    extras: list[dict] = field(default_factory=list)   # {"title","header","rows"} or {"title","paras"}
    callout: str | None = None

    def __post_init__(self) -> None:
        for rule in self.rules:
            rule.process = self.title
            rule.process_num = self.num
