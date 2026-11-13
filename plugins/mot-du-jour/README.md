# Mot du jour

Each day, one French word for the kids (3 to 9): its picture, the word in big letters, its syllables (é · cu · reuil), a one-sentence definition written for them and an example sentence. Only the `full` Layout is designed; the other Layouts hold a one-line placeholder.

- `words.json`: the list, one reserve of words per season (winter: December–February, spring: March–May, summer: June–August, autumn: September–November). Each entry has its `word`, `article`, `syllables` (spoken syllables, the ones you clap), `definition`, `example` and `picto`, an [ARASAAC](https://arasaac.org) pictogram id.
- `sync-words.cjs`: copies `words.json` into `static_data` of `src/settings.yml`, the data TRMNL hands to the markup (`strategy: static`, no polling, no transform). Run it after each edit of the list.
- `src/full.liquid`: picks the word and draws it. The day is the account's local date (`days_ago` at `trmnl.user.time_zone_iana`), so the word changes at local midnight, not at 19 h when UTC turns. The month picks the season's reserve, and the day number picks the word in it: it changes every day and comes back once the reserve has gone round.

```sh
node plugins/mot-du-jour/sync-words.cjs        # after editing words.json
node --test plugins/mot-du-jour/test/*.test.js # the list: fields, syllables, settings.yml in sync
bin/trmnlp test mot-du-jour                    # TRMNL X renders: the day's word, local midnight, seasons, no overflow
bin/trmnlp serve mot-du-jour
```

## Pictures

The pictograms are ARASAAC's, linked from `static.arasaac.org` (none is copied here), and each page credits them: Sergio Palao, ARASAAC (CC BY-NC-SA), owned by the Government of Aragón. They may not be used commercially. To find one: `https://api.arasaac.org/v1/pictograms/fr/search/<mot>`.
