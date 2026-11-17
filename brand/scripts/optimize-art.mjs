// Turns Codex PNG renders into the asset contract in brand/DESIGN.md.
// Usage: node brand/scripts/optimize-art.mjs <png-dir>
// Expects <png-dir>/{hero,hero-mobile,cta,app-bg,feature-*,cat-*,petals}.png
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [src] = process.argv.slice(2);
if (!src) throw new Error("Usage: node brand/scripts/optimize-art.mjs <png-dir>");
const OUT = "public/art";
fs.mkdirSync(`${OUT}/cat`, { recursive: true });
fs.mkdirSync(`${OUT}/petals`, { recursive: true });

const SPECS = {
  hero: { w: 2400, h: 1300, q: 84, pos: "centre" },
  "hero-mobile": { w: 1080, h: 1500, q: 84, pos: "centre" },
  cta: { w: 2400, h: 1000, q: 82, pos: "centre" },
  "app-bg": { w: 2400, h: 1400, q: 76, pos: "centre" },
  "feature-split": { w: 1200, h: 1200, q: 86 },
  "feature-lever": { w: 1200, h: 1200, q: 86 },
  "feature-council": { w: 1200, h: 1200, q: 86 },
};

const log = (name, info) => console.log(name.padEnd(24), `${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`);

for (const [name, s] of Object.entries(SPECS)) {
  const file = path.join(src, `${name}.png`);
  if (!fs.existsSync(file)) {
    console.warn("missing", name);
    continue;
  }
  const info = await sharp(file)
    .resize(s.w, s.h, { fit: "cover", position: s.pos ?? "centre", kernel: "lanczos3" })
    .webp({ quality: s.q, effort: 6, smartSubsample: true })
    .toFile(`${OUT}/${name}.webp`);
  log(name, info);
}

for (const f of fs.readdirSync(src).filter((f) => f.startsWith("cat-") && f.endsWith(".png"))) {
  const cat = f.slice(4, -4);
  const info = await sharp(path.join(src, f)).resize(640, 640).webp({ quality: 86, effort: 6 }).toFile(`${OUT}/cat/${cat}.webp`);
  log(`cat/${cat}`, info);
}

// Petals: chroma-key the green sheet into four transparent 96x96 sprites.
const sheet = path.join(src, "petals.png");
if (fs.existsSync(sheet)) {
  const { data, info } = await sharp(sheet).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const spill = g - Math.max(r, b);
    const a = spill <= 30 ? 255 : spill >= 110 ? 0 : Math.round(255 * (1 - (spill - 30) / 80));
    rgba[j] = r;
    rgba[j + 1] = a < 255 ? Math.min(g, Math.max(r, b)) : g; // despill the edge
    rgba[j + 2] = b;
    rgba[j + 3] = a;
  }
  const keyed = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
  const keyedPng = await keyed.png().toBuffer();
  const hw = Math.floor(info.width / 2), hh = Math.floor(info.height / 2);
  const quads = [[0, 0], [hw, 0], [0, hh], [hw, hh]];
  for (let i = 0; i < 4; i++) {
    const [left, top] = quads[i];
    const piece = await sharp(keyedPng).extract({ left, top, width: hw, height: hh }).png().toBuffer();
    const trimmed = await sharp(piece).trim({ threshold: 1 }).png().toBuffer();
    const out = await sharp(trimmed)
      .resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: false })
      .toFile(`${OUT}/petals/petal-${i + 1}.png`);
    log(`petals/petal-${i + 1}`, out);
  }
}
