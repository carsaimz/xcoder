import appSettings from "lib/settings";
import { createBuiltInTheme } from "./builder";
import { apply } from "./list";

const WHITE = "rgb(255, 255, 255)";

const dark = createBuiltInTheme("Dark", "dark", "free");
dark.primaryColor = "rgb(35, 39, 42)";
dark.primaryTextColor = "rgb(245, 245, 245)";
dark.secondaryColor = "rgb(45, 49, 52)";
dark.secondaryTextColor = "rgb(228, 228, 228)";
dark.activeColor = "rgb(66, 133, 244)";
dark.linkTextColor = "rgb(138, 180, 248)";
dark.borderColor = "rgba(188, 188, 188, 0.15)";
dark.popupIconColor = "rgb(245, 245, 245)";
dark.popupBackgroundColor = "rgb(35, 39, 42)";
dark.popupTextColor = "rgb(245, 245, 245)";
dark.popupActiveColor = "rgb(66, 133, 244)";
dark.activeTextColor = "rgb(255, 255, 255)";
dark.errorTextColor = "rgb(255, 185, 92)";
dark.dangerColor = "rgb(220, 38, 38)";
dark.scrollbarColor = "rgba(255, 255, 255, 0.2)";
dark.preferredEditorTheme = getSystemEditorTheme(true);
dark.preferredTerminalTheme = "dark";

const oled = createBuiltInTheme("OLED");
oled.primaryColor = "rgb(0, 0, 0)";
oled.primaryTextColor = "rgb(255, 255, 255)";
oled.darkenedPrimaryColor = "rgb(0, 0, 0)";
oled.secondaryColor = "rgb(8, 8, 8)";
oled.secondaryTextColor = "rgb(240, 240, 240)";
oled.activeColor = "rgb(0, 122, 255)";
oled.activeIconColor = "rgba(0, 122, 255, 0.8)";
oled.linkTextColor = "rgb(10, 132, 255)";
oled.borderColor = "rgba(255, 255, 255, 0.08)";
oled.popupIconColor = "rgb(255, 255, 255)";
oled.popupBackgroundColor = "rgb(0, 0, 0)";
oled.popupTextColor = "rgb(255, 255, 255)";
oled.popupActiveColor = "rgb(0, 122, 255)";
oled.popupBorderColor = "rgba(255, 255, 255, 0.1)";
oled.boxShadowColor = "rgba(0, 0, 0, 0.8)";
oled.buttonBackgroundColor = "rgb(0, 122, 255)";
oled.buttonTextColor = "rgb(255, 255, 255)";
oled.buttonActiveColor = "rgb(10, 132, 255)";
oled.activeTextColor = "rgb(255, 255, 255)";
oled.errorTextColor = "rgb(255, 69, 58)";
oled.dangerColor = "rgb(255, 69, 58)";
oled.scrollbarColor = "rgba(255, 255, 255, 0.1)";
oled.preferredEditorTheme = "tokyoNight";
oled.preferredTerminalTheme = "dark";

const ocean = createBuiltInTheme("Ocean");
ocean.darkenedPrimaryColor = "rgb(19, 19, 26)";
ocean.primaryColor = "rgb(32, 32, 44)";
ocean.primaryTextColor = WHITE;
ocean.secondaryColor = "rgb(38, 38, 53)";
ocean.secondaryTextColor = WHITE;
ocean.activeColor = "rgb(51, 153, 255)";
ocean.linkTextColor = "rgb(181, 180, 233)";
ocean.borderColor = "rgb(122, 122, 163)";
ocean.popupIconColor = WHITE;
ocean.popupBackgroundColor = "rgb(32, 32, 44)";
ocean.popupTextColor = WHITE;
ocean.popupActiveColor = "rgb(255, 215, 0)";
ocean.boxShadowColor = "rgba(0, 0, 0, 0.5)";
ocean.preferredEditorTheme = "solarizedDark";
ocean.preferredFont = "Fira Code";
ocean.preferredTerminalTheme = "ocean";

const bump = createBuiltInTheme("Bump");
bump.darkenedPrimaryColor = "rgb(24, 28, 36)";
bump.primaryColor = "rgb(36, 40, 52)";
bump.primaryTextColor = "rgb(230, 232, 238)";
bump.secondaryColor = "rgb(44, 50, 64)";
bump.secondaryTextColor = "rgb(175, 180, 192)";
bump.activeColor = "rgb(240, 113, 103)";
bump.linkTextColor = "rgb(255, 150, 130)";
bump.borderColor = "rgba(175, 180, 192, 0.2)";
bump.popupIconColor = "rgb(230, 232, 238)";
bump.popupBackgroundColor = "rgb(40, 44, 58)";
bump.popupTextColor = "rgb(230, 232, 238)";
bump.popupActiveColor = "rgb(240, 113, 103)";
bump.buttonBackgroundColor = "rgb(240, 113, 103)";
bump.buttonTextColor = "rgb(255, 255, 255)";
bump.buttonActiveColor = "rgb(210, 90, 80)";
bump.boxShadowColor = "rgba(0, 0, 0, 0.35)";
bump.activeTextColor = "rgb(255, 255, 255)";
bump.errorTextColor = "rgb(255, 180, 100)";
bump.dangerColor = "rgb(240, 70, 60)";
bump.scrollbarColor = "rgba(230, 232, 238, 0.12)";
bump.preferredEditorTheme = "one_dark";
bump.preferredTerminalTheme = "oneDark";

const bling = createBuiltInTheme("Bling");
bling.darkenedPrimaryColor = "rgb(16, 12, 28)";
bling.primaryColor = "rgb(25, 20, 40)";
bling.primaryTextColor = "rgb(228, 225, 240)";
bling.secondaryColor = "rgb(35, 28, 55)";
bling.secondaryTextColor = "rgb(170, 165, 190)";
bling.activeColor = "rgb(80, 200, 155)";
bling.linkTextColor = "rgb(120, 220, 180)";
bling.borderColor = "rgba(80, 200, 155, 0.2)";
bling.popupIconColor = "rgb(228, 225, 240)";
bling.popupBackgroundColor = "rgb(30, 24, 48)";
bling.popupTextColor = "rgb(228, 225, 240)";
bling.popupActiveColor = "rgb(80, 200, 155)";
bling.buttonBackgroundColor = "rgb(80, 200, 155)";
bling.buttonTextColor = "rgb(16, 12, 28)";
bling.buttonActiveColor = "rgb(55, 170, 130)";
bling.boxShadowColor = "rgba(0, 0, 0, 0.45)";
bling.activeTextColor = "rgb(16, 12, 28)";
bling.errorTextColor = "rgb(255, 170, 100)";
bling.dangerColor = "rgb(240, 85, 85)";
bling.scrollbarColor = "rgba(228, 225, 240, 0.1)";
bling.preferredEditorTheme = "tokyoNight";
bling.preferredTerminalTheme = "tokyoNight";

