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
  `components/`, `storage/`, `services/`, `documents/`, `test/`). Other modules depend on it; it imports
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
  `platform/` reaches into a feature in only three places, all for
  collections-model helpers/types: `active-tab.adapter.ts` (the URL helper
  `website-url`) and `file-content.adapter.ts` / `indexeddb-file-content.store.ts`
  (the `ResourceId` type). File-resource bytes are stored through
  `file-content.adapter.ts` in IndexedDB, separate from `chrome.storage.local`;
  `file-picker.adapter.ts` wraps the File System Access picker.
- **Opening a file resource** (`hooks/use-file-resource-actions.ts` on the dashboard;
  `entrypoints/background.ts` + `services/serve-file-document.ts` for a PDF;
  `entrypoints/viewer` + `hooks/use-file-viewer.ts` + `components/file-viewer.tsx` for
  Markdown): the registry's viewer strategy decides. Files open **in the current tab**,
  the way a website does, so Back returns to the dashboard. They **never open in a pop-up
  dialog**, and the page holds **the document and nothing the app adds around it**
  (both are user rules).
  - **A PDF is the browser's own document**, the same as a PDF opened from disk. The tab
    goes to `/file/<id>/<file name>` (`model/file-document-location.ts`), and the
    extension's **service worker** answers it with the file itself. So Chromium's PDF
    viewer *is* the tab: the file's name is in its toolbar, its download button uses that
    name, and reload works. The address can't be `file://`, because a stored
    `FileSystemFileHandle` never reveals the path. The response is always
    `application/pdf` + `nosniff` + `no-store`, and only `native-pdf` resources
    are served. A worker cannot ask for a file permission, so the dashboard first calls
    `fileContent.load` from the click (it prompts if access has lapsed, and reads no
    bytes) and only then navigates. Anything the worker can't serve redirects to
    `viewer.html?resource=<id>&document=unavailable`, which shows the message or
    **Try again** and then returns to the document address. It frames the PDF only as a
    last resort, when the page can read the file but the worker could not.
  - **Markdown** renders on `viewer.html?resource=<id>` with **no header, kind/size,
    or Save a copy**: the tab title names it, and its dashboard row has Save a copy.
    `react-markdown` is fed untrusted input: raw HTML is dropped, only
    http/https/mailto links survive, images are never loaded, and only the first 200 KB
    is rendered. The renderer is `React.lazy`-loaded so it stays out of the entry
    chunk; keep it that way.
  - **Office files open in the browser by default** (a user rule, modelled on Teams and
    WhatsApp), **drawn locally**; nothing is uploaded, and the user chose this over
    Microsoft's online viewers. On `viewer.html`, a `.docx` becomes pages through
    `docx-preview`, drawn into a **shadow root** so the app's Tailwind reset and the
    document's styles never meet, then made safe by `documents/secure-rendered-document.ts`.
    A workbook (`.xlsx` and legacy `.xls`) goes through SheetJS (`xlsx`, installed from
    the cdn.sheetjs.com tarball because the npm copy is stale) into our own grid. A
    `.pptx` goes through **our own reader** (`documents/presentation-reader.ts`: JSZip + an
    injected XML parser, following slide → layout → master → theme) into positioned
    boxes. `pptx-preview` was tried and rejected: it dropped most text and is closed
    source. Readers live in `features/collections/documents/`, map library output to
    our own types at the boundary, cap sizes (`document-limits.ts`, `BROWSER_VIEW_MAX_BYTES`,
    zip-bomb budget in `office-package.ts`), and are `import()`-ed lazily, as each view
    is `React.lazy`-loaded. Keep all of them out of the entry chunk. Too large or damaged
    → `cannot-display` with "Open it in Word/Excel/PowerPoint from your collections".
    Tests parse XML with `@xmldom/xmldom`, because happy-dom can't do namespaced XML.
  - Legacy `.doc`/`.ppt` (a per-format `viewer` override in the registry) and unknown
    types open in the OS's own application (below). Every file row has a **⋯ "Open with…"
    menu** (`shared/components/ui/menu.tsx`, portalled and fixed-positioned so the
    card's clipping can't cut it off). From `getOpenOptions` it offers *Open in browser*,
    *Open in Word/Excel/PowerPoint* (`useFileResourceActions.openInApp`), and *Save a
    copy*. Don't add app-level chrome (a name, a save/download control, anything) around
    a file's document.
- **Copies of a user's files.** A locally added file is stored as a reference (a
  `FileSystemFileHandle`), never a stored duplicate; sync is planned and piled-up copies
  are unwanted. The one sanctioned copy is the **temporary one made to open an Office
  file in its own application** (`platform/browser/external-open.adapter.ts`): an
  extension cannot open a file in place, so it is written through `chrome.downloads` into
  a folder of its own inside Downloads, opened with `downloads.open`, and deleted by
  `cleanUp` once the app has let go of it. The user asked that this be **invisible** —
  Chrome's download bubble is hidden while it is written (`downloads.ui`), nothing says
  "download", and the one sentence shown says it is a temporary copy so nobody edits it
  believing it is the original. A copy that lasts exists only when the user presses
  **Save a copy** (an ordinary visible download through `FileDownloadAdapter`). Never make
  the hidden copy visible, and never keep one. Three optional permissions (`downloads`,
  `downloads.open`, `downloads.ui`) are asked for the first time an Office file is opened in its app,
  from the click itself; `downloads.open` also needs a click within ~5 seconds, hence the
  "ready — Open" fallback. (See `documentation/Logic Doc/v3/11-…`.)
