import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // No interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // Draw a subtle border and center square icon
      const isCenter = Math.abs(x - width / 2) < width * 0.35 && Math.abs(y - height / 2) < height * 0.35;
      const isTeal = isCenter && (Math.abs(x - width / 2) < width * 0.15 || Math.abs(y - height / 2) < height * 0.15);

      if (isTeal) {
        rawData[pixelOffset] = 14;   // Teal R
        rawData[pixelOffset + 1] = 165; // Teal G
        rawData[pixelOffset + 2] = 233; // Teal B
        rawData[pixelOffset + 3] = 255;
      } else if (isCenter) {
        rawData[pixelOffset] = 22;
        rawData[pixelOffset + 1] = 31;
        rawData[pixelOffset + 2] = 46;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
        rawData[pixelOffset + 3] = a;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(12 + length);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// Standard CRC32
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, 11, 15, 23));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, 11, 15, 23));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, 11, 15, 23));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, 11, 15, 23));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(32, 32, 11, 15, 23));
console.log('Icons generated successfully in /public');
