# CF Themer – Themes & Custom Contests for Codeforces

Sleek dark themes, focus mode, and custom mashup contests for [Codeforces](https://codeforces.com).

*Unofficial: CF Themer is not affiliated with, endorsed by, or produced by Codeforces.*

## Themes
Monokai · Dracula · Pure Black · **Lock-In** — plus *Default (off)*.

Every theme follows the same design rules: neutral surfaces, **one accent** that marks where you are (active tab, panel and section titles, hover, solved problems), **one failure colour** for rejected verdicts, and links in the normal text colour. All text clears 4.5:1 contrast on every surface.

**Lock-In** is the focus variant: pure black, white/grey text and a single red accent, with square corners, no shadows and no motion.

## Features
- Full-site theming: header, menus, tables, sidebar, blogs, problem statements, standings and syntax-highlighted code
- Solved / attempted problem rows highlighted green / red
- Readable sample tests and math; the white logo is blended into the page
- **Readability guard:** the extension checks what is actually on screen and repairs light boxes, light borders, pale heatmap cells and text that is too dark for the active theme (hue preserved). It also covers pop-ups that appear later, such as the rating-graph tooltip.
- Sample-test text size
- Hide problem **tags**, **difficulty** and **solved counts** for spoiler-free practice
- **Problem timer & notes:** every problem page gets a small timer (it runs while the tab is visible) and a notepad, both kept per problem
- **Focus mode** (**Alt+Shift+F**): on problem pages, hides everything except the statement; **Alt+Shift+F** or the "Exit focus" button brings it back
- **Mashup contests:** pick tags, a rating range, a problem count and optional filters (exclude solved, avoid earlier mashups, one problem per contest, contest length). CF Themer builds a contest of increasing difficulty from the Codeforces problemset, starts a countdown that follows you across Codeforces pages, hides tags and difficulty while it runs, and scores it from your submissions (solved count and ICPC-style penalty). **Share codes:** every contest has a short code (`CFX-…`) you can send to friends; pasting it under "Have a share code?" loads the same problems and length, and finished contests keep their code so you can replay or share them later
- Floating ◐ switcher on every page, and **Alt+Shift+T** to cycle themes
- Printing keeps the site's normal look (themes are screen-only)
- Settings sync across your signed-in browsers

## Install (unpacked)
1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Open Codeforces.

Works on Chromium browsers (Chrome, Edge, Brave) version 111+.

## Add your own theme
Open `themes.js`, copy a theme block, change its `id`, `name` and colours (each key is documented at the top of the file), then reload the extension.

## Privacy
CF Themer has no servers, no accounts, no analytics and no ads: **the developer receives no data**. Settings are kept with `chrome.storage.sync` (plus a small copy in the page's local storage to avoid a flash of the default theme). Problem timers and notes are kept with `chrome.storage.local` on this device only.

The mashup builder is the only part that talks to the network, and only to the public Codeforces API (`https://codeforces.com/api/`). **It asks for your agreement first**, on its own page, before it reads your Codeforces handle or your submissions. Your handle, solved/tried lists, mashup history, contests and share codes are stored with `chrome.storage.local` on this device. A "Your data" section on the builder page deletes all of it, and can also withdraw your agreement.

The full policy is in [`PRIVACY.md`](PRIVACY.md). Store-submission notes are in [`STORE_LISTING.md`](STORE_LISTING.md).

## Known limits
Codeforces changes its markup occasionally; if an element looks wrong, please open an issue with the element's class name (right-click → Inspect).

## License
MIT — see `LICENSE`.
