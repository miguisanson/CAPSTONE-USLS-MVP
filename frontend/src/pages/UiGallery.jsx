// Component gallery at /__ui (UI-SPEC section 4, "Component proof"). Dev and demo builds only: App.jsx registers
// the route when `import.meta.env.DEV` or VITE_UI_GALLERY === "1" (npm run e2e sets it). It is not in any sidebar.
// P1a shows the tokens and classes; each later packet adds its component below, with every variant and size
// plus a long-text case and an empty case, and extends e2e/ui-gallery.spec.js to match.
import { Search, Trash2 } from "lucide-react";
import * as UI from "../components/ui/index.js";
import { TONES, TONE_NAMES } from "../lib/tone";
import UiGalleryP1b from "./UiGalleryP1b.jsx";

const Z_SCALE = [
  ["z-header", "30", "sticky top bar"],
  ["z-drawer", "40", "side drawer"],
  ["z-modal", "100", "dialog"],
  ["z-confirm", "110", "confirm dialog over a dialog"],
  ["z-toast", "120", "toast"],
];

function Block({ id, title, children }) {
  return (
    <section data-gallery={id} className="card p-4 sm:p-5">
      <h2 className="section-title mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function UiGallery() {
  const exported = Object.keys(UI).sort();
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto max-w-page px-4 py-6 lg:px-6 lg:py-7 2xl:px-8 2xl:py-8" data-gallery="root">
        <div className="page-stack">
          <div>
            <p className="eyebrow">Design system gallery</p>
            <p role="heading" aria-level={1} className="page-title mt-1" data-gallery="page-title">
              UI gallery
            </p>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Every token, class and component of the Phase 5 design contract. Development and demo builds only.
            </p>
          </div>

          <Block id="type-scale" title="Type scale">
            <div className="space-y-3">
              <p className="page-title" data-type="page-title">page-title 24px: Student lifecycle</p>
              <h2 className="section-title" data-type="section-title">section-title 18px: Pending requests</h2>
              <h3 className="card-title" data-type="card-title">card-title 16px: Adviser appointment</h3>
              <p className="text-sm text-slate-700" data-type="body">body 14px: Running text, inputs, buttons and table cells.</p>
              <p className="meta" data-type="meta">meta 12px: Hints, timestamps, table headers and sublines.</p>
              <p className="micro" data-type="micro">micro 11px: Count bubbles and tiny tags.</p>
              <p className="eyebrow" data-type="eyebrow">eyebrow 12px: Field group label</p>
            </div>
          </Block>

          <Block id="buttons" title="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" data-btn="primary">Primary</button>
              <button type="button" className="btn-ghost" data-btn="ghost">Secondary</button>
              <button type="button" className="btn-danger" data-btn="danger">Danger</button>
              <button type="button" className="btn-icon" data-btn="icon" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" className="btn-icon text-red-600" data-btn="icon-danger" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
              <button type="button" className="btn-primary" disabled data-btn="disabled">Disabled</button>
            </div>
          </Block>

          <Block id="fields" title="Fields">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="gallery-input">Label</label>
                <input id="gallery-input" className="field-input" placeholder="16px on phones, 14px from sm up" data-field="input" />
              </div>
              <div>
                <label className="field-label" htmlFor="gallery-select">Select</label>
                <select id="gallery-select" className="field-input" data-field="select">
                  <option>One</option>
                  <option>Two</option>
                </select>
              </div>
            </div>
          </Block>

          <Block id="layout-tokens" title="Layout and z-index tokens">
            <div className="page-stack" data-gallery="page-stack">
              <div className="meta">page-stack: children are spaced gap-5.</div>
              <div className="meta">max-w-page: this page is capped at 1440px and centered.</div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Z_SCALE.map(([cls, value, use]) => (
                <li key={cls} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <span className={`relative ${cls} font-semibold`} data-z={cls}>{cls}</span>
                  <span className="meta ml-2">{value} - {use}</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="tones" title="Semantic tones (lib/tone.js)">
            <div className="flex flex-wrap gap-2">
              {TONE_NAMES.map((name) => (
                <span
                  key={name}
                  data-tone={name}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TONES[name].chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${TONES[name].dot}`} />
                  {name}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TONE_NAMES.map((name) => (
                <p key={name} className={`rounded-xl border px-4 py-3 text-sm ${TONES[name].notice}`}>
                  {name} notice
                </p>
              ))}
            </div>
          </Block>

          <UiGalleryP1b />

          <Block id="components" title="Components">
            <p className="text-sm text-slate-600" data-gallery="exports">
              Exported from components/ui/index.js: {exported.length ? exported.join(", ") : "nothing yet (stubs only; P1b to P1f add them)"}
            </p>
          </Block>
        </div>
      </main>
    </div>
  );
}