const moon = createBuiltInTheme("Moon");
moon.darkenedPrimaryColor = "rgb(16, 20, 26)";
moon.primaryColor = "rgb(26, 32, 42)";
moon.primaryTextColor = "rgb(210, 225, 230)";
moon.secondaryColor = "rgb(34, 42, 54)";
moon.secondaryTextColor = "rgb(150, 170, 180)";
moon.activeColor = "rgb(0, 188, 194)";
moon.linkTextColor = "rgb(80, 220, 225)";
moon.borderColor = "rgba(0, 188, 194, 0.2)";
moon.popupIconColor = "rgb(210, 225, 230)";
moon.popupBackgroundColor = "rgb(30, 38, 48)";
moon.popupTextColor = "rgb(210, 225, 230)";
moon.popupActiveColor = "rgb(0, 188, 194)";
moon.buttonBackgroundColor = "rgb(0, 188, 194)";
moon.buttonTextColor = "rgb(16, 20, 26)";
moon.buttonActiveColor = "rgb(0, 155, 160)";
moon.boxShadowColor = "rgba(0, 0, 0, 0.4)";
moon.activeTextColor = "rgb(16, 20, 26)";
moon.errorTextColor = "rgb(255, 170, 105)";
moon.dangerColor = "rgb(235, 75, 70)";
moon.scrollbarColor = "rgba(210, 225, 230, 0.12)";
moon.preferredEditorTheme = "tokyoNight";
moon.preferredTerminalTheme = "nord";

const atticus = createBuiltInTheme("Atticus");
atticus.darkenedPrimaryColor = "rgb(26, 24, 22)";
atticus.primaryColor = "rgb(38, 36, 33)";
atticus.primaryTextColor = "rgb(228, 222, 212)";
atticus.secondaryColor = "rgb(48, 45, 40)";
atticus.secondaryTextColor = "rgb(175, 168, 155)";
atticus.activeColor = "rgb(130, 170, 90)";
atticus.linkTextColor = "rgb(155, 195, 115)";
atticus.borderColor = "rgba(130, 170, 90, 0.2)";
atticus.popupIconColor = "rgb(228, 222, 212)";
atticus.popupBackgroundColor = "rgb(42, 40, 36)";
atticus.popupTextColor = "rgb(228, 222, 212)";
atticus.popupActiveColor = "rgb(130, 170, 90)";
atticus.buttonBackgroundColor = "rgb(130, 170, 90)";
atticus.buttonTextColor = "rgb(38, 36, 33)";
atticus.buttonActiveColor = "rgb(105, 145, 70)";
atticus.boxShadowColor = "rgba(0, 0, 0, 0.35)";
atticus.activeTextColor = "rgb(38, 36, 33)";
atticus.errorTextColor = "rgb(240, 160, 90)";
atticus.dangerColor = "rgb(210, 65, 55)";
atticus.scrollbarColor = "rgba(228, 222, 212, 0.12)";
atticus.preferredEditorTheme = "monokai";
atticus.preferredTerminalTheme = "gruvbox";

const tomyris = createBuiltInTheme("Tomyris");
tomyris.darkenedPrimaryColor = "rgb(22, 12, 20)";
tomyris.primaryColor = "rgb(32, 18, 28)";
tomyris.primaryTextColor = "rgb(235, 225, 232)";
tomyris.secondaryColor = "rgb(45, 26, 38)";
tomyris.secondaryTextColor = "rgb(185, 170, 178)";
tomyris.activeColor = "rgb(232, 75, 145)";
tomyris.linkTextColor = "rgb(250, 130, 180)";
tomyris.borderColor = "rgba(232, 75, 145, 0.2)";
tomyris.popupIconColor = "rgb(235, 225, 232)";
tomyris.popupBackgroundColor = "rgb(38, 22, 33)";
tomyris.popupTextColor = "rgb(235, 225, 232)";
tomyris.popupActiveColor = "rgb(232, 75, 145)";
tomyris.buttonBackgroundColor = "rgb(232, 75, 145)";
tomyris.buttonTextColor = "rgb(255, 255, 255)";
tomyris.buttonActiveColor = "rgb(200, 55, 120)";
tomyris.boxShadowColor = "rgba(0, 0, 0, 0.45)";
tomyris.activeTextColor = "rgb(255, 255, 255)";
tomyris.errorTextColor = "rgb(255, 175, 100)";
tomyris.dangerColor = "rgb(235, 65, 65)";
tomyris.scrollbarColor = "rgba(235, 225, 232, 0.1)";
tomyris.preferredEditorTheme = "monokai";
tomyris.preferredTerminalTheme = "dracula";

const menes = createBuiltInTheme("Menes");
menes.darkenedPrimaryColor = "rgb(18, 22, 28)";
menes.primaryColor = "rgb(28, 32, 40)";
menes.primaryTextColor = "rgb(225, 230, 240)";
menes.secondaryColor = "rgb(36, 42, 52)";
menes.secondaryTextColor = "rgb(140, 155, 175)";
menes.activeColor = "rgb(72, 210, 120)";
menes.linkTextColor = "rgb(100, 230, 150)";
menes.borderColor = "rgba(72, 210, 120, 0.18)";
menes.popupIconColor = "rgb(225, 230, 240)";
menes.popupBackgroundColor = "rgb(32, 38, 48)";
menes.popupTextColor = "rgb(225, 230, 240)";
menes.popupActiveColor = "rgb(72, 210, 120)";
menes.buttonBackgroundColor = "rgb(72, 210, 120)";
menes.buttonTextColor = "rgb(18, 22, 30)";
menes.buttonActiveColor = "rgb(50, 180, 95)";
menes.boxShadowColor = "rgba(0, 0, 0, 0.4)";
menes.activeTextColor = "rgb(18, 22, 30)";
menes.errorTextColor = "rgb(255, 165, 95)";
menes.dangerColor = "rgb(240, 75, 65)";
menes.scrollbarColor = "rgba(225, 230, 240, 0.12)";
menes.preferredEditorTheme = "one_dark";
menes.preferredTerminalTheme = "oneDark";

const light = createBuiltInTheme("Light", "light");
light.primaryColor = "rgb(255, 255, 255)";
light.primaryTextColor = "rgb(15, 23, 42)";
light.secondaryColor = "rgb(248, 250, 252)";
light.secondaryTextColor = "rgb(51, 65, 85)";
light.activeColor = "rgb(59, 130, 246)";
light.linkTextColor = "rgb(37, 99, 235)";
light.borderColor = "rgb(226, 232, 240)";
light.popupIconColor = "rgb(15, 23, 42)";
light.popupBackgroundColor = "rgb(255, 255, 255)";
light.popupTextColor = "rgb(15, 23, 42)";
light.popupActiveColor = "rgb(59, 130, 246)";
light.activeTextColor = "rgb(255, 255, 255)";
light.errorTextColor = "rgb(185, 28, 28)";
light.dangerColor = "rgb(220, 38, 38)";
light.scrollbarColor = "rgba(0, 0, 0, 0.2)";
light.preferredEditorTheme = getSystemEditorTheme(false);
light.preferredTerminalTheme = "light";

