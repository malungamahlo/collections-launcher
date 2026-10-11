# Privacy Policy — Collections Launcher

Last updated: 2026-10-11

Collections Launcher does not collect, transmit, or sell any user data.

## What the extension stores

- The collections and resources (website names and URLs) that you create or import, including any bookmarks you choose to import.
- For each file you add to a collection from your computer (a PDF, Markdown, Word, Excel, or PowerPoint file): its name, type, and size, and a copy of the file itself, kept in the browser's local database. The original on your computer is read once, when you add it, and is never changed. The copy is deleted when you delete that file or its collection. (A file added with an earlier version was stored as a reference to the original instead; it is copied in the same way the next time the extension can read it.)
- For each file that arrives in a collection you **import**: the file itself, kept in the browser's local database in the same way. It is deleted when you delete that file or its collection.
- The extension asks the browser to treat this storage as persistent, so the browser does not clear your files on its own when the disk runs low. Removing the extension, or clearing its data, still deletes them.
- This data is stored only in your browser, using Chrome's local extension storage (`chrome.storage.local`) and the browser's local database (IndexedDB).

## What the extension does not do

- It does not send any data to an external server — there is no backend.
- It does not track or read your browsing history.
- It does not access page content beyond the title and URL of the tab you actively choose to save.
- It does not change, add, or delete any of your browser bookmarks. It reads them only when you choose **Import bookmarks**, and only the bookmarks you select are copied into your collections.
- It does not upload your files anywhere. A Markdown file, Word document, Excel workbook, or PowerPoint presentation you open in the browser is read and drawn by the extension on your device, not by an online service. Any picture or other resource such a file links to on the internet is not loaded, so opening it cannot tell anyone that you did.
- It does not send an exported collection anywhere. An exported `.collectionLauncher` file contains a copy of every file in that collection; it is saved as an ordinary download, and it goes only where you send it. It holds nothing about where those files live on your computer.
- It does not use analytics, tracking pixels, or third-party scripts.
- It does not require or support any account or sign-in.

## Permissions

- `storage` — used to save your collections and resources locally on your device.
- `activeTab` — used only when you invoke the extension's popup, to read the title and URL of the tab you're currently on so it can be saved.
- `bookmarks` — used only when you choose **Import bookmarks**, to read your bookmark folders so you can pick which bookmarks to turn into a collection. It is read-only: the extension never changes, adds, or deletes your bookmarks.

Three further permissions are **optional**. They are not granted when you install the extension; Chrome asks for them, and describes them as "Manage your downloads", only the first time you open a Word, Excel, or PowerPoint file in its own application. You can revoke them at any time from `chrome://extensions`.

- `downloads` and `downloads.open` — used only to open that file in the application installed on your computer. An extension cannot open a file where it already lives, so it writes a temporary copy into a folder of its own inside your Downloads folder, asks Chrome to open it, and deletes it again a couple of minutes later, or the next time the dashboard opens if the application still had it open. The copy is never sent anywhere. (A file you save with **Save a copy** is an ordinary browser download and needs neither permission.)
- `downloads.ui` — used only to keep Chrome's download bubble from appearing for that temporary copy. Chrome offers only one switch for this, which hides the download interface for the whole browser, so the extension turns it off just while the copy is being written and turns it back on straight after.

## Data sharing

Because no data ever leaves your device, none is shared with or sold to third parties.

## Changes to this policy

If this policy changes, the update will be reflected on this page with a new "Last updated" date.

## Contact

Questions or concerns? Open an issue at https://github.com/malungamahlo/collections-launcher/issues
