Generate exactly two images with your built-in image generation tool, one call per image, and save them as PNG files in this folder:

- `raw/ordures.png`
- `raw/recyclage.png`

Both images are for a 16-gray e-ink display that a family with young kids reads from across the room. They must look like a matching pair: same bin model, same camera, same scale, same position.

Shared requirements for both images:
- Photorealistic product-style render of a residential wheelie bin (a ~240 L city wheeled cart, like the ones in Montréal), seen exactly from the side (pure profile, no perspective tilt).
- The handle and the two wheels are on the RIGHT side only (the handle side). On the left (the front), the bin rests on a small molded foot, no wheels there. The lid is hinged on the handle side.
- Square 1024×1024 canvas, pure white background (#FFFFFF), no floor, no cast shadow, no text, no logo, no watermark.
- The bin is centered and fills about 90 % of the canvas height.
- Rendered in grayscale only, with strong contrast and clear edges so it stays readable on e-ink.

Image 1, `raw/ordures.png` (garbage):
- The bin plastic is dark charcoal gray.
- The bin is overfull: a tied black garbage bag bulges out of the top and lifts the front of the lid, which stays hinged at the handle side.

Image 2, `raw/recyclage.png` (recycling):
- The bin plastic is light gray (a green recycling bin rendered in light gray).
- The lid is fully open, swung back over the handle side.
- A flattened cardboard box, a plastic bottle and a tin can stick out of the top.
- A large recycling symbol (three chasing arrows) is molded on the side of the bin.

When both files exist, reply with their paths and nothing else.