const system = createBuiltInTheme("System", "dark", "free");

export function getSystemEditorTheme(darkTheme) {
	if (darkTheme) {
		return "one_dark";
	} else {
		return "noctisLilac";
	}
}

/**
 * Update the system theme based on the user's preference.
 * @param {boolean} darkTheme Whether the user prefers a dark theme.
 * @param {boolean} applyTheme Whether to apply the refreshed theme immediately.
 */
export function updateSystemTheme(darkTheme, applyTheme = true) {
	if (darkTheme) {
		system.type = "dark";
		system.primaryColor = "rgb(35, 39, 42)";
		system.primaryTextColor = "rgb(245, 245, 245)";
		system.darkenedPrimaryColor = "rgb(24, 27, 30)";
		system.secondaryColor = "rgb(45, 49, 52)";
		system.secondaryTextColor = "rgb(228, 228, 228)";
		system.activeColor = "rgb(66, 133, 244)";
		system.linkTextColor = "rgb(138, 180, 248)";
		system.borderColor = "rgba(188, 188, 188, 0.15)";
		system.popupIconColor = "rgb(245, 245, 245)";

		system.popupBackgroundColor = "rgb(35, 39, 42)";
		system.popupTextColor = "rgb(245, 245, 245)";
		system.popupActiveColor = "rgb(66, 133, 244)";
	} else {
		system.type = "light";
		system.primaryColor = "rgb(255, 255, 255)";
		system.primaryTextColor = "rgb(15, 23, 42)";
		system.secondaryColor = "rgb(248, 250, 252)";
		system.secondaryTextColor = "rgb(51, 65, 85)";
		system.activeColor = "rgb(59, 130, 246)";
		system.linkTextColor = "rgb(37, 99, 235)";
		system.borderColor = "rgb(226, 232, 240)";
		system.popupIconColor = "rgb(15, 23, 42)";

		system.popupBackgroundColor = "rgb(255, 255, 255)";
		system.popupTextColor = "rgb(15, 23, 42)";
		system.popupActiveColor = "rgb(59, 130, 246)";
	}

	system.preferredEditorTheme = getSystemEditorTheme(darkTheme);

	if (applyTheme && appSettings?.value?.appTheme === "system") {
		apply(system.id);
		appSettings.update({ editorTheme: system.preferredEditorTheme }, false);
	}
}

const glass = createBuiltInTheme("Glass");
glass.darkenedPrimaryColor = "rgb(250, 250, 255)";
glass.primaryColor = "rgb(255, 255, 255)";
glass.primaryTextColor = "rgb(17, 24, 39)";
glass.secondaryColor = "rgba(255, 255, 255, 0.8)";
glass.secondaryTextColor = "rgb(55, 65, 81)";
glass.activeColor = "rgb(99, 102, 241)";
glass.linkTextColor = "rgb(79, 70, 229)";
glass.borderColor = "rgba(99, 102, 241, 0.2)";
glass.popupIconColor = "rgb(17, 24, 39)";
glass.popupBackgroundColor = "rgba(255, 255, 255, 0.95)";
glass.popupTextColor = "rgb(17, 24, 39)";
glass.popupActiveColor = "rgb(99, 102, 241)";
glass.buttonBackgroundColor = "rgb(99, 102, 241)";
glass.buttonTextColor = "rgb(255, 255, 255)";
glass.buttonActiveColor = "rgb(79, 70, 229)";
glass.boxShadowColor = "rgba(0, 0, 0, 0.1)";
glass.activeTextColor = "rgb(255, 255, 255)";
glass.errorTextColor = "rgb(185, 28, 28)";
glass.dangerColor = "rgb(220, 38, 38)";
glass.scrollbarColor = "rgba(0, 0, 0, 0.15)";
glass.preferredTerminalTheme = "glass";

const neon = createBuiltInTheme("Neon");
neon.darkenedPrimaryColor = "rgb(9, 9, 11)";
neon.primaryColor = "rgb(15, 15, 17)";
neon.primaryTextColor = "rgb(10, 255, 200)";
neon.secondaryColor = "rgb(24, 24, 27)";
neon.secondaryTextColor = "rgb(255, 255, 255)";
neon.activeColor = "rgb(255, 20, 147)";
neon.linkTextColor = "rgb(0, 255, 255)";
neon.borderColor = "rgba(10, 255, 200, 0.3)";
neon.popupIconColor = "rgb(10, 255, 200)";
neon.popupBackgroundColor = "rgb(15, 15, 17)";
neon.popupTextColor = "rgb(10, 255, 200)";
neon.popupActiveColor = "rgb(255, 20, 147)";
neon.buttonBackgroundColor = "rgb(255, 20, 147)";
neon.buttonTextColor = "rgb(0, 0, 0)";
neon.buttonActiveColor = "rgb(0, 255, 255)";
neon.boxShadowColor = "rgba(10, 255, 200, 0.2)";
neon.preferredEditorTheme = "monokai";
neon.activeTextColor = "rgb(0, 0, 0)";
neon.errorTextColor = "rgb(255, 20, 147)";
neon.dangerColor = "rgb(255, 20, 147)";
neon.scrollbarColor = "rgba(10, 255, 200, 0.3)";
neon.preferredTerminalTheme = "synthwave";

const glassDark = createBuiltInTheme("Glass Dark", "dark");
glassDark.darkenedPrimaryColor = "rgb(15, 15, 20)";
glassDark.primaryColor = "rgb(24, 24, 32)";
glassDark.primaryTextColor = "rgb(229, 231, 235)";
glassDark.secondaryColor = "rgba(31, 31, 42, 0.8)";
glassDark.secondaryTextColor = "rgb(156, 163, 175)";
glassDark.activeColor = "rgb(99, 102, 241)";
glassDark.linkTextColor = "rgb(129, 140, 248)";
glassDark.borderColor = "rgba(99, 102, 241, 0.3)";
glassDark.popupIconColor = "rgb(229, 231, 235)";
glassDark.popupBackgroundColor = "rgba(31, 31, 42, 0.95)";
glassDark.popupTextColor = "rgb(229, 231, 235)";
glassDark.popupActiveColor = "rgb(99, 102, 241)";
glassDark.buttonBackgroundColor = "rgb(99, 102, 241)";
glassDark.buttonTextColor = "rgb(255, 255, 255)";
glassDark.buttonActiveColor = "rgb(79, 70, 229)";
glassDark.boxShadowColor = "rgba(0, 0, 0, 0.4)";
glassDark.activeTextColor = "rgb(255, 255, 255)";
glassDark.errorTextColor = "rgb(248, 113, 113)";
glassDark.dangerColor = "rgb(239, 68, 68)";
glassDark.scrollbarColor = "rgba(255, 255, 255, 0.2)";
glassDark.preferredEditorTheme = "tokyoNight";
glassDark.preferredTerminalTheme = "glassDark";

