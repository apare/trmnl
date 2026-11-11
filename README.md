# TRMNL

Private Plugins for a TRMNL X, previewed locally with [trmnlp](https://github.com/usetrmnl/trmnlp) in Docker and pushed to the TRMNL account. Terms (Plugin, Layout, Playlist…) are in [CONTEXT.md](CONTEXT.md).

## Plugins

- [How to dress](plugins/how-to-dress/): what the kids wear today, from Montréal's weather between 8 h and 17 h.

## Commands

Docker is the only requirement; `bin/trmnlp` runs the pinned `trmnl/trmnlp` image.

```sh
bin/trmnlp login               # once: saves the TRMNL API key in ~/.config/trmnlp
bin/trmnlp new <slug>          # scaffold plugins/<slug>
bin/trmnlp serve <slug>        # preview on http://localhost:4567 (PORT=4568 for a second one)
bin/trmnlp lint <slug>
bin/trmnlp push <slug>         # lints, then asks before overwriting the server copy
```

In the preview, pick "TRMNL X" and "16 Grays" once per port (1040×780).

After the first push of a Plugin, commit its `src/settings.yml`: it now holds the Plugin's id, and a push without it creates a new Plugin.

Only `full` is designed; the other Layouts hold a one-line placeholder.
