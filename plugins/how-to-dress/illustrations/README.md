# How to dress illustrations

The approved wardrobe drawings live in `wardrobe.js`: 22 clothing pieces, a white-skinned mannequin, short and long hair, and optional rear/front parts for hoods. Hands and footwear already contain the pair. Every drawing uses the same coordinates and the five e-ink tones.

The snow-pants bib keeps its original height, with straps reaching the shoulders. The neck warmer is one front piece that reaches the chin.

`preview/index.html` is the interactive wardrobe used to choose clothes and export a five-tone PNG. Open it locally, or serve this directory. It loads the same drawing source as the Plugin, so changes stay aligned.

After editing the drawings, regenerate the Liquid shipped to TRMNL:

```sh
node plugins/how-to-dress/illustrations/build.cjs
node --test plugins/how-to-dress/test/*.test.js
bin/trmnlp lint how-to-dress
```

`src/shared.liquid` is generated and committed. The Private Plugin renders it inline without a browser, JavaScript, image hosting, or the preview site. The regular mannequins use short hair and the Girls' alternative uses long hair. The existing dressing steps and weather rules choose the clothing.

To check all six local forecasts with TRMNL's Liquid renderer, prepare the inputs with `node plugins/how-to-dress/illustrations/render-samples.cjs`, then run `test/render.test.rb` in the pinned trmnlp image with this Plugin mounted at `/plugin`. The checks write HTML and individual mannequin SVGs under `_build/illustrations/` for visual inspection.
