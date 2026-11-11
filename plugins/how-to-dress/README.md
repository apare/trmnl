# How to dress

Each morning, what the kids (3 to 9) wear today, from Montréal's weather between 8 h and 17 h: one mannequin per Dressing step, the Girls' alternative beside the first, a friendly line, the morning and afternoon temperatures and an hourly chart.

- `src/transform.js`: TRMNL runs `run(input)` on the polled Open-Meteo forecast; it returns the Outfit, the steps and the text. Every threshold is a constant at the top.
- `src/full.liquid`: displays what the transform returns. `src/shared.liquid` draws the clothes (rough icons until the real pictures exist) and the mannequin.
- `samples/*.json`: sample days in Open-Meteo's shape.

```sh
node --test plugins/how-to-dress/test/transform.test.js   # the rules, against the samples
node plugins/how-to-dress/samples/use.js pluie            # preview a sample day (or `live`)
bin/trmnlp serve how-to-dress
```

On the TRMNL account, How to dress is meant to be an Important Playlist item from 6:15 to 8:30.
