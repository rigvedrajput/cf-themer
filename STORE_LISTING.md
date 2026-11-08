# CF Themer – Chrome Web Store kit (v1.0.0)

Prepared against the official Chrome Web Store program policies, the Limited Use policy, the user-data FAQ, and the "Fill out the privacy fields" and "Complete your listing information" pages (read October 29, 2026). Policies change, so re-check the dashboard wording when you submit. Everything marked **YOU** needs your action.

Placeholders to fill: `Rigved Rajput`, `cfthemer@gmail.com`, `https://rigvedrajput.github.io/cf-themer/privacy.html`. They appear in `LICENSE`, `PRIVACY.md`, `privacy.html`, `mashup.js` and this file: use find-and-replace across the whole folder. `python build_zip.py` refuses to build while any remain.

---

## 1. Policy audit (what the code does vs what the policies ask)

| Requirement | Status |
|---|---|
| Post an accurate privacy policy if the product handles any user data. The FAQ says this applies even when data is only stored locally or in Chrome Storage Sync | `PRIVACY.md` is written and `privacy.html` is its web version. **YOU:** fill the placeholders, host `privacy.html` at a public URL (GitHub Pages works), paste the URL in the dashboard and in `PRIVACY_URL` in `mashup.js` |
| Prominent in-product disclosure and an affirmative action. The FAQ requires it when user data is handled in a way that is **not closely related to functionality described prominently in the listing and UI**, and says it must sit inside the product's UI, not only in the policy or store page | The mashup builder has a consent card ("I agree" / "No thanks"); handle detection and submission checks stay blocked until you agree. Strictly this is extra safety (the handle powers a feature the listing describes), but it also covers reading the handle from the page header, so keep it. Timer and notes do not need it, see risk 1 |
| Narrowest permissions | `storage`, plus host access only to `https://codeforces.com/api/*`. Content scripts run on `https://codeforces.com/*` and `https://*.codeforces.com/*` (https only) |
| Single purpose, narrow and easy to understand | Wording below. See risk 2 |
| No remote code (MV3) | Confirmed: no `eval`, no `new Function`, no external scripts. The extension fetches data (problem lists, submissions), never code |
| No obfuscation | Plain, readable source |
| Limited Use affirmative statement on a site you control | Included in `PRIVACY.md`. **YOU:** host it, and link it from the listing's homepage URL if you have one |
| No impersonation or implied endorsement by another company | Detailed description, README and policy say "Unofficial, not affiliated with Codeforces". Keep that sentence in the detailed listing |
| Listing: description, icon, at least one screenshot | Description below. **YOU:** icon and screenshots (section 5) |
| Privacy fields must match the policy and the real behaviour | Answers below were written from the actual code. Re-check if you change features |
| 2-Step Verification on the developer account | **YOU** |

---

## 2. Store listing tab

**Name:** CF Themer – Themes & Custom Contests for Codeforces (from the manifest)
**Summary (from manifest, 102 chars):** Customize Codeforces with sleek dark themes, focus mode, problem timers, and custom mashup contests!
**Category:** my suggestion is Productivity (Education is an alternative). The dashboard's category list is the authority.
**Language:** English

**Detailed description:**

> CF Themer makes Codeforces easier on the eyes and adds a few practice tools right on the site.
>
> THEMES
> Monokai, Dracula, Pure Black and Lock-In, a high-contrast focus theme. Switch from the toolbar popup, the floating ◐ button, or Alt+Shift+T. A readability guard repairs light boxes and text that is too dark for the active theme. Printing keeps Codeforces' normal look.
>
> PRACTICE TOOLS
> • Focus mode (Alt+Shift+F): show only the problem statement.
> • A timer and a notepad for every problem, saved on your device.
> • Hide tags, difficulty and solved counts for spoiler-free practice.
> • Sample-test text size.
> • Mashup contests: pick tags, a rating range and the number of problems. CF Themer chooses problems from the Codeforces problemset, runs a countdown, hides tags and difficulty while it runs, and scores the result from your submissions. Share a contest with friends using a short code.
>
> PRIVACY
> No accounts, no analytics, no ads. Settings, timers, notes and mashup data stay in your browser. The mashup builder asks for your agreement before it reads your handle or submissions, and it only talks to the public Codeforces API. Full policy: https://rigvedrajput.github.io/cf-themer/privacy.html
>
> CF Themer is an unofficial extension. It is not affiliated with, endorsed by, or produced by Codeforces.

**Graphics:** store icon 128×128, at least one 1280×800 screenshot (up to 5). Optional: 440×280 small promo tile, 1400×560 marquee tile, YouTube video.
**Homepage / support URL (optional):** a GitHub repo or page works. If you add a homepage, put the Limited Use statement there or one click away.

---

## 3. Privacy practices tab

