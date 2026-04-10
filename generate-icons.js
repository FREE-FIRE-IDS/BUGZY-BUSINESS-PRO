import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputSvg = path.join(process.cwd(), 'public', 'icon.svg');
const outputDir = path.join(process.cwd(), 'public');

async function generateIcons() {
  try {
    const svgBuffer = fs.readFileSync(inputSvg);

    // Generate 192x192
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'));
    console.log('Generated icon-192.png');

    // Generate 512x512
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'));
    console.log('Generated icon-512.png');

    // Generate 512x512 maskable (with padding)
    // For maskable icons, the safe zone is the inner 80%
    await sharp(svgBuffer)
      .resize(400, 400) // Resize actual content
      .extend({
        top: 56,
        bottom: 56,
        left: 56,
        right: 56,
        background: { r: 30, g: 41, b: 59, alpha: 1 } // Match the background color of your icon
      })
      .png()
      .toFile(path.join(outputDir, 'icon-maskable.png'));
    console.log('Generated icon-maskable.png');

  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