- `src/shared/` — generic UI primitives (`components/ui`), hooks, `lib`, styles.
  Imports nothing from `features/`, `engine/`, or `platform/`.
- `entrypoints/newtab`, `entrypoints/popup`, `entrypoints/viewer`, `entrypoints/background`
  (the service worker) — composition roots only.

Conventions: kebab-case filenames; `@app/` alias (= `src`) for every cross-module
import, relative imports only within a module; tests live beside the code as
`*.test.ts(x)` (component/hook tests start with `// @vitest-environment happy-dom`;
no jest-dom matchers — use plain assertions; browser APIs come from
`wxt/testing/fake-browser`, and overloaded ones are mocked with a cast).

## Commands

`npm test` (vitest), `npm run lint`, `npm run build` (`tsc --noEmit` then
`wxt build`), `npm run build:e2e` (the same build with the downloads permissions granted
up front, for the Playwright tests), `npm run start` (managed Chromium with live reload).
On Windows use `npm.cmd` if the `npm.ps1` shim is blocked.

## End-to-end tests (Playwright)

Live **outside this repo**, in a sibling project:
`C:\Users\Malunga Mahlo\Documents\Malunga\Projects\playwright-tests` (Playwright +
TypeScript, its own `package.json`, not a git repo). They load the **built**
extension into a fresh throwaway Chromium profile per test — never the user's real
profile — so run `npm run build:e2e` here first (it writes `.output/chrome-mv3-e2e`,
identical to the shipped build except that the optional downloads permissions are
granted, because a test cannot click Chrome's permission prompt), then run the tests
from that folder. Tests that touch Office files use `helpers/downloads-api.ts`, which
records what the extension asks `chrome.downloads` to do and never lets `open` launch a
real application.

- **Test documents** come from
  `C:\Users\Malunga Mahlo\Documents\Malunga\Projects\Collection Notes\Tests` (today: a
  Markdown file, a PDF, a legacy Word `.doc`, and `generated-sample.docx/.xlsx/.pptx`,
  small files generated for the tests, not the user's own). A hostile `.docx` lives in
  `playwright-tests\office-fixtures`, never in the test folder. `tests/add-files.spec.ts` makes one
  test per supported file in that folder, so adding a file there adds a test.
- **Exported collections** are written to, and imported back from,
  `...\Collection Notes\Tests\exports` (a subfolder, so generated `.collectionLauncher`
  files never mix with the source documents). `paths.ts` defines all three paths and
  the env vars that override them: `EXTENSION_PATH`, `TEST_FOLDER`, `EXPORTS_DIR`.
- **Commands** (run in `playwright-tests`): `npm test`, `npm run report`,
  `npm run typecheck`, `npm run build:extension` (builds this repo); set
  `$env:HEADED = 1` to watch. `npx playwright install chromium` fetches the browser.
- **Playwright uses its bundled Chromium**, not Chrome — recent branded Chrome no longer
  honours `--load-extension`. The extension's ID is read from where
  `chrome://newtab/` redirects (its service worker only serves PDFs, so it may not be
  running at launch).
- **Playwright cannot operate the native file dialog** (`showOpenFilePicker`).
  `helpers/file-picker.ts` replaces it with a real Origin-Private-File-System handle for
  the test document. That exercises real IndexedDB storage of a handle, but **not the
  native dialog or which file types it lists** — verify that by hand.
- **Screenshots for the user to review** go to `playwright-tests\screenshots\<name>\`
  (each folder has an `INDEX.md` with captions), written by `helpers/screenshots.ts`;
  `tests/phase-g-verification.spec.ts` is the model (`phase-h-verification.spec.ts` also
  crafts hostile and oversized documents in a temp folder — never the test folder — and
  asserts that nothing was downloaded or fetched; `helpers/page-problems.ts` makes a test
  fail on any page error or `console.error`). When finishing a phase, verify it in
  real Chromium with a spec like that and **look at the screenshots yourself** — a passing
  assertion does not prove it looks right, and this found real bugs that unit tests
  (a fake DOM) could not: e.g. the native `<dialog>` focuses its *first focusable element*,
  so a form's `autoFocus` does not work inside a dialog.
- `test.fixme` in `export-import.spec.ts` records a standing requirement: an export must
  carry file resources' content, not just websites (V3 Part 3, not built yet).

## Docs workflow

`plans/` and `documentation/` are gitignored and local.

- `plans/vN/` — living specs and checklists; edit them in place and keep each
  checklist's "Daily continuation record" accurate.
- `documentation/Logic Doc/vN/` — one numbered doc per phase or change. A phase
  doc stays an accurate snapshot of what that phase built; when later work
  changes the code it describes, add a forward-pointer note to the older doc
  rather than rewriting it.
- **After completing a phase, always update the Logic Docs before calling it
  done:** write that phase's numbered doc (what it built, files, reasoning, tests,
  exit check, and anything not verified) and add forward-pointers to any older
  doc whose code it changed. Do this as part of the phase, not as a later
  follow-up, and update the plan checklist and its continuation record too.
- `README.md` and `PRIVACY.md` are user-facing and tracked: describe only what is
  actually implemented and shipped, never the roadmap.
