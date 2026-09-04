/**
 * Generates the xcoder-web brand asset set from the app's CURRENT logo
 * (res/logo.png — the < X > mark): favicon.ico, icon-192/512,
 * apple-icon, og.png (1200x630 branded card) and copies logo.svg.
 *
 * Run from the app repo root:
 *   node scripts/make_site_assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const APP_ROOT = "/home/z/my-project/xcoder";
const WEB_PUBLIC = "/home/z/my-project/xcoder-web/public";
const SRC = path.join(APP_ROOT, "res/logo.png");

async function pngPreset(size, out) {
	await sharp(SRC)
		.resize(size, size, { fit: "cover", position: "centre" })
		.png()
		.toFile(out);
	console.log("icon:", path.basename(out), `${size}x${size}`);
}

/** ICO container (PNG frames) — same packing as make_favicon.mjs. */
function packIco(frames) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(frames.length, 4);
	const entries = [];
	let offset = 6 + frames.length * 16;
	for (const { size, data } of frames) {
		const e = Buffer.alloc(16);
		e.writeUInt8(size >= 256 ? 0 : size, 0);
		e.writeUInt8(size >= 256 ? 0 : size, 1);
		e.writeUInt16LE(1, 4);
		e.writeUInt16LE(32, 6);
		e.writeUInt32LE(data.length, 8);
		e.writeUInt32LE(offset, 12);
		entries.push(e);
		offset += data.length;
	}
	return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)]);
}

async function favicon() {
	const frames = [];
	for (const size of [16, 32, 48]) {
		const data = await sharp(SRC)
			.resize(size, size, { fit: "cover" })
			.png()
			.toBuffer();
		frames.push({ size, data });
	}
	fs.writeFileSync(path.join(WEB_PUBLIC, "favicon.ico"), packIco(frames));
	console.log("icon: favicon.ico (16/32/48)");
}

/** 1200x630 OG card: brand gradient, logo, name + tagline. */
async function ogCard() {
	const W = 1200;
	const H = 630;
	const svg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#232133"/>
      <stop offset="1" stop-color="#121824"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9a6bfc"/>
      <stop offset="1" stop-color="#4b7ef8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="${H - 10}" width="${W}" height="10" fill="url(#accent)"/>
  <circle cx="${W - 140}" cy="150" r="230" fill="#9a6bfc" opacity="0.07"/>
  <circle cx="120" cy="${H - 90}" r="180" fill="#4b7ef8" opacity="0.07"/>
  <text x="400" y="268" font-family="DejaVu Sans, sans-serif" font-size="96"
        font-weight="800" fill="#ffffff">XCoder</text>
  <text x="400" y="330" font-family="DejaVu Sans, sans-serif" font-size="34"
        fill="#c9bef2">Editor de código com IA para Android</text>
  <text x="400" y="382" font-family="DejaVu Sans, sans-serif" font-size="26"
        fill="#8b93a7">Open source · Git · Terminal · Plugins · Agent IA</text>
  <text x="400" y="470" font-family="DejaVu Sans, sans-serif" font-size="24"
        fill="#8b93a7">xcoder.app · GitHub carsaimz/xcoder</text>
</svg>`);

	// rounded-corner logo tile (96px) composited on the card
	const tile = await sharp(SRC)
		.resize(220, 220, { fit: "cover" })
		.png()
		.toBuffer();
	const tileMask = Buffer.from(
		`<svg width="220" height="220"><rect width="220" height="220" rx="48" fill="#fff"/></svg>`,
	);
	const roundedTile = await sharp(tile)
		.composite([{ input: tileMask, blend: "dest-in" }])
		.png()
		.toBuffer();

	await sharp({
		create: { width: W, height: H, channels: 4, background: "#121824" },
	})
		.composite([
			{ input: svg, top: 0, left: 0 },
			{ input: roundedTile, top: 205, left: 120 },
		])
		.png()
		.toFile(path.join(WEB_PUBLIC, "og.png"));
	console.log("icon: og.png (1200x630)");
}

await fs.promises.mkdir(WEB_PUBLIC, { recursive: true });
await pngPreset(192, path.join(WEB_PUBLIC, "icon-192.png"));
await pngPreset(512, path.join(WEB_PUBLIC, "icon-512.png"));
await pngPreset(180, path.join(WEB_PUBLIC, "apple-icon.png"));
await favicon();
await ogCard();
fs.copyFileSync(
	path.join(APP_ROOT, "www/logo.svg"),
	path.join(WEB_PUBLIC, "logo.svg"),
);
console.log("icon: logo.svg (copied from app brand)");