**Single purpose description:**
> CF Themer improves the Codeforces website for practising competitive programming. It restyles Codeforces pages with dark themes and adds practice tools on those pages: focus mode, a per-problem timer and notes, spoiler hiding, and a mashup-contest builder that runs timed virtual contests from Codeforces problems.

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Saves the user's theme and option choices (`chrome.storage.sync`), and per-problem timers, notes and mashup data (`chrome.storage.local`) on the user's own device. |
| Host permission `https://codeforces.com/api/*` | Lets the mashup builder page download the public Codeforces problem list and, after the user agrees, read the user's own submission list from the official Codeforces API to leave out solved problems and score contests. No other site is contacted. |
| Content scripts on `https://codeforces.com/*` and `https://*.codeforces.com/*` (shown to users as site access) | Needed to apply the themes and to show the focus mode, timer and contest panel on Codeforces pages. The extension does nothing on other sites. |

**Remote code:** No, I am not using remote code.

**Data usage: types of data to disclose** (my recommendation; read each definition in the dashboard and answer for yourself, since you are the one certifying):
- Personally identifiable information: the Codeforces handle (a username).
- Website content: the handle read from the page header, and the submission list read from the Codeforces API.
- Leave unchecked: health, financial and payment, authentication, personal communications, location, web history, user activity, unless the dashboard's definition makes you think otherwise. When unsure, disclose more rather than less: the policy treats a mismatch between disclosures, policy and behaviour as the violation.

**Certifications (all three apply):**
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://rigvedrajput.github.io/cf-themer/privacy.html`

---

## 4. Test instructions for reviewers (paste into the dashboard)

> No account or login is needed. 1) Open https://codeforces.com and use the toolbar popup to switch themes; open any problem page and press Alt+Shift+F for focus mode. 2) To test the mashup builder, click "Create a mashup contest…" in the popup, press "I agree and continue", untick "Exclude problems I have solved" (that option needs a Codeforces handle; any public handle such as "tourist" also works), pick a few tags and press "Generate contest", then "Start contest". A countdown panel appears at the bottom of Codeforces pages. 3) "Delete my saved data" at the bottom of the builder page removes everything stored. The extension contacts only https://codeforces.com/api/.

---

## 5. Screenshots to take (real ones only: misleading screenshots violate policy)

1. A problem list page, Default vs a theme (side by side or two shots).
2. The mashup builder with tags selected and a generated contest.
3. A problem page with the contest panel open at the bottom.
4. Focus mode on a problem statement.
5. The consent card (shows the privacy-first design).

Capture them at 1280×800.

---

## 6. Before you press submit

- [ ] Developer account registered, **2-Step Verification on**, contact email verified, trader question answered honestly
- [ ] `icons/` folder with `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png` (exact sizes) next to `manifest.json`
- [ ] All placeholders replaced (see top of this file)
- [ ] `privacy.html` hosted and opening in a normal browser tab; that URL is in `PRIVACY_URL` (`mashup.js`) and in the dashboard
- [ ] `node mashup-core.test.js` prints "all mashup-core tests passed"
- [ ] `python build_zip.py` finished without errors and made `CF-Themer-<version>.zip` (runtime files only; docs and tests are left out)
- [ ] Load the **folder** unpacked once in Chrome and walk through your own test instructions (section 4)
- [ ] Store listing, privacy practices, distribution and test-instructions sections complete
- [ ] Screenshots are 1280×800 JPEG or 24-bit PNG without transparency

**Publishing an update later:** raise `version` in `manifest.json` (it must be higher than the live one), run `python build_zip.py`, then Package → Upload new package in the dashboard. If data handling changes, update `PRIVACY.md`, `privacy.html` and the privacy tab in the same release.

---

## 7. Judgement calls and risks (honest list)

1. **Timer and notes: no consent gate needed.** The FAQ says local-only storage does not remove the policy (so the privacy policy must cover them, and it does), but the prominent-disclosure step only applies to handling that is not closely related to a feature the listing describes prominently. The timer and notepad are listed features, their data never leaves the device, and the notes box says so at the point of use. Keep the listing description naming them. A reviewer could still disagree; if that happens, extending the consent card to them is a small change.
2. **Single purpose.** Themes plus practice tools plus a contest builder could be read as more than one purpose. I framed it as "improving Codeforces for practising". If a reviewer disagrees, the fallback is splitting the mashup builder into its own extension.
3. **Brand name.** The name contains "Codeforces". The disclaimer helps, but the policy bans implying endorsement and says visibility may drop if a rights holder objects. Renaming to something like "CF Themer: themes and practice tools" removes the question.
4. **Chrome Sync.** Settings sync through Chrome's own sync (stated in the policy).
5. **Nobody can promise approval.** Review is Google's decision.