const sunset = createBuiltInTheme("Sunset");
sunset.darkenedPrimaryColor = "rgb(251, 243, 235)";
sunset.primaryColor = "rgb(255, 251, 247)";
sunset.primaryTextColor = "rgb(124, 45, 18)";
sunset.secondaryColor = "rgb(254, 235, 217)";
sunset.secondaryTextColor = "rgb(154, 52, 18)";
sunset.activeColor = "rgb(251, 146, 60)";
sunset.linkTextColor = "rgb(234, 88, 12)";
sunset.borderColor = "rgb(253, 186, 116)";
sunset.popupIconColor = "rgb(124, 45, 18)";
sunset.popupBackgroundColor = "rgb(255, 251, 247)";
sunset.popupTextColor = "rgb(124, 45, 18)";
sunset.popupActiveColor = "rgb(251, 146, 60)";
sunset.buttonBackgroundColor = "rgb(251, 146, 60)";
sunset.buttonTextColor = "rgb(255, 255, 255)";
sunset.buttonActiveColor = "rgb(234, 88, 12)";
sunset.activeTextColor = "rgb(255, 255, 255)";
sunset.errorTextColor = "rgb(185, 28, 28)";
sunset.dangerColor = "rgb(220, 38, 38)";
sunset.scrollbarColor = "rgba(124, 45, 18, 0.2)";
sunset.preferredTerminalTheme = "sunset";

const obsidian = createBuiltInTheme("Obsidian");
obsidian.darkenedPrimaryColor = "rgb(18, 17, 21)";
obsidian.primaryColor = "rgb(28, 27, 31)";
obsidian.primaryTextColor = "rgb(232, 228, 220)";
obsidian.secondaryColor = "rgb(38, 37, 42)";
obsidian.secondaryTextColor = "rgb(185, 180, 172)";
obsidian.activeColor = "rgb(212, 175, 55)";
obsidian.linkTextColor = "rgb(230, 200, 120)";
obsidian.borderColor = "rgba(212, 175, 55, 0.18)";
obsidian.popupIconColor = "rgb(232, 228, 220)";
obsidian.popupBackgroundColor = "rgb(32, 31, 36)";
obsidian.popupTextColor = "rgb(232, 228, 220)";
obsidian.popupActiveColor = "rgb(212, 175, 55)";
obsidian.buttonBackgroundColor = "rgb(212, 175, 55)";
obsidian.buttonTextColor = "rgb(28, 27, 31)";
obsidian.buttonActiveColor = "rgb(184, 148, 36)";
obsidian.boxShadowColor = "rgba(0, 0, 0, 0.45)";
obsidian.activeTextColor = "rgb(28, 27, 31)";
obsidian.errorTextColor = "rgb(255, 152, 100)";
obsidian.dangerColor = "rgb(220, 80, 60)";
obsidian.scrollbarColor = "rgba(212, 175, 55, 0.18)";
obsidian.preferredEditorTheme = "one_dark";
obsidian.preferredTerminalTheme = "oneDark";

const ember = createBuiltInTheme("Ember");
ember.darkenedPrimaryColor = "rgb(22, 16, 13)";
ember.primaryColor = "rgb(32, 24, 20)";
ember.primaryTextColor = "rgb(240, 228, 210)";
ember.secondaryColor = "rgb(45, 35, 28)";
ember.secondaryTextColor = "rgb(200, 185, 165)";
ember.activeColor = "rgb(217, 130, 60)";
ember.linkTextColor = "rgb(240, 170, 100)";
ember.borderColor = "rgba(217, 130, 60, 0.22)";
ember.popupIconColor = "rgb(240, 228, 210)";
ember.popupBackgroundColor = "rgb(38, 30, 24)";
ember.popupTextColor = "rgb(240, 228, 210)";
ember.popupActiveColor = "rgb(217, 130, 60)";
ember.buttonBackgroundColor = "rgb(217, 130, 60)";
ember.buttonTextColor = "rgb(32, 24, 20)";
ember.buttonActiveColor = "rgb(190, 105, 40)";
ember.boxShadowColor = "rgba(0, 0, 0, 0.4)";
ember.activeTextColor = "rgb(32, 24, 20)";
ember.errorTextColor = "rgb(255, 160, 85)";
ember.dangerColor = "rgb(220, 60, 50)";
ember.scrollbarColor = "rgba(240, 228, 210, 0.12)";
ember.preferredEditorTheme = "monokai";
ember.preferredTerminalTheme = "sunset";

const dusk = createBuiltInTheme("Dusk");
dusk.darkenedPrimaryColor = "rgb(13, 11, 24)";
dusk.primaryColor = "rgb(20, 18, 35)";
dusk.primaryTextColor = "rgb(215, 210, 235)";
dusk.secondaryColor = "rgb(30, 27, 50)";
dusk.secondaryTextColor = "rgb(160, 155, 185)";
dusk.activeColor = "rgb(167, 105, 220)";
dusk.linkTextColor = "rgb(190, 150, 240)";
dusk.borderColor = "rgba(167, 105, 220, 0.2)";
dusk.popupIconColor = "rgb(215, 210, 235)";
dusk.popupBackgroundColor = "rgb(25, 23, 42)";
dusk.popupTextColor = "rgb(215, 210, 235)";
dusk.popupActiveColor = "rgb(167, 105, 220)";
dusk.buttonBackgroundColor = "rgb(167, 105, 220)";
dusk.buttonTextColor = "rgb(255, 255, 255)";
dusk.buttonActiveColor = "rgb(140, 80, 195)";
dusk.boxShadowColor = "rgba(0, 0, 0, 0.5)";
dusk.activeTextColor = "rgb(255, 255, 255)";
dusk.errorTextColor = "rgb(255, 170, 110)";
dusk.dangerColor = "rgb(235, 80, 100)";
dusk.scrollbarColor = "rgba(215, 210, 235, 0.12)";
dusk.preferredEditorTheme = "tokyoNight";
dusk.preferredTerminalTheme = "tokyoNight";

const carbon = createBuiltInTheme("Carbon");
carbon.darkenedPrimaryColor = "rgb(14, 14, 16)";
carbon.primaryColor = "rgb(22, 22, 24)";
carbon.primaryTextColor = "rgb(235, 235, 240)";
carbon.secondaryColor = "rgb(32, 32, 35)";
carbon.secondaryTextColor = "rgb(155, 155, 165)";
carbon.activeColor = "rgb(55, 142, 240)";
carbon.linkTextColor = "rgb(85, 165, 255)";
carbon.borderColor = "rgba(255, 255, 255, 0.08)";
carbon.popupIconColor = "rgb(235, 235, 240)";
carbon.popupBackgroundColor = "rgb(28, 28, 31)";
carbon.popupTextColor = "rgb(235, 235, 240)";
carbon.popupActiveColor = "rgb(55, 142, 240)";
carbon.buttonBackgroundColor = "rgb(55, 142, 240)";
carbon.buttonTextColor = "rgb(255, 255, 255)";
carbon.buttonActiveColor = "rgb(38, 118, 210)";
carbon.boxShadowColor = "rgba(0, 0, 0, 0.5)";
carbon.activeTextColor = "rgb(255, 255, 255)";
carbon.errorTextColor = "rgb(255, 140, 100)";
carbon.dangerColor = "rgb(235, 70, 60)";
carbon.scrollbarColor = "rgba(255, 255, 255, 0.1)";
carbon.preferredEditorTheme = "one_dark";
carbon.preferredTerminalTheme = "oneDark";

