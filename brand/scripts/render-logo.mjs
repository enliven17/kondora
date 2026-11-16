// Usage: node brand/scripts/render-logo.mjs <svg> <out.png> [size]
import sharp from "sharp";
const [svg, out, size = "512"] = process.argv.slice(2);
const s = Number(size);
await sharp(svg, { density: 384 }).resize(s, s, { fit: "contain", background: "#05070D" }).flatten({ background: "#05070D" }).png().toFile(out);
console.log("wrote", out);
