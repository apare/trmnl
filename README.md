# TRMNL

Private Plugins for my [TRMNL X](https://trmnl.com), a 10.3" e-ink Device with 16 grays. A Private Plugin is one you write yourself, Liquid markup plus a data source, and TRMNL's servers render it. Each one is previewed locally with [trmnlp](https://github.com/usetrmnl/trmnlp) in Docker, then a GitHub Action pushes it to the TRMNL account. Terms (Plugin, Layout, Playlist…) are in [CONTEXT.md](CONTEXT.md).

## Plugins

- [How to dress](plugins/how-to-dress/): what the kids wear today, drawn as paper-doll mannequins, from Montréal's weather between 8 h and 17 h. Only the `full` Layout (the size that fills the whole Device) is designed; the other Layouts hold a one-line placeholder.
- [Mot du jour](plugins/mot-du-jour/): one French word a day for the kids, with its picture, syllables, a definition and an example, picked by the local date from a reserve per season. `full` Layout only.

## Commands

Docker is the only requirement; `bin/trmnlp` runs the pinned `trmnl/trmnlp` image.

```sh
bin/trmnlp login               # once: saves the TRMNL API key in ~/.config/trmnlp
bin/trmnlp new <slug>          # scaffold plugins/<slug>
bin/trmnlp serve <slug>        # preview on http://localhost:4567 (PORT=4568 for a second one)
bin/trmnlp lint <slug>
bin/trmnlp test <slug>         # the Plugin's tests/*_spec.rb, rendered in Firefox
bin/trmnlp push <slug>         # lints, then asks before overwriting the server copy
```

In the preview, pick "TRMNL X" and "16 Grays" once per port (1040×780).

After the first push of a Plugin, commit its `src/settings.yml`: it now holds the Plugin's id, and a push without it creates a new Plugin.

## CI

[`.github/workflows/trmnl.yml`](.github/workflows/trmnl.yml) lints and tests every Plugin on each pull request and push to `main`. On `main`, it then pushes each Plugin whose `src/` changed, with `--force`: a push overwrites the Plugin's settings on trmnl.com but leaves the Playlist (the schedule of Plugins the Device cycles through) alone. A manual run (Run workflow) pushes them all.

- The first push of a new Plugin stays local (above): the workflow refuses a Plugin with no `id:`.
- The `TRMNL_API_KEY` repository secret holds a `trmnl_` key with the content capability: `pbpaste | gh secret set TRMNL_API_KEY --repo <owner>/trmnl`. Pull requests from forks never receive it.

## Use it on your own TRMNL

Private Plugins need the Developer Edition add-on on your TRMNL account.

1. Fork this repo, then delete the `id:` line from each `plugins/<slug>/src/settings.yml`: those are my Plugins' ids, and without one the first push creates your own Plugin.
2. For How to dress, set your city's coordinates in `src/settings.yml` (see [its README](plugins/how-to-dress/README.md)). Its text is in French.
3. Run `bin/trmnlp login` with your TRMNL API key, then `bin/trmnlp push <slug>`, and commit the `settings.yml` that now holds your Plugin's id.
4. To push from the Action, add the `TRMNL_API_KEY` secret to your fork (above) and enable Actions in its Actions tab.
