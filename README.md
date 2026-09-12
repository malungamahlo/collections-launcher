# Collections Launcher

A Chrome/Chromium browser extension that organizes websites into purpose-based collections and launches them from a custom new-tab dashboard. It's local-first: everything is stored with `chrome.storage.local`, no account is required, and nothing is sent to a server.

## Features

- **New-tab dashboard** — a fixed-viewport view of all your collections, with an internally-scrolling list per collection so long lists never push other collections out of view.
- **Toolbar popup capture** — save the page you're currently on into an existing or brand-new collection without leaving it. Reachable entirely by keyboard via `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac), since a pinned toolbar icon can't otherwise be reached by Tab.
- **Full collection and resource management** — create, rename, edit, and delete collections and the resources inside them. Collection names are unique across your dashboard, and a resource's name and URL are each unique within its collection, so accidental duplicates are caught immediately with a clear message.
- **Drag and drop** — reorder the resources within a collection, reorder collections themselves, or drag a resource from one collection into another (including one with no resources yet). Fully usable from the keyboard.
- **Search** — filter by collection name, resource name, or domain.
- **Open all** — launch every resource in a collection as tabs in one click.
- **Export and import** — export a single collection as a `.collectionLauncher` file and send it to yourself or someone else however you like, then import it back through a preview step that shows exactly what will be added before anything is saved. Malformed or unsupported files are rejected safely, and invalid or duplicate entries inside an otherwise-valid file are skipped and reported rather than failing the whole import.

## Installing the extension

This extension isn't published to the Chrome Web Store yet, so it's loaded unpacked from a local build.

1. Download or clone this repository.
2. Install dependencies and build the production output:
   ```
   npm install
   npm run build
   ```
   This produces `.output/chrome-mv3`.
3. In Chrome or another Chromium-based browser, go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
6. Open a new tab — you should see the Collections Launcher dashboard.

### Permissions

The extension requests only two permissions:

- `storage` — to save your collections locally.
- `activeTab` — to read the page you're on only when you invoke the popup.

It does not request access to your browsing history, bookmarks, or any specific website.

## Development

```
npm install
npm run start
```

`npm run start` launches a managed Chromium instance with the extension loaded and live-reloading, and keeps local storage across restarts. On Windows, use `npm.cmd` instead of `npm` if your shell blocks the `npm.ps1` script shim.

Other useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev:samples` | Runs the dashboard against deterministic sample data instead of your real stored collections. |
| `npm run build` | Produces the production build in `.output/chrome-mv3`. |
| `npm run zip` | Packages the production build into a distributable `.zip`. |

## Testing

```
npm test        # run the full unit and component test suite once
npm run test:watch  # re-run tests on file changes
npm run lint     # run ESLint
npm run build    # type-checks the whole project, then produces a production build
```

Automated tests cover domain logic, storage, and component behavior, but they can't verify manifest or browser integration. Before relying on a build, also load it unpacked (see above) and manually check:

- Creating, editing, reordering, moving, and deleting both collections and resources.
- Searching by collection name, resource name, and domain.
- Saving the active page from the toolbar popup, including into a brand-new collection and onto a page that can't be saved (like a `chrome://` page).
- Exporting a real collection and inspecting the downloaded `.collectionLauncher` file, then re-importing it (into the same or a different profile) and confirming a faithful new collection with a preview step beforehand.
- Hand-editing an exported file to be malformed (broken JSON, wrong `format`, a future `schemaVersion`) or hostile (a `javascript:` URL, a duplicate entry) and confirming it's rejected or safely skipped, with no change to stored state.
- That your data is still there after fully restarting the browser.
- Every primary workflow using only the keyboard.

## Tech stack

Built with [WXT](https://wxt.dev), React, and TypeScript, styled with Tailwind CSS, with drag-and-drop provided by [dnd-kit](https://dndkit.com).

## License

MIT — see [LICENSE](LICENSE).
