import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "icon.svg");
const androidRes = join(root, "android", "app", "src", "main", "res");

const svgBuffer = readFileSync(svgPath);

// Standard launcher sizes
const densities = [
  { dir: "mipmap-mdpi",    launcher: 48,  foreground: 108 },
  { dir: "mipmap-hdpi",    launcher: 72,  foreground: 162 },
  { dir: "mipmap-xhdpi",   launcher: 96,  foreground: 216 },
  { dir: "mipmap-xxhdpi",  launcher: 144, foreground: 324 },
  { dir: "mipmap-xxxhdpi", launcher: 192, foreground: 432 },
];

async function generate() {
  console.log("Generando iconos Android...\n");

  for (const { dir, launcher, foreground } of densities) {
    const outDir = join(androidRes, dir);
    mkdirSync(outDir, { recursive: true });

    // ic_launcher.png (con fondo negro redondeado — el SVG ya lo tiene)
    await sharp(svgBuffer, { density: 300 })
      .resize(launcher, launcher)
      .png()
      .toFile(join(outDir, "ic_launcher.png"));

    // ic_launcher_round.png — igual que el cuadrado (Android aplica su máscara circular)
    await sharp(svgBuffer, { density: 300 })
      .resize(launcher, launcher)
      .png()
      .toFile(join(outDir, "ic_launcher_round.png"));

    // ic_launcher_foreground.png — sin fondo negro, con padding para adaptive icon
    // El foreground va con transparencia y el contenido centrado con ~10% padding
    const innerSize = Math.round(foreground * 0.72); // zona segura
    const pad = Math.floor((foreground - innerSize) / 2);
    await sharp(svgBuffer, { density: 300 })
      .resize(innerSize, innerSize)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(outDir, "ic_launcher_foreground.png"));

    console.log(`✓ ${dir}: launcher=${launcher}px  foreground=${foreground}px`);
  }

  // También genera 512x512 para Play Store / general
  await sharp(svgBuffer, { density: 300 })
    .resize(512, 512)
    .png()
    .toFile(join(root, "public", "icon-512.png"));

  await sharp(svgBuffer, { density: 300 })
    .resize(192, 192)
    .png()
    .toFile(join(root, "public", "icon-192.png"));

  console.log("\n✓ public/icon-512.png  (Play Store / PWA)");
  console.log("✓ public/icon-192.png  (PWA manifest)");
  console.log("\nListo.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
