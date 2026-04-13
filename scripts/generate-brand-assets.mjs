import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const brandDir = path.join(rootDir, "public", "brand");
const iconDir = path.join(rootDir, "public", "icons");
const appDir = path.join(rootDir, "src", "app");

const symbolSvgPath = path.join(brandDir, "lyraalpha-ai-symbol.svg");
const lockupSvgPath = path.join(brandDir, "lyraalpha-ai-logo-lockup.svg");

function createIco(buffers, sizes) {
  const count = buffers.length;
  const header = Buffer.alloc(6 + count * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = header.length;

  buffers.forEach((buffer, index) => {
    const size = sizes[index];
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset);
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(buffer.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, ...buffers]);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function renderPng(svgBuffer, width) {
  return sharp(svgBuffer).resize({ width, height: width, fit: "contain" }).png().toBuffer();
}

async function buildOgImage(symbolSvg, lockupSvg) {
  // OG image: dark background 1200x630 with logo centered
  const BG_COLOR = { r: 10, g: 10, b: 15, alpha: 1 };
  const W = 1200, H = 630;

  // Render lockup SVG at a height that fits inside the OG canvas (max 380px tall)
  // lockup SVG viewBox is 1800x560, so scale to fit width 900 centered
  const lockupH = Math.round(900 * (560 / 1800));
  const lockupPng = await sharp(lockupSvg)
    .resize({ width: 900, height: lockupH, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const ogBuf = await sharp({
    create: { width: W, height: H, channels: 4, background: BG_COLOR },
  })
    .composite([{
      input: lockupPng,
      gravity: "center",
    }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return ogBuf;
}

async function main() {
  await Promise.all([ensureDir(brandDir), ensureDir(iconDir), ensureDir(appDir)]);

  const [symbolSvg, lockupSvg] = await Promise.all([
    fs.readFile(symbolSvgPath),
    fs.readFile(lockupSvgPath),
  ]);

  const logo512 = await renderPng(symbolSvg, 512);
  const icon192 = await renderPng(symbolSvg, 192);
  const apple180 = await renderPng(symbolSvg, 180);
  const icoSizes = [16, 32, 48, 64];
  const icoBuffers = await Promise.all(icoSizes.map((size) => renderPng(symbolSvg, size)));
  const faviconIco = createIco(icoBuffers, icoSizes);
  const ogImage = await buildOgImage(symbolSvg, lockupSvg);

  await Promise.all([
    fs.writeFile(path.join(brandDir, "lyraalpha-ai-favicon.ico"), faviconIco),
    fs.writeFile(path.join(rootDir, "public", "favicon.png"), logo512),
    fs.writeFile(path.join(rootDir, "public", "logo.png"), logo512),
    fs.writeFile(path.join(rootDir, "public", "og-image.png"), ogImage),
    fs.writeFile(path.join(iconDir, "icon-512.png"), logo512),
    fs.writeFile(path.join(iconDir, "icon-192.png"), icon192),
    fs.writeFile(path.join(iconDir, "apple-touch-icon.png"), apple180),
    fs.writeFile(path.join(appDir, "favicon.ico"), faviconIco),
    fs.writeFile(path.join(appDir, "icon.png"), logo512),
    fs.writeFile(path.join(appDir, "apple-icon.png"), apple180),
  ]);

  console.log("✓ Brand assets generated:");
  console.log("  public/og-image.png        (1200×630 OG image)");
  console.log("  public/logo.png            (512×512)");
  console.log("  public/favicon.png         (512×512)");
  console.log("  public/icons/icon-512.png  (512×512)");
  console.log("  public/icons/icon-192.png  (192×192)");
  console.log("  public/icons/apple-touch-icon.png (180×180)");
  console.log("  src/app/favicon.ico");
  console.log("  src/app/icon.png           (512×512)");
  console.log("  src/app/apple-icon.png     (180×180)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
