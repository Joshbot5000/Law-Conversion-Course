# Start here

You don't need to install anything or use a command line. Everything below happens on the GitHub website. Setup takes about 15 minutes, once.

## The words you'll see (ELI5)

| Term | What it means | Everyday analogy |
|---|---|---|
| **Repository ("repo")** | A project folder that lives on GitHub, with every past version of every file kept. | A lever-arch file that photocopies each page every time you change it. |
| **Commit** | Saving a change, with a short note saying what you changed. | Signing and dating an amendment to a document. |
| **Commit message** | The note attached to a commit, e.g. "Added Chapter 4 poster". | The "reason for change" line on a tracked-changes document. |
| **History** | The list of every commit to a file. Click **History** on any file to see how it changed over the term. | A court file's chronology. |
| **Markdown (`.md`)** | Plain text with light symbols for formatting: `#` for a heading, `**bold**`, `-` for a bullet. GitHub displays it neatly. | Writing "BOLD:" on a note so a typist knows how to format it. |
| **README** | The file GitHub shows automatically when you open a folder. | The cover sheet on a bundle. |
| **Branch (`main`)** | The main line of your files. You only need the one, called `main`. | The final, agreed version of a contract. |
| **GitHub Pages** | GitHub turning your repo into a website, so your revision hub opens on any phone or laptop. | Publishing your file so you can read it from anywhere. |
| **GitHub Actions / workflow** | A small robot that runs every time you commit. Yours re-indexes your posters and flashcards and republishes the website. | A clerk who re-paginates the bundle and updates the index whenever you add a document. |
| **CSV** | A spreadsheet saved as plain text: values separated by commas. Your flashcard decks use it. | A two-column table written out line by line. |

---

## Step 1: make an account
Go to **github.com**, choose **Sign up**, and follow the steps. Pick a professional username (it can appear on applications), e.g. `joshlando`.

## Step 2: create the repository
1. Click **+** (top right) → **New repository**.
2. Name it `law-revision` (no spaces).
3. Choose **Public** or **Private** (see "Public or private?" below).
4. Leave every box unticked (no README, no licence). Click **Create repository**.

## Step 3: upload these files
1. Unzip the download on your computer and open the `law-conversion-hub` folder.
2. On the new repo page, click the link **uploading an existing file**.
3. Select **everything inside** the folder (Ctrl+A on Windows, Cmd+A on Mac) and drag it onto the page. The folder structure is kept.
4. In the box at the bottom, write a commit message such as `Set up revision hub`, then click **Commit changes**.

## Step 4: switch on the website
1. In your repo, open **Settings** → **Pages** (left menu).
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

## Step 5: add the robot that builds the website
1. Go back to the **Code** tab and open the `setup` folder, then `revision-hub.yml`. Click the copy icon (two squares) to copy its contents.
2. Go back to the repo's main page and click **Add file → Create new file**.
3. In the name box type exactly: `.github/workflows/revision-hub.yml` (each `/` makes a folder).
4. Paste the contents into the big box and click **Commit changes** (twice, if asked).
5. Open the **Actions** tab. You'll see "Publish revision hub" running; a green tick means it worked (about a minute).
6. Back in **Settings → Pages**, your address is shown at the top, e.g. `https://joshlando.github.io/law-revision/`. Open it and bookmark it on your phone and laptop.

---

## Everyday use

**Add a poster:** open `posters/contract` (or the right module) → **Add file → Upload files** → drag the HTML file in → **Commit changes**. Name it with the chapter number, e.g. `ch04-remedies.html`, so the hub puts it in order. About a minute later it's on your website.

**Add a flashcard deck:** open `flashcards` → **Add file → Create new file** → name it e.g. `tort-ch04-economic-loss.csv` → paste the CSV block → **Commit changes**.

**Write or improve notes:** open any `.md` file and click the pencil icon to edit, or copy a file from `templates/`. When tutor feedback changes how you'd answer a problem question, edit the template and say why in the commit message.

**Find anything:** press `/` on GitHub to search every file, or `t` to jump to a file by name. The **Search** tab on your website searches every flashcard.

---

## Public or private?

- **Public:** the website works on a free account, and the repo can act as a portfolio for applications. Anyone can see the files, so only include work in your own words; don't upload University of Law course materials, slides, or textbook extracts.
- **Private:** only you can see the files, but the website feature for private repos needs GitHub Pro. Students can get Pro free through **GitHub Education** (education.github.com). Even then, the website itself is viewable by anyone who has its address.

A good compromise: keep this repo private for your revision, and later make a separate public repo for commercial-awareness explainers (the `career` folder shows the format).

## If something goes wrong

- **Website shows no posters:** open the **Actions** tab. A red cross means the last run failed; click it to see which step. Most often the `.github/workflows/revision-hub.yml` name has a typo, or Pages isn't set to **GitHub Actions**.
- **Site still shows old content:** wait a minute and refresh; the robot runs after every commit.
- **Progress missing on another device:** progress is saved per browser. Use **Settings → Download backup** on one device and **Restore backup** on the other.
