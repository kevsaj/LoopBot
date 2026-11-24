// Draws every app icon and splash image from scripts/icons/bot.mjs.
//   node scripts/icons/make-icons.mjs
// Writes the SVG sources in assets/src, Android vector drawables (adaptive icon with a themed
// monochrome layer), and renders the PNGs (iOS icon, Android legacy icons, splash screens) with
// Playwright's Chromium, so it needs Playwright installed (npm i -g playwright).

import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { BOT, MONO, SKY, STARS, TEAL, placed, svgPaths, skySvg, rrPath } from './bot.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RES = join(ROOT, 'android/app/src/main/res');
const write = (p, s) => writeFileSync(join(ROOT, p), s);

/** Bot middle (between antenna ball and feet) sits at y = -15 in bot units. */
const MID = -15;

// --- SVG sources -------------------------------------------------------------------------------

/** Full-bleed square icon (iOS, Play Store): a big bot on the sky. */
function iconSvg(size = 1024) {
  const s = (1.4 * size) / 1024;
  const cy = size / 2 - MID * s + 8 * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${skySvg(size, size, size / 2, cy - 90 * s, size * 0.48, size * 0.006)}${svgPaths(placed(BOT, s, size / 2, cy))}</svg>`;
}

/** Adaptive icon layers: 108dp canvas, the bot inside the 66dp safe circle (radius 33dp). */
const FG_SCALE = 0.104; // dp per bot unit: the farthest point (antenna ball) is ~287 units from the middle, so about 30dp of the 33dp safe radius
const fgPaths = (shapes, size) => placed(shapes, (FG_SCALE * size) / 108, size / 2, size / 2 - MID * ((FG_SCALE * size) / 108));

function fgSvg(shapes, size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svgPaths(fgPaths(shapes, size))}</svg>`;
}
function bgSvg(size = 1024) {
  const s = (FG_SCALE * size) / 108;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${skySvg(size, size, size / 2, size / 2 - (MID + 90) * s, size * 0.42, size * 0.006)}</svg>`;
}

/** Splash: the bot above the wordmark, centred on a square (cropped to fill the screen). */
function splashSvg(w, h) {
  const m = Math.min(w, h);
  const s = (0.36 * m) / 562; // bot is 36% of the short side tall
  const botY = h / 2 - 0.1 * m;
  const textY = botY + 262 * s + 0.15 * m;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${skySvg(w, h, w / 2, botY - 90 * s, m * 0.5, m * 0.003)}` +
    `${svgPaths(placed(BOT, s, w / 2, botY))}` +
    `<text x="${w / 2}" y="${textY}" text-anchor="middle" font-family="Inter,system-ui,Arial,sans-serif" font-weight="800" letter-spacing="${-0.02 * 0.12 * m}" font-size="${0.12 * m}"><tspan fill="#f6f1e6">Loop</tspan><tspan fill="${TEAL}">Bot</tspan></text></svg>`
  );
}

write('assets/src/icon-only.svg', iconSvg());
write('assets/src/icon-foreground.svg', fgSvg(BOT));
write('assets/src/icon-monochrome.svg', fgSvg(MONO));
write('assets/src/icon-background.svg', bgSvg());
write('assets/src/splash.svg', splashSvg(2732, 2732));
write('assets/src/splash-dark.svg', splashSvg(2732, 2732));

// --- Android vector drawables (sharp at every density) -----------------------------------------

const vecHead = `<?xml version="1.0" encoding="utf-8"?>
<!-- Made by scripts/icons/make-icons.mjs: edit bot.mjs and run it again rather than editing this file. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">`;
const hex = (c, op = 1) => '#' + Math.round(op * 255).toString(16).padStart(2, '0').toUpperCase() + c.slice(1).toUpperCase();
const vecPaths = (paths) =>
  paths
    .map((p) => `    <path android:fillColor="${hex(p.fill, p.op)}"${p.evenOdd ? ' android:fillType="evenOdd"' : ''} android:pathData="${p.d}" />`)
    .join('\n');

