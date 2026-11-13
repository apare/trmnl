# Mot du jour

Each day, one French word for the kids (3 to 9): its picture, the word in big letters (its first letter white in a black box, its silent letters in pale gray), its syllables (é · cu · reuil), a one-sentence definition written for them and an example sentence with the word in bold. Only the `full` Layout is designed; the other Layouts hold a one-line placeholder.

- `words.json`: the list, a reserve of 10 words per month, keyed by the month's French name (`janvier`…`décembre`). Each entry has its `word`, `silent` (the word with its silent letters between parentheses: `bon(h)omm(e) de neig(e)`), `article`, `syllables` (spoken syllables, the ones you clap, with the same parentheses; a one-syllable word shows none), `definition`, `example` (the word, or its plural, between asterisks: `On saute dans le tas de *feuilles*.`) and `picto`, the picture's id.
  - Silent letters are only letters with no sound: a final e, a final consonant you don't hear, a silent h, the e after é. Groups that make one sound stay black (qu, gu, ll, eau, -er, -et).
- `src/settings.yml`: `strategy: polling` of `words.json` on this repo's `main` branch (`raw.githubusercontent.com`). A change to the list reaches the Device once merged, without pushing the Plugin again (GitHub caches the file about 5 minutes).
- `src/full.liquid`: picks the word and draws it. The day is the account's local date (`days_ago` at `trmnl.user.time_zone_iana`), so the word changes at local midnight, not at 19 h when UTC turns. The month picks its reserve, and the day number picks the word in it: it changes every day, and each word shows 3 times in its month.

```sh
node --test plugins/mot-du-jour/test/*.test.js # the list: 10 words a month, fields, syllables, silent letters, example's word
bin/trmnlp test mot-du-jour                    # TRMNL X renders of this branch's list: local midnight, months, no overflow
bin/trmnlp serve mot-du-jour                   # polls main's words.json
```

## Pictures

For now, `picto` is the id of an [ARASAAC](https://arasaac.org) pictogram, linked from `static.arasaac.org`. They are to be replaced by our own drawings.
