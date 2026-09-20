# Collections Launcher

A Chrome/Chromium MV3 extension (WXT + React + TypeScript, Tailwind, zod, dnd-kit,
vitest) that organizes resources into collections and launches them from a custom
new-tab dashboard. Local-first: everything lives in `chrome.storage.local`.

## Architecture reference — always apply

The standing guide for how code in this repo is structured (layers, feature-based
folders, hooks as the application layer, mapping at boundaries, strict typing,
naming). Follow it when adding or restructuring code.

@documentation/architecture/react-clean-architecture-practices-typescript.md

### How this codebase applies it

The guide is generic; this is the current shape of the repo, so the two are not
confused with each other.

- `src/features/collections/` — the **canonical domain** (`model/`, `hooks/`,
  `components/`, `storage/`, `test/`). Other modules depend on it; it imports
  nothing from `engine/` or `features/capture/` (it does use `shared/` UI
  primitives).
- `src/features/capture/` — toolbar-popup capture; uses the collections domain.
- `src/engine/portability/` — export/import engine (`model/`, `validation/`,
  `services/`, `hooks/`, `components/`, `test/`); uses the collections domain.
  Bookmark import lives here too, as another *source* feeding the same
  preview/apply pipeline as file import.
- `src/platform/browser/` — one adapter per browser API: an interface plus a
  `Browser*` implementation (tabs, active tab, file download, bookmarks).
  Application code depends on the interface; adapters and the storage
  repository are constructed once at module level in `entrypoints/*/App.tsx`.
  The only place `platform/` reaches
  into a feature is `active-tab.adapter.ts` importing the URL helper
  `website-url` from the collections model.
- `src/shared/` — generic UI primitives (`components/ui`), hooks, `lib`, styles.
  Imports nothing from `features/`, `engine/`, or `platform/`.
- `entrypoints/newtab`, `entrypoints/popup` — composition roots only.

Conventions: kebab-case filenames; `@app/` alias (= `src`) for every cross-module
import, relative imports only within a module; tests live beside the code as
`*.test.ts(x)` (component/hook tests start with `// @vitest-environment happy-dom`;
no jest-dom matchers — use plain assertions; browser APIs come from
`wxt/testing/fake-browser`, and overloaded ones are mocked with a cast).

## Commands

`npm test` (vitest), `npm run lint`, `npm run build` (`tsc --noEmit` then
`wxt build`), `npm run start` (managed Chromium with live reload). On Windows use
`npm.cmd` if the `npm.ps1` shim is blocked.

## Docs workflow

`plans/` and `documentation/` are gitignored and local.

- `plans/vN/` — living specs and checklists; edit them in place and keep each
  checklist's "Daily continuation record" accurate.
- `documentation/Logic Doc/vN/` — one numbered doc per phase or change. A phase
  doc stays an accurate snapshot of what that phase built; when later work
  changes the code it describes, add a forward-pointer note to the older doc
  rather than rewriting it.
- `README.md` and `PRIVACY.md` are user-facing and tracked: describe only what is
  actually implemented and shipped, never the roadmap.
