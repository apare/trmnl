# How to dress

Each morning, what the kids (3 to 9) wear today, from Montréal's weather between 8 h and 17 h: an Inside kid and an Outside kid (the boy and the girl swap every day, the girl in the Girls' alternative), each piece named beside them with a line to it, in the approved D dashboard: the weather scene beside UV and air, Precipitation and Moon cards, with one temperature pill per hour over 24 hours and a daylight strip, and no title bar.

- `src/settings.yml`: two polling URLs, one per line: the Open-Meteo forecast, then its air quality (US AQI). With two URLs, TRMNL hands the transform `{ IDX_0: forecast, IDX_1: air quality }`.
- `src/transform.js`: TRMNL runs `run(input)` on the polled data (it also takes the forecast alone, as in the samples). Clothing uses only 8 h–17 h; the dashboard uses the full local day, cloud cover, CAPE, sunrise and sunset. The dashboard markup is computed server-side, including image layer order and chart coordinates.
- `src/full.liquid`: the full D Layout for TRMNL X (1040×780 CSS pixels), using the dashboard returned by the transform.
- `images/`: the 84 approved transparent PNG layers: mannequins, weather, month scenery and icons. URLs pin their Git commit so later changes cannot silently alter a deployed render.
- `src/shared.liquid` and `illustrations/wardrobe.js`: the earlier SVG wardrobe retained for its interactive editor; the deployed D dashboard uses PNG illustrations.
- `illustrations/preview/index.html`: the interactive wardrobe, with short or long hair and a PNG export. See [the illustration workflow](illustrations/README.md) to edit and regenerate the drawings.
- `samples/*.json`: sample forecast days in Open-Meteo's shape; `use.js` puts one under `IDX_0` and keeps the live air quality.

```sh
node --test plugins/how-to-dress/test/*.test.js           # weather rules and illustration layers
node plugins/how-to-dress/samples/use.js pluie            # preview a sample day (or `live`)
bin/trmnlp serve how-to-dress
```

On my TRMNL account, How to dress sits in the Playlist from 5:00 to 9:00, in turn with the other Plugins.

## Rendering and data

The UV and air card shows the day's max UV, rounded down, with its WHO word and the hours at UV 3 or more, and the day's worst US AQI (“Pas de données” when the air quality fetch fails). The Precipitation card lists up to two stretches of Wet hours over 0 h–23 h with their amount (mm of precipitation, or cm of snowfall when the stretch has snow), then the storm risk: a thunderstorm code (95, 96, 99) gives “Orage prévu”; else CAPE of 1000 J/kg or more in an hour with precipitation gives “Orage possible”. The light strip reads Open-Meteo sunrise/sunset; the astronomical fallback is for older local samples only. The light strip estimates brightness from sun position, clouds and precipitation. Moon phases and the next full moon use a mean synodic cycle (about ±1 day), with the next full moon labelled “vers le”. Season follows the forecast month; the ground follows precipitation and snow depth.

Check real Liquid with `node plugins/how-to-dress/illustrations/render-samples.cjs`, then run `test/render.test.rb` inside the pinned trmnlp image. The TRMNL X capture size is 1872×1404, composed on a 1040×780 canvas.

## Another city

The forecast comes from [Open-Meteo](https://open-meteo.com), which needs no API key. To use another city, change `latitude` and `longitude` in both URLs of `src/settings.yml`, update location/time zone in `dashboardOf` in `src/transform.js`, and update `time_zone` in `.trmnlp.yml` for the local preview.