const mint = createBuiltInTheme("Mint", "light");
mint.darkenedPrimaryColor = "rgb(235, 245, 240)";
mint.primaryColor = "rgb(250, 253, 252)";
mint.primaryTextColor = "rgb(28, 42, 38)";
mint.secondaryColor = "rgb(240, 248, 245)";
mint.secondaryTextColor = "rgb(72, 92, 85)";
mint.activeColor = "rgb(4, 120, 87)";
mint.linkTextColor = "rgb(2, 100, 72)";
mint.borderColor = "rgb(209, 233, 225)";
mint.popupIconColor = "rgb(28, 42, 38)";
mint.popupBackgroundColor = "rgb(250, 253, 252)";
mint.popupTextColor = "rgb(28, 42, 38)";
mint.popupActiveColor = "rgb(4, 120, 87)";
mint.buttonBackgroundColor = "rgb(4, 120, 87)";
mint.buttonTextColor = "rgb(255, 255, 255)";
mint.buttonActiveColor = "rgb(2, 100, 72)";
mint.boxShadowColor = "rgba(0, 0, 0, 0.06)";
mint.activeTextColor = "rgb(255, 255, 255)";
mint.errorTextColor = "rgb(190, 40, 40)";
mint.dangerColor = "rgb(220, 38, 38)";
mint.scrollbarColor = "rgba(28, 42, 38, 0.12)";
mint.preferredEditorTheme = "noctisLilac";
mint.preferredTerminalTheme = "light";

const sandstone = createBuiltInTheme("Sandstone", "light");
sandstone.darkenedPrimaryColor = "rgb(238, 230, 218)";
sandstone.primaryColor = "rgb(252, 248, 242)";
sandstone.primaryTextColor = "rgb(60, 45, 35)";
sandstone.secondaryColor = "rgb(244, 238, 228)";
sandstone.secondaryTextColor = "rgb(110, 90, 70)";
sandstone.activeColor = "rgb(192, 92, 52)";
sandstone.linkTextColor = "rgb(175, 75, 40)";
sandstone.borderColor = "rgb(222, 210, 195)";
sandstone.popupIconColor = "rgb(60, 45, 35)";
sandstone.popupBackgroundColor = "rgb(252, 248, 242)";
sandstone.popupTextColor = "rgb(60, 45, 35)";
sandstone.popupActiveColor = "rgb(192, 92, 52)";
sandstone.buttonBackgroundColor = "rgb(192, 92, 52)";
sandstone.buttonTextColor = "rgb(255, 255, 255)";
sandstone.buttonActiveColor = "rgb(165, 72, 38)";
sandstone.boxShadowColor = "rgba(0, 0, 0, 0.06)";
sandstone.activeTextColor = "rgb(255, 255, 255)";
sandstone.errorTextColor = "rgb(180, 40, 35)";
sandstone.dangerColor = "rgb(200, 50, 45)";
sandstone.scrollbarColor = "rgba(60, 45, 35, 0.12)";
sandstone.preferredEditorTheme = "noctisLilac";
sandstone.preferredTerminalTheme = "solarizedLight";

const blossom = createBuiltInTheme("Blossom", "light");
blossom.darkenedPrimaryColor = "rgb(242, 234, 237)";
blossom.primaryColor = "rgb(254, 250, 251)";
blossom.primaryTextColor = "rgb(48, 38, 42)";
blossom.secondaryColor = "rgb(248, 240, 243)";
blossom.secondaryTextColor = "rgb(100, 80, 88)";
blossom.activeColor = "rgb(190, 75, 115)";
blossom.linkTextColor = "rgb(170, 55, 95)";
blossom.borderColor = "rgb(232, 218, 223)";
blossom.popupIconColor = "rgb(48, 38, 42)";
blossom.popupBackgroundColor = "rgb(254, 250, 251)";
blossom.popupTextColor = "rgb(48, 38, 42)";
blossom.popupActiveColor = "rgb(190, 75, 115)";
blossom.buttonBackgroundColor = "rgb(190, 75, 115)";
blossom.buttonTextColor = "rgb(255, 255, 255)";
blossom.buttonActiveColor = "rgb(160, 55, 95)";
blossom.boxShadowColor = "rgba(0, 0, 0, 0.06)";
blossom.activeTextColor = "rgb(255, 255, 255)";
blossom.errorTextColor = "rgb(200, 45, 40)";
blossom.dangerColor = "rgb(210, 50, 45)";
blossom.scrollbarColor = "rgba(48, 38, 42, 0.12)";
blossom.preferredEditorTheme = "noctisLilac";
blossom.preferredTerminalTheme = "light";

const custom = createBuiltInTheme("Custom");
custom.autoDarkened = true;

// ---- Xcoder default theme: VS Code Dark Modern palette ----------------
// The app follows the VS Code look (user request): #181818 chrome,
// #1f1f1f editor/menus, #cccccc text and the #0078d4 blue accent.
const xcoder = createBuiltInTheme("Xcoder", "dark");
xcoder.darkenedPrimaryColor = "rgb(11, 11, 12)";
xcoder.primaryColor = "rgb(24, 24, 24)";
xcoder.primaryTextColor = "rgb(204, 204, 204)";
xcoder.secondaryColor = "rgb(31, 31, 31)";
xcoder.secondaryTextColor = "rgb(157, 157, 157)";
xcoder.activeColor = "rgb(0, 120, 212)";
xcoder.activeIconColor = "rgb(77, 170, 252)";
xcoder.linkTextColor = "rgb(77, 170, 252)";
xcoder.borderColor = "rgb(43, 43, 43)";
xcoder.popupIconColor = "rgb(204, 204, 204)";
xcoder.popupBackgroundColor = "rgb(31, 31, 31)";
xcoder.popupTextColor = "rgb(204, 204, 204)";
xcoder.popupActiveColor = "rgb(0, 120, 212)";
// VS Code blue buttons (hover #005fb8) replace the old orange CTAs.
xcoder.buttonBackgroundColor = "rgb(0, 120, 212)";
xcoder.buttonTextColor = "rgb(255, 255, 255)";
xcoder.buttonActiveColor = "rgb(0, 95, 173)";
xcoder.boxShadowColor = "rgba(0, 0, 0, 0.55)";
xcoder.activeTextColor = "rgb(255, 255, 255)";
xcoder.errorTextColor = "rgb(241, 76, 76)";
xcoder.dangerColor = "rgb(228, 70, 70)";
xcoder.scrollbarColor = "rgba(121, 121, 121, 0.4)";
xcoder.popupBorderRadius = "6px";
xcoder.preferredEditorTheme = "vscodeDark";
xcoder.preferredTerminalTheme = "dark";

