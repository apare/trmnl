# How to dress

Each morning, what the kids (3 to 9) wear today, from Montréal's weather between 8 h and 17 h: one mannequin per Dressing step, the Girls' alternative beside the first, a friendly line, the morning and afternoon temperatures and an hourly chart.

- `src/transform.js`: TRMNL runs `run(input)` on the polled Open-Meteo forecast; it returns the Outfit, the steps and the text. Every threshold is a constant at the top.
- `src/full.liquid`: displays what the transform returns. `src/shared.liquid` draws the approved paper-doll mannequin and clothing, generated from `illustrations/wardrobe.js`.
- `illustrations/preview/index.html`: the interactive wardrobe, with short or long hair and a PNG export. See [the illustration workflow](illustrations/README.md) to edit and regenerate the drawings.
- `samples/*.json`: sample days in Open-Meteo's shape.

```sh
node --test plugins/how-to-dress/test/*.test.js           # weather rules and illustration layers
node plugins/how-to-dress/samples/use.js pluie            # preview a sample day (or `live`)
bin/trmnlp serve how-to-dress
```

On my TRMNL account, How to dress sits in the Playlist from 5:00 to 9:00, in turn with the other Plugins.

## Another city

The forecast comes from [Open-Meteo](https://open-meteo.com), which needs no API key. To use another city, change `latitude` and `longitude` in the `polling_url` of `src/settings.yml`; Open-Meteo returns the hours in that place's time zone (`timezone=auto`). Then replace "Montréal" in the title bar of `src/full.liquid`, and `time_zone` in `.trmnlp.yml` for the local preview.
