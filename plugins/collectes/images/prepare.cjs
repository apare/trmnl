'use strict';
// Prepares the bins Codex generated (raw/*.png) for the 16-gray TRMNL X:
// grayscale, near-white background to pure white, crop to the bin, scale to 700 px high,
// 16 gray levels; plus a pale copy for the nights when the bin waits.
// Usage: node plugins/collectes/images/prepare.cjs <raw dir> (writes next to this file)
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const core = process.env.PLAYWRIGHT_CORE || path.join(execSync('npm root -g').toString().trim(), '@playwright/cli/node_modules/playwright-core');
const { chromium } = require(core);
const rawDir = path.resolve(process.argv[2] || path.join(__dirname, 'raw'));
const out = __dirname;
const HEIGHT = 700;
const PALE = 0.3; // how much of the darkness the pale copy keeps

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage();
  for (const name of ['ordures', 'recyclage']) {
    const data = fs.readFileSync(path.join(rawDir, name + '.png')).toString('base64');
    const result = await page.evaluate(async ({ data, HEIGHT, PALE }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
      const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
      const sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0);
      const px = sx.getImageData(0, 0, src.width, src.height), d = px.data;
      let minX = src.width, minY = src.height, maxX = 0, maxY = 0;
      for (let i = 0; i < d.length; i += 4) {
        let v = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (v > 242) v = 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        if (v < 255) { const p = i / 4, x = p % src.width, y = (p - x) / src.width; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
      sx.putImageData(px, 0, 0);
      const w = maxX - minX + 1, h = maxY - minY + 1, scale = HEIGHT / h;
      const render = pale => {
        const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = HEIGHT;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.imageSmoothingQuality = 'high'; x.drawImage(src, minX, minY, w, h, 0, 0, c.width, c.height);
        const p = x.getImageData(0, 0, c.width, c.height), e = p.data;
        for (let i = 0; i < e.length; i += 4) {
          let v = e[i];
          if (pale) v = 255 - (255 - v) * PALE;
          v = Math.round(v / 17) * 17; // 16 levels
          e[i] = e[i + 1] = e[i + 2] = v; e[i + 3] = 255;
        }
        x.putImageData(p, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      };
      return { full: render(false), pale: render(true), size: [Math.round(w * scale), HEIGHT] };
    }, { data, HEIGHT, PALE });
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(result.full, 'base64'));
    fs.writeFileSync(path.join(out, name + '-pale.png'), Buffer.from(result.pale, 'base64'));
    console.log(name, result.size.join('x'));
  }
  await browser.close();
})();