const aurora = createBuiltInTheme("Aurora", "dark");
aurora.darkenedPrimaryColor = "rgb(8, 20, 26)";
aurora.primaryColor = "rgb(12, 30, 38)";
aurora.primaryTextColor = "rgb(222, 240, 238)";
aurora.secondaryColor = "rgb(17, 40, 50)";
aurora.secondaryTextColor = "rgb(150, 190, 185)";
aurora.activeColor = "rgb(45, 220, 180)";
aurora.linkTextColor = "rgb(90, 235, 200)";
aurora.borderColor = "rgba(45, 220, 180, 0.18)";
aurora.popupIconColor = "rgb(222, 240, 238)";
aurora.popupBackgroundColor = "rgb(14, 34, 43)";
aurora.popupTextColor = "rgb(222, 240, 238)";
aurora.popupActiveColor = "rgb(45, 220, 180)";
aurora.buttonBackgroundColor = "rgb(45, 220, 180)";
aurora.buttonTextColor = "rgb(8, 20, 26)";
aurora.buttonActiveColor = "rgb(28, 180, 148)";
aurora.boxShadowColor = "rgba(0, 0, 0, 0.45)";
aurora.activeTextColor = "rgb(8, 20, 26)";
aurora.errorTextColor = "rgb(255, 175, 120)";
aurora.dangerColor = "rgb(235, 75, 75)";
aurora.scrollbarColor = "rgba(222, 240, 238, 0.12)";
aurora.preferredEditorTheme = "tokyoNight";
aurora.preferredTerminalTheme = "nord";

const nord = createBuiltInTheme("Nord", "dark");
nord.darkenedPrimaryColor = "rgb(38, 44, 54)";
nord.primaryColor = "rgb(46, 52, 64)";
nord.primaryTextColor = "rgb(216, 222, 233)";
nord.secondaryColor = "rgb(59, 66, 82)";
nord.secondaryTextColor = "rgb(180, 188, 203)";
nord.activeColor = "rgb(136, 192, 208)";
nord.linkTextColor = "rgb(129, 161, 193)";
nord.borderColor = "rgba(136, 192, 208, 0.2)";
nord.popupIconColor = "rgb(216, 222, 233)";
nord.popupBackgroundColor = "rgb(52, 58, 72)";
nord.popupTextColor = "rgb(216, 222, 233)";
nord.popupActiveColor = "rgb(136, 192, 208)";
nord.buttonBackgroundColor = "rgb(94, 129, 172)";
nord.buttonTextColor = "rgb(236, 239, 244)";
nord.buttonActiveColor = "rgb(76, 106, 144)";
nord.boxShadowColor = "rgba(0, 0, 0, 0.4)";
nord.activeTextColor = "rgb(46, 52, 64)";
nord.errorTextColor = "rgb(191, 97, 106)";
nord.dangerColor = "rgb(191, 97, 106)";
nord.scrollbarColor = "rgba(216, 222, 233, 0.14)";
nord.preferredEditorTheme = "tokyoNight";
nord.preferredTerminalTheme = "nord";

const matcha = createBuiltInTheme("Matcha", "dark");
matcha.darkenedPrimaryColor = "rgb(15, 24, 20)";
matcha.primaryColor = "rgb(22, 34, 29)";
matcha.primaryTextColor = "rgb(224, 238, 228)";
matcha.secondaryColor = "rgb(29, 45, 38)";
matcha.secondaryTextColor = "rgb(160, 190, 168)";
matcha.activeColor = "rgb(140, 200, 100)";
matcha.linkTextColor = "rgb(170, 220, 130)";
matcha.borderColor = "rgba(140, 200, 100, 0.2)";
matcha.popupIconColor = "rgb(224, 238, 228)";
matcha.popupBackgroundColor = "rgb(26, 40, 34)";
matcha.popupTextColor = "rgb(224, 238, 228)";
matcha.popupActiveColor = "rgb(140, 200, 100)";
matcha.buttonBackgroundColor = "rgb(140, 200, 100)";
matcha.buttonTextColor = "rgb(15, 24, 20)";
matcha.buttonActiveColor = "rgb(112, 170, 78)";
matcha.boxShadowColor = "rgba(0, 0, 0, 0.4)";
matcha.activeTextColor = "rgb(15, 24, 20)";
matcha.errorTextColor = "rgb(255, 170, 110)";
matcha.dangerColor = "rgb(225, 80, 70)";
matcha.scrollbarColor = "rgba(224, 238, 228, 0.12)";
matcha.preferredEditorTheme = "monokai";
matcha.preferredTerminalTheme = "gruvbox";

const mocha = createBuiltInTheme("Mocha", "dark");
mocha.darkenedPrimaryColor = "rgb(30, 22, 18)";
mocha.primaryColor = "rgb(43, 32, 26)";
mocha.primaryTextColor = "rgb(240, 226, 214)";
mocha.secondaryColor = "rgb(56, 42, 34)";
mocha.secondaryTextColor = "rgb(200, 180, 162)";
mocha.activeColor = "rgb(230, 150, 90)";
mocha.linkTextColor = "rgb(240, 175, 120)";
mocha.borderColor = "rgba(230, 150, 90, 0.2)";
mocha.popupIconColor = "rgb(240, 226, 214)";
mocha.popupBackgroundColor = "rgb(50, 38, 30)";
mocha.popupTextColor = "rgb(240, 226, 214)";
mocha.popupActiveColor = "rgb(230, 150, 90)";
mocha.buttonBackgroundColor = "rgb(230, 150, 90)";
mocha.buttonTextColor = "rgb(30, 22, 18)";
mocha.buttonActiveColor = "rgb(198, 122, 66)";
mocha.boxShadowColor = "rgba(0, 0, 0, 0.45)";
mocha.activeTextColor = "rgb(30, 22, 18)";
mocha.errorTextColor = "rgb(255, 165, 110)";
mocha.dangerColor = "rgb(220, 85, 70)";
mocha.scrollbarColor = "rgba(240, 226, 214, 0.12)";
mocha.preferredEditorTheme = "one_dark";
mocha.preferredTerminalTheme = "gruvbox";

