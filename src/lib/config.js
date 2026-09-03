const GITHUB_URL = "https://github.com/carsaimz/xcoder";

/** Official community site (docs live there too). */
const WEBSITE_URL = "https://xcoderapp.vercel.app";

/**
 * Official Supabase project — auth (accounts) + premium grants + payment
 * methods. The publishable key is PUBLIC by design (same one browsers
 * use); privileged work stays server-side. Self-hosters can point the
 * app somewhere else via settings.json (`supabaseUrl`/`supabaseAnonKey`)
 * or by serving their own site config (/api/config).
 */
const SUPABASE_URL = "https://jfcwghrnjruljhxdsygn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_9VuPlcfnLD-BkGMuVD3D1w_4BtZPqvi";

let hasPro = true; // all features are unlocked in XCoder

const config = {
	GITHUB_URL,
	WEBSITE_URL,
	BASE_URL: WEBSITE_URL,
	SUPABASE_URL,
	SUPABASE_PUBLISHABLE_KEY,
	SUPPORTED_EDITOR: "cm",
	FILE_NAME_REGEX: /^((?![:<>"\\\|\?\*]).)*$/,
	FONT_SIZE: /^[0-9\.]{1,3}(px|rem|em|pt|mm|pc|in)$/,
	DEFAULT_FILE_SESSION: "default-session",
	DEFAULT_FILE_NAME: "untitled.txt",
	CONSOLE_PORT: 8159,
	SERVER_PORT: 8158,
	PREVIEW_PORT: 8158,
	VIBRATION_TIME: 30,
	VIBRATION_TIME_LONG: 150,
	SCROLL_SPEED_FAST_X2: "FAST_X2",
	SCROLL_SPEED_NORMAL: "NORMAL",
	SCROLL_SPEED_FAST: "FAST",
	SCROLL_SPEED_SLOW: "SLOW",
	SIDEBAR_SLIDE_START_THRESHOLD_PX: 20,
	CUSTOM_THEME: 'body[theme="custom"]',
	FEEDBACK_EMAIL: "carsaimz@users.noreply.github.com",
	ERUDA_CDN: "https://cdn.jsdelivr.net/npm/eruda",

	/**
	 * XCoder is offline-first: there is no remote API. Kept as an empty
	 * string so legacy plugin code degrades gracefully instead of crashing.
	 */
	API_BASE: "",

	LOG_FILE_NAME: "XCoder.log",

	get DOCS_URL() {
		return `${WEBSITE_URL}/docs`;
	},

	get HAS_PRO() {
		return hasPro;
	},

	set HAS_PRO(value) {
		hasPro = true; // always unlocked
	},
};

export default config;
