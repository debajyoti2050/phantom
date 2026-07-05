import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import png2icons from "png2icons";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "build");
const sourcePath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(buildDir, "logo-source.png");

await fs.mkdir(buildDir, { recursive: true });
await fs.access(sourcePath);

const png = await sharp(sourcePath)
  .ensureAlpha()
  .resize(1024, 1024, {
    fit: "cover",
    position: "center",
  })
  .png()
  .toBuffer();
await fs.writeFile(path.join(buildDir, "icon.png"), png);

const ico = png2icons.createICO(png, png2icons.BICUBIC2, 0, false, true);
if (!ico) throw new Error("Failed to create Windows ICO icon");
await fs.writeFile(path.join(buildDir, "icon.ico"), ico);

const icns = png2icons.createICNS(png, png2icons.BICUBIC2, 0);
if (!icns) throw new Error("Failed to create macOS ICNS icon");
await fs.writeFile(path.join(buildDir, "icon.icns"), icns);

console.log(
  `Generated build/icon.png, build/icon.ico, and build/icon.icns from ${path.relative(rootDir, sourcePath)}`
);
