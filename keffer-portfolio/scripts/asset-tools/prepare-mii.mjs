// Rebuild local 3D assets and the loading/error poster. Run from keffer-portfolio.
import { copyFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const source = "scripts/asset-tools/mii-source";
const output = "public/assets/mii";
await mkdir(output, { recursive: true });
for (const name of ["body.glb", "william-head.glb"]) {
  await copyFile(`${source}/${name}`, `${output}/${name}`);
}
await sharp(`${source}/neutral.png`).resize(512, 512)
  .webp({ quality: 90, alphaQuality: 100 }).toFile(`${output}/neutral.webp`);
