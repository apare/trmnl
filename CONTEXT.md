# TRMNL Plugins

A personal workspace for building custom content for a TRMNL e-ink device. Uses TRMNL's own vocabulary throughout.

## Language

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