const sakura = createBuiltInTheme("Sakura", "light");
sakura.darkenedPrimaryColor = "rgb(240, 226, 232)";
sakura.primaryColor = "rgb(253, 246, 249)";
sakura.primaryTextColor = "rgb(58, 42, 50)";
sakura.secondaryColor = "rgb(248, 234, 240)";
sakura.secondaryTextColor = "rgb(120, 90, 104)";
sakura.activeColor = "rgb(215, 80, 130)";
sakura.linkTextColor = "rgb(190, 60, 110)";
sakura.borderColor = "rgb(238, 214, 224)";
sakura.popupIconColor = "rgb(58, 42, 50)";
sakura.popupBackgroundColor = "rgb(253, 246, 249)";
sakura.popupTextColor = "rgb(58, 42, 50)";
sakura.popupActiveColor = "rgb(215, 80, 130)";
sakura.buttonBackgroundColor = "rgb(215, 80, 130)";
sakura.buttonTextColor = "rgb(255, 255, 255)";
sakura.buttonActiveColor = "rgb(185, 60, 108)";
sakura.boxShadowColor = "rgba(0, 0, 0, 0.06)";
sakura.activeTextColor = "rgb(255, 255, 255)";
sakura.errorTextColor = "rgb(190, 40, 40)";
sakura.dangerColor = "rgb(210, 50, 45)";
sakura.scrollbarColor = "rgba(58, 42, 50, 0.12)";
sakura.preferredEditorTheme = "noctisLilac";
sakura.preferredTerminalTheme = "light";

// ---- VS Code collection (user request: "mais temas VS") -------------------
// Real VS Code desktop palettes: Dark+/Light+ (classic blue status bar),
// the Modern pair (Dark Modern is the Xcoder default above), Monokai and
// both Solarized flavors as they ship in VS Code.
const vsDarkPlus = createBuiltInTheme("VS Dark+", "dark", "free");
vsDarkPlus.darkenedPrimaryColor = "rgb(21, 21, 22)";
vsDarkPlus.primaryColor = "rgb(37, 37, 38)";
vsDarkPlus.primaryTextColor = "rgb(204, 204, 204)";
vsDarkPlus.secondaryColor = "rgb(30, 30, 30)";
vsDarkPlus.secondaryTextColor = "rgb(204, 204, 204)";
vsDarkPlus.activeColor = "rgb(0, 122, 204)";
vsDarkPlus.activeIconColor = "rgb(41, 163, 217)";
vsDarkPlus.linkTextColor = "rgb(56, 156, 224)";
vsDarkPlus.borderColor = "rgb(69, 69, 69)";
vsDarkPlus.popupIconColor = "rgb(204, 204, 204)";
vsDarkPlus.popupBackgroundColor = "rgb(37, 37, 38)";
vsDarkPlus.popupTextColor = "rgb(204, 204, 204)";
vsDarkPlus.popupActiveColor = "rgb(0, 122, 204)";
vsDarkPlus.buttonBackgroundColor = "rgb(0, 122, 204)";
vsDarkPlus.buttonTextColor = "rgb(255, 255, 255)";
vsDarkPlus.buttonActiveColor = "rgb(0, 98, 163)";
vsDarkPlus.boxShadowColor = "rgba(0, 0, 0, 0.5)";
vsDarkPlus.activeTextColor = "rgb(255, 255, 255)";
vsDarkPlus.errorTextColor = "rgb(244, 96, 108)";
vsDarkPlus.dangerColor = "rgb(190, 50, 50)";
vsDarkPlus.scrollbarColor = "rgba(121, 121, 121, 0.4)";
vsDarkPlus.statusBarColor = "rgb(0, 122, 204)";
vsDarkPlus.statusBarTextColor = "rgb(255, 255, 255)";
vsDarkPlus.popupBorderRadius = "6px";
vsDarkPlus.preferredEditorTheme = "vscodeDark";
vsDarkPlus.preferredTerminalTheme = "dark";

const vsLightPlus = createBuiltInTheme("VS Light+", "light", "free");
vsLightPlus.darkenedPrimaryColor = "rgb(220, 220, 220)";
vsLightPlus.primaryColor = "rgb(243, 243, 243)";
vsLightPlus.primaryTextColor = "rgb(50, 50, 50)";
vsLightPlus.secondaryColor = "rgb(255, 255, 254)";
vsLightPlus.secondaryTextColor = "rgb(60, 60, 60)";
vsLightPlus.activeColor = "rgb(0, 122, 204)";
vsLightPlus.activeIconColor = "rgb(0, 120, 215)";
vsLightPlus.linkTextColor = "rgb(0, 102, 177)";
vsLightPlus.borderColor = "rgb(200, 200, 200)";
vsLightPlus.popupIconColor = "rgb(50, 50, 50)";
vsLightPlus.popupBackgroundColor = "rgb(248, 248, 248)";
vsLightPlus.popupTextColor = "rgb(50, 50, 50)";
vsLightPlus.popupActiveColor = "rgb(0, 120, 215)";
vsLightPlus.buttonBackgroundColor = "rgb(0, 120, 215)";
vsLightPlus.buttonTextColor = "rgb(255, 255, 255)";
vsLightPlus.buttonActiveColor = "rgb(0, 98, 163)";
vsLightPlus.boxShadowColor = "rgba(0, 0, 0, 0.16)";
vsLightPlus.activeTextColor = "rgb(255, 255, 255)";
vsLightPlus.errorTextColor = "rgb(205, 49, 49)";
vsLightPlus.dangerColor = "rgb(190, 50, 50)";
vsLightPlus.scrollbarColor = "rgba(100, 100, 100, 0.4)";
vsLightPlus.statusBarColor = "rgb(0, 122, 204)";
vsLightPlus.statusBarTextColor = "rgb(255, 255, 255)";
vsLightPlus.popupBorderRadius = "6px";
vsLightPlus.preferredEditorTheme = "vscodeLight";
vsLightPlus.preferredTerminalTheme = "light";

const vsLightModern = createBuiltInTheme("VS Light Modern", "light", "free");
vsLightModern.darkenedPrimaryColor = "rgb(232, 232, 232)";
vsLightModern.primaryColor = "rgb(248, 248, 248)";
vsLightModern.primaryTextColor = "rgb(59, 59, 59)";
vsLightModern.secondaryColor = "rgb(255, 255, 255)";
vsLightModern.secondaryTextColor = "rgb(59, 59, 59)";
vsLightModern.activeColor = "rgb(0, 95, 184)";
vsLightModern.activeIconColor = "rgb(0, 95, 184)";
vsLightModern.linkTextColor = "rgb(0, 95, 184)";
vsLightModern.borderColor = "rgb(229, 229, 229)";
vsLightModern.popupIconColor = "rgb(59, 59, 59)";
vsLightModern.popupBackgroundColor = "rgb(255, 255, 255)";
vsLightModern.popupTextColor = "rgb(59, 59, 59)";
vsLightModern.popupActiveColor = "rgb(0, 95, 184)";
vsLightModern.buttonBackgroundColor = "rgb(0, 95, 184)";
vsLightModern.buttonTextColor = "rgb(255, 255, 255)";
vsLightModern.buttonActiveColor = "rgb(0, 76, 148)";
vsLightModern.boxShadowColor = "rgba(0, 0, 0, 0.14)";
vsLightModern.activeTextColor = "rgb(255, 255, 255)";
vsLightModern.errorTextColor = "rgb(226, 67, 67)";
vsLightModern.dangerColor = "rgb(200, 55, 55)";
vsLightModern.scrollbarColor = "rgba(100, 100, 100, 0.35)";
vsLightModern.statusBarColor = "rgb(248, 248, 248)";
vsLightModern.statusBarTextColor = "rgb(59, 59, 59)";
vsLightModern.popupBorderRadius = "6px";
vsLightModern.preferredEditorTheme = "vscodeLight";
vsLightModern.preferredTerminalTheme = "light";

