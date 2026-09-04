/**
 * Regenerates www/favicon.ico from the CURRENT brand (res/logo.png —
 * the < X > mark). Multi-size: 16/32/48. Run: node scripts/make_favicon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "res/logo.png");
const OUT = path.join(ROOT, "www/favicon.ico");

async function pngBuffer(size) {
	return sharp(SRC)
		.resize(size, size, { fit: "cover", position: "centre" })
		.png()
		.toBuffer();
}

/**
 * Packs PNG frames into an ICO container (PNG-compressed entries are
 * valid per the Vista+ format).
 * @param {{size: number, data: Buffer}[]} frames
 */
function packIco(frames) {
	const count = frames.length;
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(count, 4);

	const entries = [];
	let offset = 6 + count * 16;
	for (const { size, data } of frames) {
		const entry = Buffer.alloc(16);
		entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
		entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
		entry.writeUInt8(0, 2); // palette
		entry.writeUInt8(0, 3); // reserved
		entry.writeUInt16LE(1, 4); // planes
		entry.writeUInt16LE(32, 6); // bpp
		entry.writeUInt32LE(data.length, 8);
		entry.writeUInt32LE(offset, 12);
		entries.push(entry);
		offset += data.length;
	}
	return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)]);
}

const frames = [];
for (const size of [16, 32, 48]) {
	frames.push({ size, data: await pngBuffer(size) });
}
fs.writeFileSync(OUT, packIco(frames));
console.log(`favicon written: ${OUT} (${frames.map((f) => f.size).join("/")}px)`);
