import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
// Usage: node brand/scripts/optimize-art.mjs <png-dir> public/art [contact-sheet.jpg]
const [src, out, sheet] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter((f) => f.endsWith(".png"));
const thumbs = [];
for (const f of files) {
  const name = f.replace(".png", "");
  const wide = name === "hero" || name === "section-sky" || name === "section-andes";
  const w = name === "hero" ? 2400 : wide ? 1920 : name.startsWith("cat-") ? 900 : 1200;
  const img = sharp(path.join(src, f)).resize({ width: w, withoutEnlargement: true });
  const info = await img.webp({ quality: 74, effort: 6 }).toFile(path.join(out, name + ".webp"));
  console.log(name, info.width + "x" + info.height, Math.round(info.size / 1024) + "KB");
  thumbs.push(await sharp(path.join(src, f)).resize(300, 300, { fit: "cover" }).png().toBuffer());
}
if (!sheet) process.exit(0);
const cols = 4, rows = Math.ceil(thumbs.length / cols);
await sharp({ create: { width: cols * 300, height: rows * 300, channels: 3, background: "#000" } })
  .composite(thumbs.map((b, i) => ({ input: b, left: (i % cols) * 300, top: Math.floor(i / cols) * 300 })))
  .jpeg({ quality: 70 }).toFile(sheet);
console.log(files.join(" "));