const vsMonokai = createBuiltInTheme("VS Monokai", "dark", "free");
vsMonokai.darkenedPrimaryColor = "rgb(21, 22, 19)";
vsMonokai.primaryColor = "rgb(30, 31, 28)";
vsMonokai.primaryTextColor = "rgb(220, 222, 214)";
vsMonokai.secondaryColor = "rgb(39, 40, 34)";
vsMonokai.secondaryTextColor = "rgb(220, 222, 214)";
vsMonokai.activeColor = "rgb(166, 226, 46)";
vsMonokai.activeIconColor = "rgb(230, 97, 139)";
vsMonokai.linkTextColor = "rgb(230, 97, 139)";
vsMonokai.borderColor = "rgba(220, 222, 214, 0.16)";
vsMonokai.popupIconColor = "rgb(220, 222, 214)";
vsMonokai.popupBackgroundColor = "rgb(34, 35, 30)";
vsMonokai.popupTextColor = "rgb(220, 222, 214)";
vsMonokai.popupActiveColor = "rgb(166, 226, 46)";
vsMonokai.buttonBackgroundColor = "rgb(166, 226, 46)";
vsMonokai.buttonTextColor = "rgb(30, 31, 28)";
vsMonokai.buttonActiveColor = "rgb(140, 195, 35)";
vsMonokai.boxShadowColor = "rgba(0, 0, 0, 0.45)";
vsMonokai.activeTextColor = "rgb(30, 31, 28)";
vsMonokai.errorTextColor = "rgb(249, 38, 114)";
vsMonokai.dangerColor = "rgb(249, 38, 114)";
vsMonokai.scrollbarColor = "rgba(220, 222, 214, 0.14)";
vsMonokai.popupBorderRadius = "6px";
vsMonokai.preferredEditorTheme = "monokai";
vsMonokai.preferredTerminalTheme = "gruvbox";

const solarizedDark = createBuiltInTheme("Solarized Dark", "dark", "free");
solarizedDark.darkenedPrimaryColor = "rgb(0, 32, 40)";
solarizedDark.primaryColor = "rgb(0, 43, 54)";
solarizedDark.primaryTextColor = "rgb(147, 161, 161)";
solarizedDark.secondaryColor = "rgb(7, 54, 66)";
solarizedDark.secondaryTextColor = "rgb(147, 161, 161)";
solarizedDark.activeColor = "rgb(38, 139, 210)";
solarizedDark.activeIconColor = "rgb(42, 161, 152)";
solarizedDark.linkTextColor = "rgb(42, 161, 152)";
solarizedDark.borderColor = "rgba(88, 110, 117, 0.4)";
solarizedDark.popupIconColor = "rgb(147, 161, 161)";
solarizedDark.popupBackgroundColor = "rgb(7, 54, 66)";
solarizedDark.popupTextColor = "rgb(147, 161, 161)";
solarizedDark.popupActiveColor = "rgb(38, 139, 210)";
solarizedDark.buttonBackgroundColor = "rgb(38, 139, 210)";
solarizedDark.buttonTextColor = "rgb(253, 246, 227)";
solarizedDark.buttonActiveColor = "rgb(24, 113, 173)";
solarizedDark.boxShadowColor = "rgba(0, 0, 0, 0.5)";
solarizedDark.activeTextColor = "rgb(253, 246, 227)";
solarizedDark.errorTextColor = "rgb(220, 50, 47)";
solarizedDark.dangerColor = "rgb(203, 75, 22)";
solarizedDark.scrollbarColor = "rgba(147, 161, 161, 0.25)";
solarizedDark.popupBorderRadius = "6px";
solarizedDark.preferredEditorTheme = "solarizedDark";
solarizedDark.preferredTerminalTheme = "dark";

const solarizedLight = createBuiltInTheme("Solarized Light", "light", "free");
solarizedLight.darkenedPrimaryColor = "rgb(221, 213, 192)";
solarizedLight.primaryColor = "rgb(238, 232, 213)";
solarizedLight.primaryTextColor = "rgb(88, 110, 117)";
solarizedLight.secondaryColor = "rgb(253, 246, 227)";
solarizedLight.secondaryTextColor = "rgb(101, 123, 131)";
solarizedLight.activeColor = "rgb(38, 139, 210)";
solarizedLight.activeIconColor = "rgb(42, 161, 152)";
solarizedLight.linkTextColor = "rgb(42, 161, 152)";
solarizedLight.borderColor = "rgba(88, 110, 117, 0.3)";
solarizedLight.popupIconColor = "rgb(88, 110, 117)";
solarizedLight.popupBackgroundColor = "rgb(253, 246, 227)";
solarizedLight.popupTextColor = "rgb(88, 110, 117)";
solarizedLight.popupActiveColor = "rgb(38, 139, 210)";
solarizedLight.buttonBackgroundColor = "rgb(38, 139, 210)";
solarizedLight.buttonTextColor = "rgb(255, 255, 255)";
solarizedLight.buttonActiveColor = "rgb(24, 113, 173)";
solarizedLight.boxShadowColor = "rgba(0, 0, 0, 0.18)";
solarizedLight.activeTextColor = "rgb(255, 255, 255)";
solarizedLight.errorTextColor = "rgb(220, 50, 47)";
solarizedLight.dangerColor = "rgb(203, 75, 22)";
solarizedLight.scrollbarColor = "rgba(88, 110, 117, 0.3)";
solarizedLight.popupBorderRadius = "6px";
solarizedLight.preferredEditorTheme = "solarizedLight";
solarizedLight.preferredTerminalTheme = "light";

export default [
	system,
	createBuiltInTheme("Legacy", "dark", "free"),
	dark,
	light,
	xcoder,
	vsDarkPlus,
	vsLightPlus,
	vsLightModern,
	vsMonokai,
	solarizedDark,
	solarizedLight,
	glass,
	glassDark,
	neon,
	sunset,
	oled,
	ocean,
	bump,
	bling,
	moon,
	atticus,
	tomyris,
	menes,
	obsidian,
	ember,
	dusk,
	carbon,
	aurora,
	nord,
	matcha,
	mocha,
	mint,
	sandstone,
	blossom,
	sakura,
	custom,
];
