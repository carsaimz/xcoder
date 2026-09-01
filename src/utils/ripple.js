import config from "lib/config";
import appSettings from "lib/settings";

/**
 * Global touch feedback: a material-like ripple on interactive elements
 * plus a light haptic pulse. Visual ripple always plays (guarded by
 * prefers-reduced-motion in CSS); vibration only when the user's
 * "vibrate on tap" setting is on.
 *
 * Hosts: buttons, settings rows, about page items — anything matching
 * RIPPLE_SELECTOR. Safe to call once at startup.
 */

const RIPPLE_SELECTOR =
	'button, [role="button"], .list-item, .info-item, .social-link';

let listening = false;

function initRippleFeedback() {
	if (listening) return;
	listening = true;

	document.addEventListener(
		"click",
		(e) => {
			try {
				const host = e.target?.closest?.(RIPPLE_SELECTOR);
				if (!host || !host.isConnected) return;

				// haptic pulse (only when the user opted in)
				try {
					if (appSettings.value.vibrateOnTap && navigator.vibrate) {
						navigator.vibrate(config.VIBRATION_TIME);
					}
				} catch {
					/* vibration unsupported — ignore */
				}

				// ripple ink
				if (host.querySelector(":scope > .ripple-ink")) return;
				const rect = host.getBoundingClientRect();
				if (!rect.width || !rect.height) return;
				const size = Math.ceil(Math.max(rect.width, rect.height) * 1.15);
				const ink = document.createElement("span");
				ink.className = "ripple-ink";
				ink.style.width = ink.style.height = `${size}px`;
				const originX = e.clientX || rect.left + rect.width / 2;
				const originY = e.clientY || rect.top + rect.height / 2;
				ink.style.left = `${originX - rect.left - size / 2}px`;
				ink.style.top = `${originY - rect.top - size / 2}px`;
				host.classList.add("ripple-host");
				host.appendChild(ink);
				ink.addEventListener("animationend", () => ink.remove(), {
					once: true,
				});
				setTimeout(() => ink.remove(), 700); // safety net
			} catch {
				/* feedback must never break interaction */
			}
		},
		{ passive: true },
	);
}

export default initRippleFeedback;
