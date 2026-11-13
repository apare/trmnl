# TRMNL Plugins

A personal workspace for building custom content for a TRMNL e-ink device. Uses TRMNL's own vocabulary throughout.

## Language

### TRMNL

**Device**:
The physical TRMNL e-ink display; here, a TRMNL X (10.3", 16 grays).
_Avoid_: Screen, display, frame

**Plugin**:
One unit of content TRMNL can show on the Device: a template plus a data source.
_Avoid_: Screen, widget, app

**Private Plugin**:
A Plugin you author yourself (Liquid markup + data strategy), rendered by TRMNL's servers.
_Avoid_: Custom screen, custom plugin

**Native Plugin**:
A first-party Plugin TRMNL provides ready-made (e.g. Google Calendar, Weather).
_Avoid_: Built-in, official plugin

**Recipe**:
A Private Plugin published for others to install.
_Avoid_: Template, shared plugin

**Layout**:
The size a Plugin renders at: full, half_horizontal, half_vertical or quadrant.
_Avoid_: View, size

**Mashup**:
Several Plugins combined onto one Device image, each in a smaller Layout.
_Avoid_: Dashboard, combo

**Playlist**:
The ordered, schedulable rotation of Plugins the Device cycles through.
_Avoid_: Rotation, carousel, loop

**Developer Edition**:
The one-time Device add-on that unlocks Private Plugins and the API.
_Avoid_: Dev mode, API license

### How to dress

**Outfit**:
The clothes How to dress recommends for one day, shared by every kid: one pick per Slot, where Base clothes may also carry a Girls' alternative.
_Avoid_: Clothes list, items

**Slot**:
A body area that gets exactly one pick in an Outfit (Top, Bottom, Legs, Warm layer, Coat, Outdoor pants, Head, Hands, Neck, Feet, Extra); "none" is a valid pick.
_Avoid_: Category, item type

**Outdoor window**:
The hours of the day whose weather decides the Outfit; Base clothes fit its warmest moment and Layers its coldest and wettest.
_Avoid_: School hours, day

**Wet hour**:
An hour of the Outdoor window that is likely to see rain or snow; each Wet hour is either rain or snow, never both.
_Avoid_: Rainy hour, precipitation hour

**Base clothes**:
The Slots worn all day that can't come off outside (Top, Bottom, Legs); they fit the warmest moment of the Outdoor window.
_Avoid_: Outfit (that's the whole set), underlayer

**Layer**:
A Slot that comes off or goes on during the day (Warm layer, Coat, Outdoor pants, Head, Hands, Neck, Feet); Layers fit the coldest and wettest moment of the Outdoor window.
_Avoid_: Outerwear, gear

**Girls' alternative**:
A second pick for Bottom and Legs (robe, or jupe + collants) that the girl kid wears on the How to dress page on days it exists; each real kid takes the one that fits them.
_Avoid_: Girl mode, variant

**Inside kid / Outside kid**:
The two mannequins on the How to dress page, a boy and a girl standing on the ground of the scene: on the left the Inside kid, wearing what stays on indoors (Base clothes and the Warm layer); on the right the Outside kid, wearing the whole Outfit. The boy and the girl swap every day. Each piece is named beside the kid, with a line to it. In the code, `kids`.
_Avoid_: Dressing step, stage, panel

### Mot du jour

**Entry**:
One word of `words.json` with everything the page shows for it: the word, its article, syllables, definition, example and picture.
_Avoid_: Card, item

**Reserve**:
The 10 Entries of one month; the local date's month picks the Reserve, and the day number picks the Entry in it.
_Avoid_: Pool, bucket, list (the list is all twelve Reserves)
