import sharp from 'sharp';

async function checkIcons() {
  const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable.png'];
  for (const icon of icons) {
    try {
      const metadata = await sharp(`public/${icon}`).metadata();
      console.log(`${icon}: ${metadata.width}x${metadata.height}`);
    } catch (err) {
      console.error(`Error checking ${icon}:`, err.message);
    }
  }
}

checkIcons();
