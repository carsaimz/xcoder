/**
 * SVG icon pack — Lucide-flavored vectors for the Xcoder UI.
 *
 * Tier 1 (Sidebar / activities) of the hybrid icon convention
 * (docs/ICONS.md): thin-stroke, 24x24, `currentColor`, no fill. These
 * complements the bundled icon font (`src/res/icons/`): glyphs registered
 * here are sharper and always available, independent of font coverage.
 *
 * Usage:
 *   - Sidebar apps: register the icon as `svg:<name>` (see sidebarApp.js)
 *   - Anywhere else: `import svgIcon from "utils/svgIcons"; svgIcon("search")`
 *
 * Pack files (design reuse): src/res/icons/svg/*.svg — regenerated from
 * this module by scripts/export_svg_pack.cjs. Keep both in sync there.
 *
 * Path data © Lucide Contributors, ISC license (https://lucide.dev).
 */

const ICONS = {
        files: [
                ["path", { d: "M20 7h-3a2 2 0 0 1-2-2V2" }],
                [
                        "path",
                        { d: "M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z" },
                ],
                ["path", { d: "M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8" }],
        ],
        search: [
                ["path", { d: "m21 21-4.34-4.34" }],
                ["circle", { cx: "11", cy: "11", r: "8" }],
        ],
        puzzle: [
                [
                        "path",
                        {
                                d: "M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z",
                        },
                ],
        ],
        brain: [
                [
                        "path",
                        {
                                d: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",
                        },
                ],
                [
                        "path",
                        {
                                d: "M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",
                        },
                ],
                ["path", { d: "M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" }],
                ["path", { d: "M17.599 6.5a3 3 0 0 0 .399-1.375" }],
                ["path", { d: "M6.003 5.125A3 3 0 0 0 6.401 6.5" }],
                ["path", { d: "M3.477 10.896a4 4 0 0 1 .585-.396" }],
                ["path", { d: "M19.938 10.5a4 4 0 0 1 .585.396" }],
                ["path", { d: "M6 18a4 4 0 0 1-1.967-.516" }],
                ["path", { d: "M19.967 17.484A4 4 0 0 1 18 18" }],
        ],
        "git-branch": [
                ["line", { x1: "6", x2: "6", y1: "3", y2: "15" }],
                ["circle", { cx: "18", cy: "6", r: "3" }],
                ["circle", { cx: "6", cy: "18", r: "3" }],
                ["path", { d: "M18 9a9 9 0 0 1-9 9" }],
        ],
        bell: [
                ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
                [
                        "path",
                        {
                                d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326",
                        },
                ],
        ],
        settings: [
                [
                        "path",
                        {
                                d: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",
                        },
                ],
                ["circle", { cx: "12", cy: "12", r: "3" }],
        ],
        terminal: [
                ["path", { d: "M12 19h8" }],
                ["path", { d: "m4 17 6-6-6-6" }],
        ],
        "square-terminal": [
                ["path", { d: "m7 11 2-2-2-2" }],
                ["path", { d: "M11 13h4" }],
                ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
        ],
        history: [
                ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
                ["path", { d: "M3 3v5h5" }],
                ["path", { d: "M12 7v5l4 2" }],
        ],
        "sliders-horizontal": [
                ["line", { x1: "21", x2: "14", y1: "4", y2: "4" }],
                ["line", { x1: "10", x2: "3", y1: "4", y2: "4" }],
                ["line", { x1: "21", x2: "12", y1: "12", y2: "12" }],
                ["line", { x1: "8", x2: "3", y1: "12", y2: "12" }],
                ["line", { x1: "21", x2: "16", y1: "20", y2: "20" }],
                ["line", { x1: "12", x2: "3", y1: "20", y2: "20" }],
                ["line", { x1: "14", x2: "14", y1: "2", y2: "6" }],
                ["line", { x1: "8", x2: "8", y1: "10", y2: "14" }],
                ["line", { x1: "16", x2: "16", y1: "18", y2: "22" }],
        ],
        save: [
                [
                        "path",
                        {
                                d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
                        },
                ],
                ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
                ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7" }],
        ],
        play: [["polygon", { points: "6 3 20 12 6 21 6 3" }]],
        "message-square": [
                [
                        "path",
                        { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
                ],
        ],
        sparkles: [
                [
                        "path",
                        {
                                d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
                        },
                ],
                ["path", { d: "M20 3v4" }],
                ["path", { d: "M22 5h-4" }],
                ["path", { d: "M4 17v2" }],
                ["path", { d: "M5 18H3" }],
        ],
        folder: [
                [
                        "path",
                        {
                                d: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
                        },
                ],
        ],
        bot: [
                ["path", { d: "M12 8V4H8" }],
                ["rect", { width: "16", height: "12", x: "4", y: "8", rx: "2" }],
                ["path", { d: "M2 14h2" }],
                ["path", { d: "M20 14h2" }],
                ["path", { d: "M15 13v2" }],
                ["path", { d: "M9 13v2" }],
        ],
        // ---- tier 2: settings / navigation (mix convention, docs/ICONS.md) ---
        "file-code": [
                ["path", { d: "M10 12.5 8 15l2 2.5" }],
                ["path", { d: "m14 12.5 2 2.5-2 2.5" }],
                ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
                [
                        "path",
                        { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" },
                ],
        ],
        globe: [
                ["circle", { cx: "12", cy: "12", r: "10" }],
                ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
                ["path", { d: "M2 12h20" }],
        ],
        braces: [
                [
                        "path",
                        {
                                d: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1",
                        },
                ],
                [
                        "path",
                        {
                                d: "M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1",
                        },
                ],
        ],
        palette: [
                [
                        "path",
                        {
                                d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
                        },
                ],
                ["circle", { cx: "13.5", cy: "6.5", r: ".5", fill: "currentColor" }],
                ["circle", { cx: "17.5", cy: "10.5", r: ".5", fill: "currentColor" }],
                ["circle", { cx: "6.5", cy: "12.5", r: ".5", fill: "currentColor" }],
                ["circle", { cx: "8.5", cy: "7.5", r: ".5", fill: "currentColor" }],
        ],
        zap: [
                [
                        "path",
                        {
                                d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
                        },
                ],
        ],
        cloud: [
                ["path", { d: "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" }],
        ],
        "file-cog": [
                ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
                ["path", { d: "m2.305 15.53.923-.382" }],
                ["path", { d: "m3.228 12.852-.924-.383" }],
                [
                        "path",
                        {
                                d: "M4.677 21.5a2 2 0 0 0 1.313.5H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v2.5",
                        },
                ],
                ["path", { d: "m4.852 11.228-.383-.923" }],
                ["path", { d: "m4.852 16.772-.383.924" }],
                ["path", { d: "m7.148 11.228.383-.923" }],
                ["path", { d: "m7.53 17.696-.382-.924" }],
                ["path", { d: "m8.772 12.852.923-.383" }],
                ["path", { d: "m8.772 15.148.923.383" }],
                ["circle", { cx: "6", cy: "14", r: "3" }],
        ],
        "rotate-ccw": [
                ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
                ["path", { d: "M3 3v5h5" }],
        ],
        info: [
                ["circle", { cx: "12", cy: "12", r: "10" }],
                ["path", { d: "M12 16v-4" }],
                ["path", { d: "M12 8h.01" }],
        ],
        download: [
                ["path", { d: "M12 15V3" }],
                ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
                ["path", { d: "m7 10 5 5 5-5" }],
        ],
        "book-open": [
                ["path", { d: "M12 7v14" }],
                [
                        "path",
                        {
                                d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
                        },
                ],
        ],
        bug: [
                ["path", { d: "m8 2 1.88 1.88" }],
                ["path", { d: "M14.12 3.88 16 2" }],
                ["path", { d: "M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" }],
                [
                        "path",
                        {
                                d: "M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6",
                        },
                ],
                ["path", { d: "M12 20v-9" }],
                ["path", { d: "M6.53 9C4.6 8.8 3 7.1 3 5" }],
                ["path", { d: "M6 13H2" }],
                ["path", { d: "M3 21c0-2.1 1.7-3.9 3.8-4" }],
                ["path", { d: "M20.97 5c0 2.1-1.6 3.8-3.5 4" }],
                ["path", { d: "M22 13h-4" }],
                ["path", { d: "M17.2 17c2.1.1 3.8 1.9 3.8 4" }],
        ],
        shield: [
                [
                        "path",
                        {
                                d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
                        },
                ],
        ],
        "git-pull-request": [
                ["circle", { cx: "18", cy: "18", r: "3" }],
                ["circle", { cx: "6", cy: "6", r: "3" }],
                ["path", { d: "M13 6h3a2 2 0 0 1 2 2v7" }],
                ["line", { x1: "6", x2: "6", y1: "9", y2: "21" }],
        ],
        "refresh-cw": [
                ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" }],
                ["path", { d: "M21 3v5h-5" }],
                ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" }],
                ["path", { d: "M8 16H3v5" }],
        ],
        "external-link": [
                ["path", { d: "M15 3h6v6" }],
                ["path", { d: "M10 14 21 3" }],
                ["path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }],
        ],
        // ---- tier 3: menus / context surfaces (mix convention, docs/ICONS.md) --
        plus: [
                ["path", { d: "M5 12h14" }],
                ["path", { d: "M12 5v14" }],
        ],
        x: [
                ["path", { d: "M18 6 6 18" }],
                ["path", { d: "m6 6 12 12" }],
        ],
        "file-plus": [
                [
                        "path",
                        { d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" },
                ],
                ["path", { d: "M14 2v4a2 2 0 0 0 2 2h4" }],
                ["path", { d: "M12 10v6" }],
                ["path", { d: "M9 13h6" }],
        ],
        lightbulb: [
                [
                        "path",
                        {
                                d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
                        },
                ],
                ["path", { d: "M9 18h6" }],
                ["path", { d: "M10 22h4" }],
        ],
        code: [
                ["polyline", { points: "16 18 22 12 16 6" }],
                ["polyline", { points: "8 6 2 12 8 18" }],
        ],
        "layout-grid": [
                ["rect", { width: "7", height: "7", x: "3", y: "3", rx: "1" }],
                ["rect", { width: "7", height: "7", x: "14", y: "3", rx: "1" }],
                ["rect", { width: "7", height: "7", x: "14", y: "14", rx: "1" }],
                ["rect", { width: "7", height: "7", x: "3", y: "14", rx: "1" }],
        ],
        "circle-help": [
                ["circle", { cx: "12", cy: "12", r: "10" }],
                ["path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }],
                ["path", { d: "M12 17h.01" }],
        ],
        "log-out": [
                ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }],
                ["polyline", { points: "16 17 21 12 16 7" }],
                ["line", { x1: "21", x2: "9", y1: "12", y2: "12" }],
        ],
        "share-2": [
                ["circle", { cx: "18", cy: "5", r: "3" }],
                ["circle", { cx: "6", cy: "12", r: "3" }],
                ["circle", { cx: "18", cy: "19", r: "3" }],
                ["line", { x1: "8.59", x2: "15.42", y1: "13.51", y2: "17.49" }],
                ["line", { x1: "15.41", x2: "8.59", y1: "6.51", y2: "10.49" }],
        ],
        pencil: [
                [
                        "path",
                        {
                                d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
                        },
                ],
                ["path", { d: "m15 5 4 4" }],
        ],
        house: [
                [
                        "path",
                        {
                                d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
                        },
                ],
                ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
        ],
        pin: [
                ["line", { x1: "12", x2: "12", y1: "17", y2: "22" }],
                [
                        "path",
                        {
                                d: "M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z",
                        },
                ],
        ],
        "pin-off": [
                ["line", { x1: "2", x2: "22", y1: "2", y2: "22" }],
                ["line", { x1: "12", x2: "12", y1: "17", y2: "22" }],
                [
                        "path",
                        {
                                d: "M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H9",
                        },
                ],
        ],
        "chevrons-right": [
                ["path", { d: "m6 17 5-5-5-5" }],
                ["path", { d: "m13 17 5-5-5-5" }],
        ],
        "chevrons-left": [
                ["path", { d: "m11 17-5-5 5-5" }],
                ["path", { d: "m18 17-5-5 5-5" }],
        ],
        "arrow-right-left": [
                ["path", { d: "m16 3 4 4-4 4" }],
                ["path", { d: "M20 7H4" }],
                ["path", { d: "m8 21-4-4 4-4" }],
                ["path", { d: "M4 17h16" }],
        ],
        "corner-up-left": [
                ["polyline", { points: "9 14 4 9 9 4" }],
                ["path", { d: "M20 20v-7a4 4 0 0 0-4-4H4" }],
        ],
        github: [
                [
                        "path",
                        {
                                d: "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
                        },
                ],
                ["path", { d: "M9 18c-4.51 2-5-2-7-2" }],
        ],
        user: [
                ["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }],
                ["circle", { cx: "12", cy: "7", r: "4" }],
        ],
        heart: [
                [
                        "path",
                        {
                                d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
                        },
                ],
        ],
        smartphone: [
                ["rect", { width: "14", height: "20", x: "5", y: "2", rx: "2", ry: "2" }],
                ["path", { d: "M12 18h.01" }],
        ],
        "circle-alert": [
                ["circle", { cx: "12", cy: "12", r: "10" }],
                ["line", { x1: "12", x2: "12", y1: "8", y2: "12" }],
                ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16" }],
        ],
};

/**
 * Builds an inline SVG element for the given pack icon.
 * @param {string} name icon name in the pack (without the "svg:" prefix)
 * @param {{strokeWidth?: number}} [opts]
 * @returns {SVGSVGElement | null} null when the name is not registered —
 * callers should fall back to the icon font glyph.
 */
export default function svgIcon(name, opts = {}) {
        const node = ICONS[name];
        if (!node) return null;
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("xmlns", NS);
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", String(opts.strokeWidth ?? 1.75));
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("xc-svg");
        for (const [tag, attrs] of node) {
                const el = document.createElementNS(NS, tag);
                for (const [key, value] of Object.entries(attrs)) {
                        el.setAttribute(key, String(value));
                }
                svg.append(el);
        }
        return svg;
}

/**
 * Whether an icon exists in the pack.
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
        return Boolean(ICONS[name]);
}

/** Names available in the pack (useful for tooling/debugging). */
export const iconNames = Object.keys(ICONS);
