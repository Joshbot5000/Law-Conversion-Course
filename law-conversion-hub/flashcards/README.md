# Flashcards

Every `.csv` file in this folder appears automatically as a deck in the **Flashcards** tab of your revision hub website.

## Format
Two columns, with this exact header row:

```
Question,Answer
What is an offer?,"A definite statement of terms, intended to be binding on acceptance."
```

Wrap any answer containing a comma in "double quotes". The CSV blocks Claude gives you at the end of each chapter are already in this format: paste one into a new file here and name it like `tort-ch04-economic-loss.csv` (module first, so decks group together).

## Adding a deck on GitHub
1. Open this `flashcards` folder on GitHub.
2. **Add file → Create new file**.
3. Name it, e.g. `criminal-ch05-murder.csv`.
4. Paste the CSV and click **Commit changes**.

## Also using Anki or Quizlet?
The same file imports into both. In Anki: **File → Import**, choose the CSV, set the separator to comma, and check the preview; if the header row shows up as a card, delete that one card. Because the deck lives here too, it's backed up and you can re-download it on any device.
