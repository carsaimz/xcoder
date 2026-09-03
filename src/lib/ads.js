import { isPremium } from "lib/premium";
import settings from "lib/settings";

/**
 * XCoder ads system — respectful by design, no AdMob.
 *
 * Formats
 *  - banner:        small dismissible house-ad strip (e.g. welcome page
 *                   footer); served by the community site.
 *  - interstitial:  full-screen house ad shown on natural break points
 *                   (page opens via helpers.showAd()) with HARD frequency
 *                   caps so it never becomes annoying:
 *                     • the first 3 app opens never show ads
 *                     • at most once every `interstitialEveryOpens` opens
 *                       (default 4)
 *                     • at least `interstitialMinGapHours` hours apart
 *                       (default 20)
 *                     • never when offline, disabled or during an AI run
 *
 * Providers
 *  - "house" (default): ads served by the community site (/api/app/ads),
 *    rendered as HTML in the app — no third-party SDK, F-Droid safe.
 *  - native providers (Unity Ads, LevelPlay, ...): register one with
 *    registerNativeProvider() when a Cordova plugin is added later; the
 *    system prefers the native provider automatically and keeps the same
 *    frequency caps. Nothing else needs to change.
 *
 * State lives in localStorage; everything silently no-ops when the site is
 * unreachable or ads are disabled.
 */

const OPEN_COUNT_KEY = "xcoder.ads.opens";
const LAST_SHOWN_KEY = "xcoder.ads.lastshown";
const ADS_CACHE_KEY = "xcoder.ads.cache";
const CACHE_TTL = 6 * 60 * 60 * 1000;

/** First N app opens are ad-free. */
const GRACE_OPENS = 3;

/** @type {Array<{name: string, impl: object}>} */
const nativeProviders = [];

let cachedAds = readAdsCache();
let cachedAt = Number(localStorage.getItem(`${ADS_CACHE_KEY}.at`) || 0);

/**
 * Registers a native ads provider (Unity Ads, LevelPlay, ...).
 * @param {string} name
 * @param {{showBanner?: Function, showInterstitial?: Function}} impl
 */
export function registerNativeProvider(name, impl) {
	if (name && impl) nativeProviders.push({ name, impl });
}

/**
 * Whether ads may be shown right now (premium status + user toggle + site
 * config). Premium supporters never see ads — checked first.
 * @returns {boolean}
 */
export function adsAvailable() {
	if (isPremium()) return false;
	if (settings.value.adsEnabled === false) return false;
	if (cachedAds?.enabled === false) return false;
	return true;
}

/**
 * Counts one app open. Call once per launch from main.js.
 */
export function trackAppOpen() {
	try {
		const count = Number(localStorage.getItem(OPEN_COUNT_KEY) || 0) + 1;
		localStorage.setItem(OPEN_COUNT_KEY, String(count));
	} catch {
		/* best effort */
	}
}

/**
 * Whether an interstitial is allowed by the frequency caps right now.
 * @returns {boolean}
 */
function interstitialAllowedByCap() {
	try {
		const opens = Number(localStorage.getItem(OPEN_COUNT_KEY) || 0);
		if (opens <= GRACE_OPENS) return false;

		const every = Number(cachedAds?.interstitialEveryOpens) || 4;
		const gapHours = Number(cachedAds?.interstitialMinGapHours) || 20;

		const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
		if (lastShown && Date.now() - lastShown < gapHours * 3600 * 1000) {
			return false;
		}

		// show at most once per `every` opens since the last one
		const opensSinceShown = lastShown
			? opens - Number(localStorage.getItem(`${LAST_SHOWN_KEY}.opens`) || 0)
			: opens - GRACE_OPENS;
		return opensSinceShown >= every;
	} catch {
		return false;
	}
}

/**
 * Marks an interstitial as shown.
 */
function markInterstitialShown() {
	try {
		localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
		localStorage.setItem(
			`${LAST_SHOWN_KEY}.opens`,
			String(Number(localStorage.getItem(OPEN_COUNT_KEY) || 0)),
		);
	} catch {
		/* best effort */
	}
}

/**
 * Shows an interstitial when allowed (natural break point). Called by
 * helpers.showAd() — the call sites already exist across page opens.
 * @param {string} [reason]
 * @returns {Promise<boolean>} true when an ad was shown
 */