write('android/app/src/main/res/drawable/ic_launcher_foreground.xml', `${vecHead}\n${vecPaths(fgPaths(BOT, 108))}\n</vector>\n`);
write('android/app/src/main/res/drawable/ic_launcher_monochrome.xml', `${vecHead}\n${vecPaths(fgPaths(MONO, 108))}\n</vector>\n`);
{
  const s = FG_SCALE;
  const gy = 54 - (MID + 90) * s;
  const items = SKY.map(([o, c]) => `                <item android:offset="${o}" android:color="${hex(c)}" />`).join('\n');
  const stars = STARS.map(([x, y, a]) => `    <path android:fillColor="${hex('#ffffff', a * 0.55)}" android:pathData="${rrPath(x * 108 - 0.65, y * 108 - 0.65, 1.3, 1.3, 0.65)}" />`).join('\n');
  write(
    'android/app/src/main/res/drawable/ic_launcher_background.xml',
    `${vecHead}
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="0" android:startY="0" android:endX="0" android:endY="108">
${items}
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="radial" android:centerX="54" android:centerY="${+gy.toFixed(2)}" android:gradientRadius="${+(108 * 0.42).toFixed(2)}">
                <item android:offset="0" android:color="${hex(TEAL, 0.22)}" />
                <item android:offset="1" android:color="${hex(TEAL, 0)}" />
            </gradient>
        </aapt:attr>
    </path>
${stars}
</vector>
`,
  );
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <!-- Android 13+ themed icons: the launcher tints this one-colour bot to match the wallpaper. -->
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;
write('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive);
write('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', adaptive);
// The old PNG layers (rendered too small, hence the blurry launcher icon) and Capacitor's sample robot.
for (const d of readdirSync(RES).filter((d) => d.startsWith('mipmap-') && d !== 'mipmap-anydpi-v26')) {
  for (const f of ['ic_launcher_foreground.png', 'ic_launcher_background.png']) if (existsSync(join(RES, d, f))) unlinkSync(join(RES, d, f));
}
if (existsSync(join(RES, 'drawable-v24/ic_launcher_foreground.xml'))) unlinkSync(join(RES, 'drawable-v24/ic_launcher_foreground.xml'));

// --- PNGs ---------------------------------------------------------------------------------------

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}
const browser = await chromium.launch();
const page = await browser.newPage();

/** Renders an SVG string to a PNG file at exactly w x h, with an optional round or rounded-square mask. */
async function png(svg, w, h, out, mask = '') {
  await page.setViewportSize({ width: w, height: h });
  const clip = mask === 'round' ? 'border-radius:50%;' : mask === 'square' ? 'border-radius:16%;' : '';
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${w}px;height:${h}px;overflow:hidden;${clip}">${svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"`)}</div></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(ROOT, out), omitBackground: !!mask, clip: { x: 0, y: 0, width: w, height: h } });
}

await png(iconSvg(), 1024, 1024, 'assets/icon-only.png');
await png(fgSvg(BOT), 1024, 1024, 'assets/icon-foreground.png', 'none');
await png(bgSvg(), 1024, 1024, 'assets/icon-background.png');
await png(splashSvg(2732, 2732), 2732, 2732, 'assets/splash.png');
await png(splashSvg(2732, 2732), 2732, 2732, 'assets/splash-dark.png');
// iOS: one 1024 icon with no transparency (App Store rejects alpha), splash in light and dark.
await png(iconSvg(), 1024, 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
for (const f of readdirSync(join(ROOT, 'ios/App/App/Assets.xcassets/Splash.imageset')).filter((f) => f.endsWith('.png'))) {
  await png(splashSvg(2732, 2732), 2732, 2732, `ios/App/App/Assets.xcassets/Splash.imageset/${f}`);
}
// Android before 8.0 (min SDK 24 and 25) uses these flat icons; the adaptive XML covers the rest.
const DENS = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const legacy = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgSvg(size).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${svgPaths(fgPaths(BOT, size).map((p) => p))}</svg>`;
for (const [d, px] of Object.entries(DENS)) {
  // Legacy icons are not masked by the launcher, so the bot is drawn a little bigger in them.
  const big = (size) => {
    const s = (FG_SCALE * 1.28 * size) / 108;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgSvg(size).replace(/^<svg[^>]*>|<\/svg>$/g, '')}${svgPaths(placed(BOT, s, size / 2, size / 2 - MID * s))}</svg>`;
  };
  await png(big(px * 4), px, px, `android/app/src/main/res/mipmap-${d}/ic_launcher.png`, 'square');
  await png(legacy(px * 4), px, px, `android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, 'round');
}
// Android splash bitmaps (Android 11 and older, and the hand-off before the web view draws).
for (const d of readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const f = join(RES, d, 'splash.png');
  if (!existsSync(f)) continue;
  const b = readFileSync(f);
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  await png(splashSvg(w, h), w, h, `android/app/src/main/res/${d}/splash.png`);
}

// The HTML splash in index.html draws the same bot inline; print it for pasting.
const s = 0.215;
console.log('index.html splash bot (viewBox -60 -70 120 140):');
console.log(svgPaths(placed(BOT, s, 0, -3)));

await browser.close();
console.log('done');
