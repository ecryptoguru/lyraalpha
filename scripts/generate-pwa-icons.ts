import sharp from "sharp";
import fs from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");
const SOURCE_LOGO = path.join(PUBLIC_DIR, "logo.png");

async function generateIcons() {
  if (!fs.existsSync(SOURCE_LOGO)) {
    console.error("❌ Source logo not found:", SOURCE_LOGO);
    process.exit(1);
  }

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log("Generating PWA icons from logo.png...");

  try {
    // Generate 192x192
    await sharp(SOURCE_LOGO)
      .resize(192, 192, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .toFile(path.join(ICONS_DIR, "icon-192.png"));
    console.log("✅ Created icon-192.png");

    // Generate 512x512
    await sharp(SOURCE_LOGO)
      .resize(512, 512, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .toFile(path.join(ICONS_DIR, "icon-512.png"));
    console.log("✅ Created icon-512.png");

    // Generate Apple Touch Icon (180x180)
    await sharp(SOURCE_LOGO)
      .resize(180, 180, { fit: "contain", background: { r: 10, g: 10, b: 10, alpha: 1 } })
      .toFile(path.join(ICONS_DIR, "apple-touch-icon.png"));
    console.log("✅ Created apple-touch-icon.png");

    console.log("🎉 All PWA icons generated successfully!");
  } catch (error) {
    console.error("❌ Error generating icons:", error);
    process.exit(1);
  }
}

generateIcons();
