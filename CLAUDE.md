# Wilson Wong — website project

Personal website for Wilson Wong, public speaker and sales coach, with Cutco closing gifts.
Live at https://wilsonwongisepic.com (GitHub Pages, deployed from `main`, root folder).
This repo is also Wilson's GitHub profile repo, so `README.md` shows on his GitHub profile.

## Workflow: one GitHub issue per request

Wilson runs this site as a project. Every request is tracked as a GitHub issue ("thread").

1. **Before starting any request**, list the repo's issues (open *and* closed) and check whether it overlaps an existing one.
   - **Overlaps an open issue** → add a comment describing the new request and update its checklist.
   - **Overlaps a closed issue** → reopen it, comment with the new request, update the checklist.
   - **Genuinely new** → create a new issue: clear title, a "Request" section in plain words, and a task checklist.
   - A request that touches several areas can update more than one issue. Don't create duplicates.
2. Do the work on the session's assigned branch. Reference the issue number in each commit message (e.g. `Refs #4`).
3. Deliver through a pull request whose description says `Closes #N` for each issue it completes (`Refs #N` if only partly done). Wilson merges.
4. Tick checklist items as they're done. If something is waiting on Wilson (content, decisions, account settings), say so in the issue under "Waiting on Wilson" and use the `question` label.
5. In chat, tell Wilson which issue(s) the request went to, with links.
6. Pure questions that need no changes (e.g. "what is TTL?") don't need an issue unless Wilson asks.

Labels in use: `enhancement` (site features/changes), `question` (waiting on Wilson's input), `documentation` (project/process), `bug` (something broken).

Wilson is not a developer: explain things in plain language and give click-by-click steps for anything he must do on GitHub or his domain registrar.

## Site structure

- `index.html`: the whole site today (single page, inline CSS/JS, no build step)
- `images/`: `wilson-speaking.jpg` (2000px) and `wilson-speaking-1000.jpg` (phones); keep new photos optimised (JPEG ~80 quality, a ~1000px version for `srcset`)
- `CNAME`: `wilsonwongisepic.com`; **do not remove or change**, or the domain disconnects
- `.nojekyll`: serve files as-is

## Design system (keep consistent)

- Palette: forest green & cream
  - `--brand #2f6b4f`, `--brand-deep #1d4634`, `--cream #f6f0e3`, `--cream-deep #e7dbc2`, `--accent #a8844e`
  - `--ink #1d232a`, `--muted #5b636c`, `--white #fffdf9`
- Fonts: Fraunces (headings) + Inter (body), from Google Fonts
- Style: professional, simple, modern; rounded cards (14px radius), pill buttons, generous spacing
- Must work on phones (no sideways scrolling at 390px); check desktop (1280px) and phone widths with Playwright screenshots before delivering

## Content rules

- Don't invent testimonials, client names, logos, stats or prices. Use clearly marked placeholders.
- Don't use the Cutco logo. Keep the trademark note on gift content.
- Inspiration sources Wilson likes: John C. Maxwell, John Ruhlin (Giftology), Tony Robbins. Borrow ideas, never their wording, branding or layouts.