export async function maybeShowInterstitial(reason = "") {
	if (!adsAvailable()) return false;
	if (!interstitialAllowedByCap()) return false;

	// native providers win when installed (Unity Ads etc.)
	const provider = nativeProviders[nativeProviders.length - 1];
	if (provider?.impl?.showInterstitial) {
		try {
			const shown = await provider.impl.showInterstitial(reason);
			if (shown) {
				markInterstitialShown();
				return true;
			}
		} catch {
			/* fall through to house ads */
		}
	}

	const ad = await pickAd("interstitial");
	if (!ad) return false;
	showInterstitialDialog(ad);
	markInterstitialShown();
	return true;
}

/**
 * Builds a banner element (house ad) for embedding into a page footer.
 * @param {string} [slot] placement id ("welcome", ...)
 * @returns {Promise<HTMLElement | null>} null when nothing to show
 */
export async function createBanner(slot = "banner") {
	if (!adsAvailable()) return null;

	const provider = nativeProviders[nativeProviders.length - 1];
	if (provider?.impl?.showBanner) {
		try {
			const el = await provider.impl.showBanner(slot);
			if (el) return el;
		} catch {
			/* fall through */
		}
	}

	const ad = await pickAd("banner");
	if (!ad) return null;

	return (
		<div className="xcoder-ad" data-slot={slot} role="region">
			<div className="xcoder-ad-body">
				<span className="xcoder-ad-tag">Ad</span>
				<span className="xcoder-ad-title">{ad.title}</span>
				{ad.body ? <span className="xcoder-ad-text">{ad.body}</span> : null}
			</div>
			<button className="xcoder-ad-cta" onclick={() => openAdUrl(ad)}>
				{ad.cta || "Open"}
			</button>
			<span
				className="icon clearclose xcoder-ad-close"
				role="button"
				onclick={(e) => {
					const $ad = e.target.closest(".xcoder-ad");
					if ($ad) $ad.remove();
				}}
			/>
		</div>
	);
}

/**
 * @param {{url?: string}} ad
 */
function openAdUrl(ad) {
	try {
		if (ad?.url) system.openInBrowser(ad.url);
	} catch {
		/* ignore */
	}
}

/**
 * Picks an ad of the given format from the site list (rotating).
 * @param {"banner"|"interstitial"} format
 * @returns {Promise<{id?: any, title: string, body?: string, url?: string, cta?: string} | null>}
 */
async function pickAd(format) {
	await refreshAds();
	const list = Array.isArray(cachedAds?.[format]) ? cachedAds[format] : [];
	if (!list.length) return null;
	const index = Math.floor(Date.now() / 60000) % list.length;
	return list[index];
}

/**
 * Refreshes the site ad config (cache TTL 6 h).
 */
async function refreshAds() {
	if (cachedAds && Date.now() - cachedAt < CACHE_TTL) return;
	try {
		const { backendUrl, deviceId } = await import("lib/backend");
		const response = await Promise.race([
			fetch(`${backendUrl()}/api/app/ads`, {
				cache: "no-cache",
				headers: { "X-Device-ID": deviceId() },
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("timeout")), 6000),
			),
		]);
		if (!response?.ok) return;
		const json = await response.json();
		if (json && typeof json === "object") {
			cachedAds = json;
			cachedAt = Date.now();
			writeAdsCache(json);
		}
	} catch {
		/* offline — keep old cache */
	}
}

function readAdsCache() {
	try {
		const raw = localStorage.getItem(ADS_CACHE_KEY);
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function writeAdsCache(ads) {
	try {
		localStorage.setItem(ADS_CACHE_KEY, JSON.stringify(ads));
		localStorage.setItem(`${ADS_CACHE_KEY}.at`, String(Date.now()));
	} catch {
		/* best effort */
	}
}

/**
 * Full-screen interstitial dialog for a house ad.
 * @param {{title: string, body?: string, url?: string, cta?: string}} ad
 */
function showInterstitialDialog(ad) {
	const $overlay = (
		<div className="xcoder-ad-interstitial" role="dialog">
			<div className="xcoder-ad-card">
				<span
					className="icon clearclose xcoder-ad-close"
					role="button"
					onclick={close}
				/>
				<span className="xcoder-ad-tag">Ad</span>
				<h3 className="xcoder-ad-title">{ad.title}</h3>
				{ad.body ? <p className="xcoder-ad-text">{ad.body}</p> : null}
				{ad.url ? (
					<button
						className="xcoder-ad-cta primary"
						onclick={() => {
							openAdUrl(ad);
							close();
						}}
					>
						{ad.cta || "Open"}
					</button>
				) : null}
			</div>
		</div>
	);

	function close() {
		$overlay.remove();
	}

	document.body.append($overlay);
}

export default {
	registerNativeProvider,
	adsAvailable,
	trackAppOpen,
	maybeShowInterstitial,
	createBanner,
};
