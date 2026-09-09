/**
 * Terminal onboarding (roadmap v1.6.x item 4).
 *
 * First time the user opens a terminal, explain the two run modes
 * (Alpine proot vs FailSafe) and offer a one-tap "reinstall environment"
 * escape hatch. Shown once — persisted via
 * settings.terminalOnboardingDone.
 */
import toast from "components/toast";
import select from "dialogs/select";
import settings from "lib/settings";

/**
 * Shows the onboarding dialog once. Safe to call on every terminal open
 * — it no-ops when the flag is already set.
 * @returns {Promise<void>}
 */
export async function maybeTerminalOnboarding() {
	if (settings.value.terminalOnboardingDone) return;

	try {
		settings.value.terminalOnboardingDone = true;
		await settings.update();

		const choice = await select(
			strings["terminal onboarding title"] || "Terminal — como funciona",
			[
				["ok", strings["terminal onboarding ok"] || "Entendi", "svg:check"],
				[
					"reinstall",
					strings["terminal onboarding reinstall"] || "Reinstalar ambiente",
					"svg:refresh-cw",
				],
			],
		);

		if (choice === "reinstall") {
			if (typeof Terminal !== "undefined" && Terminal?.uninstall) {
				await Terminal.uninstall();
				toast(
					strings["terminal onboarding reinstalled"] ||
						"Ambiente removido — será reinstalado na próxima abertura",
					4000,
				);
			} else {
				toast(
					strings["terminal onboarding reinstall unavailable"] ||
						"Abra Configurações > Terminal para reinstalar",
					4000,
				);
			}
		}
	} catch (error) {
		// onboarding must never block the terminal from opening
		window.log?.("warn", "terminalOnboarding failed:", error);
	}
}
