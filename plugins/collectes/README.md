# Collectes

On the eve of a Collecte, a big picture of the bin to put out at the curb, and one order: "Sors les vidanges !" or "Sors le recyclage !". Nothing else, so the kids can read it from across the room. The other nights, the next bin waits in pale gray.

- `src/settings.yml`: the schedule lives in the Plugin's settings, editable in the TRMNL app. For each Matière (ordures, recyclage): any one date the truck comes, and how often (every week, every other week, never). The weekday and the alternation follow from the date.
- `src/transform.js`: TRMNL runs `run(input)` with those settings and nothing polled; it returns whether to put a bin out tonight, which one, and its image. The order shows from 15 h the day before until 8 h on the day; each rule is a constant at the top.
- `src/full.liquid`: displays what the transform returns. Only the `full` Layout is designed.
- `images/`: the two bins, realistic and seen from the side, as TRMNL fetches them from this public repo (pinned to a commit in `transform.js`). They were generated from `images/prompt.md` with an image model, then prepared with `node plugins/collectes/images/prepare.cjs <folder with ordures.png and recyclage.png>`; after a change, commit the images, then point `IMAGE_BASE` at that commit.

```sh
node --test plugins/collectes/test/*.test.js
bin/trmnlp serve collectes
```

Today's date is the clock plus the account's `utc_offset`, so the runtime's time zone doesn't matter. Holiday shifts (Christmas, New Year's Day) aren't handled: change the date in the settings for that week.
