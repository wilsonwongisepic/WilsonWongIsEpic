# Word of the Year — Google Apps Script

This script is the backend for [wilsonwongisepic.com/woty](https://wilsonwongisepic.com/woty). It stores each submission in a Google Sheet, emails a one-page PDF, and serves the public community scroll.

The sheet and the script need to live in **executive.wilsonwong@gmail.com**. MailApp sends the PDF from the account that owns the script.

`WOTY_ENDPOINT` in `assets/js/woty.js` is the deployed web app. The page follows its redirect and posts as plain text. If that string is emptied, leads go to executive.wilsonwong@gmail.com through FormSubmit, the PDF is only the on-page download, and the scroll shows Wilson's example until a list is available.

## Deploy

1. Sign in to Google as **executive.wilsonwong@gmail.com**.
2. Create a spreadsheet named **WOTY 2026 Submissions**.
3. Open **Extensions → Apps Script**.
4. Select the sample code in `Code.gs` and delete it.
5. Paste the entire contents of `backend/woty-apps-script/Code.gs` from this repo. Save.
6. Click **Deploy → New deployment**.
7. Next to **Select type**, click the gear and choose **Web app**.
8. Description: `Word of the Year`.
9. **Execute as: Me**.
10. **Who has access: Anyone**.
11. Click **Deploy**. When Google asks you to authorize, choose the executive account and allow access to the spreadsheet and to send email.
12. Copy the web app URL. It ends in `/exec`.
13. In `assets/js/woty.js`, paste that URL between the quotes on the `WOTY_ENDPOINT` line.
14. Publish the site so GitHub Pages is serving the new `woty` page and `woty.js`.
15. Open `https://wilsonwongisepic.com/woty`, submit a test word to yourself, and confirm a row appears on the **Submissions** tab and the PDF arrives.

The first real submission creates the **Submissions** tab and its column titles. Do not rename that tab.

After you change the script later: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. Saving the editor does not update the live URL until you deploy a new version.

## Columns

| Column | What it means |
| --- | --- |
| Timestamp | When the row was saved. |
| First name | Optional. Blank if they skipped it. |
| Email | Only Wilson sees this. The public scroll never receives it. |
| Word | Their word. |
| Mission | Mission statement. |
| Vision | Vision statement. |
| Show publicly | `TRUE` or `FALSE`, from the checkbox. |
| Hidden | Leave blank. Type `TRUE` to hide a row yourself. |
| Flagged | Blank when the word passed. Otherwise `TRUE (profanity)`, `TRUE (negative)`, or `TRUE (ambiguous)`. |

The public scroll is the latest 50 rows where **Show publicly** is `TRUE`, **Hidden** is not `TRUE`, and **Flagged** is blank or `FALSE`.

## Words that are blocked, flagged, or allowed

The lists live in [`assets/data/woty-words.json`](../../assets/data/woty-words.json). The same JSON is pasted between the word markers in `Code.gs`. The checker itself is [`assets/js/woty-screen.js`](../../assets/js/woty-screen.js), pasted between the screen markers. A test fails if the copies drift.

It lowercases text, turns common lookalikes into letters (`0` `1` `3` `4` `5` `7` `@` `$`), strips everything else, and treats a letter repeated three or more times as one letter. Spaced or dotted letters (`k i l l`, `k-i-l-l`) are read as one word. A hit is a whole word, plus simple endings such as `-ing`, `-ed`, and `-s`. `classic`, `hello`, `skill`, `diet`, `grape`, `cocktail`, and `passion` are not matches.

Three lists:

- **profanity** — profanity and slurs. The form stops these with "Let's pick a word that lifts you up. Please choose a positive word." Mission or vision text gets "Let's keep this uplifting. Please rephrase anything harsh."
- **negative** — harsh words such as hate, revenge, kill, destroy, die, and worthless, plus close variants (killed, suicide, nazi, and so on). The form stops these the same way.
- **review** — ambiguous words that are allowed on the form: power, powerful, control, controlling, dominance, dominate, domination, money, rich, riches, ruthless, savage, beast, sex, sexual, sexy, toxic. A first name is not flagged for this list, so the name Rich still goes through.

If someone bypasses the form:

- Profanity or a negative word is still **saved**, the row is **highlighted red** (`#f4c7c3`), **Flagged** is `TRUE` plus the reason, and it is **left off the scroll**. **No PDF is emailed.** A mailed PDF never contains profanity or a blocked harsh word.
- A review word is saved, highlighted, and left off the scroll, and the **PDF is still emailed**, because the form would have allowed it.

Up to 5 submissions per email address per hour. A hidden company field is ignored so simple bots do not get a row.

## Approve or hide a row

- To put a flagged row on the scroll, set **Flagged** to `FALSE`. It still has to say `TRUE` in **Show publicly**, and **Hidden** has to stay blank (or anything other than `TRUE`). You can clear the red fill after you review it. The red is only a highlight.
- To keep any row off the scroll, even one that was never flagged, type `TRUE` in **Hidden**.

## Editing the lists

1. Edit `assets/data/woty-words.json`.
2. Paste that same JSON between `WOTY_WORDS_START` and `WOTY_WORDS_END` in `Code.gs` (replace the old JSON, leave the markers).
3. If you changed `assets/js/woty-screen.js`, paste that file between the screen markers the same way.
4. Deploy a **new version** of the web app.
5. Publish the site.

The page reads the JSON itself. The script does not fetch the site, so both copies have to move together.
