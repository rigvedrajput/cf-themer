# CF Themer – Privacy Policy

**Effective date:** November 3, 2026 · **Applies to:** CF Themer 1.0.0 and later
**Developer / contact:** Rigved Rajput · cfthemer@gmail.com

CF Themer is an unofficial Chrome extension for codeforces.com. It is not affiliated with, endorsed by, or produced by Codeforces.

## Short version

- CF Themer has no servers and no accounts. **The developer receives no data from you.**
- Your settings, timers, notes and mashup data are stored **only in your browser**.
- The only network requests the extension makes go to the public Codeforces API (`https://codeforces.com/api/`), and only for the mashup builder.
- No analytics, no tracking, no advertising, no selling or sharing of data.
- The mashup builder asks for your agreement before it reads your Codeforces handle or submissions. You can delete everything, and withdraw your agreement, from the builder page.

## What the extension handles

| Data | What it is used for | Where it is kept | When |
|---|---|---|---|
| Settings: theme, sample size, option toggles | To apply your choices on Codeforces pages | `chrome.storage.sync` (Chrome may sync it across your own browsers if you use Chrome Sync, under Google's terms), plus a small copy in the local storage of codeforces.com pages so a page does not flash unthemed (that copy sits in the page's own storage, so Codeforces' scripts could technically read it; it holds only theme and option settings) | Always |
| Per-problem timer and notes | Timer and notepad on problem pages | `chrome.storage.local` on this device only (not synced) | When "Problem timer & notes" is on |
| Your Codeforces handle | To leave out problems you solved and to score your mashup contests | `chrome.storage.local` | Only after you agree in the mashup builder. The handle is read from the Codeforces page header while you are logged in, or typed by you |
| Your submissions | Read through the Codeforces API to know which problems you solved or tried, and to score a running contest. Only the resulting lists of solved/tried problem identifiers and the contest results are kept, not the submissions themselves | `chrome.storage.local` | Only after you agree |
| Mashup activity | Your form choices, the problems you were given (to avoid repeats), running and finished contests, share codes | `chrome.storage.local` | Only after you agree |
| Problemset copy | A copy of the public problem list, refreshed every 24 hours | `chrome.storage.local` | Only after you agree |

The extension also reads and restyles the Codeforces page you are on (for themes, focus mode and the contest panel). It does not copy page content anywhere, apart from the handle and the notes you type, as described above.

## Network requests

The mashup builder calls the public Codeforces API from your browser: the list of problems (`problemset.problems`) and, if you gave a handle, that user's submissions (`user.status`). These are ordinary requests to Codeforces over HTTPS; Codeforces' own privacy practices apply to them. The extension sends nothing to any other server.

## What CF Themer does not do

- It does not sell, rent or transfer your data to anyone.
- It does not use your data for advertising, profiling, credit or lending decisions, or anything unrelated to its purpose.
- It does not include analytics, telemetry, crash reporting or advertising code.
- It does not download or run remote code. All code ships inside the extension package.
- No person, including the developer, can read your data, because it never leaves your browser.

## Limited Use

The use of information received by CF Themer will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements. Data is used only to provide the extension's single purpose: improving Codeforces for practice with themes and practice tools.

## Your choices

- **Consent:** the mashup builder shows what it handles and waits for you to agree before it reads your handle or submissions. Without that, the builder stays off; themes, focus mode and the timer still work.
- **Timer and notes:** these need no agreement. Use **Reset** on the timer, clear the notes text, or uninstall the extension. "Delete my saved data" on the builder page removes them too.
- **Delete:** on the mashup builder page, "Delete my saved data" removes your handle, solved list, history, contests, share codes, timers and notes. "Delete it and withdraw consent" also removes your agreement.
- **Settings:** your theme and option choices can be reset by uninstalling the extension. Uninstalling removes the extension's stored data from your browser.
- **Chrome Sync:** whether settings sync between your browsers is controlled in Chrome's own sync settings.

## Retention

Data stays until you delete it or uninstall the extension. The problemset copy is refreshed every 24 hours and the solved/tried lists after 15 minutes.

## Security

Requests to Codeforces use HTTPS. Stored data sits in your browser profile and is protected by your browser profile and device, not by any extra layer from the extension.

## Changes

If the extension's data practices change, this policy will be updated and the change will be shown prominently in the extension before the new practice starts.

## Contact

Questions or requests: cfthemer@gmail.com
