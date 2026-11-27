#!/usr/bin/env node
/**
 * Latest tag per release channel.
 *
 * Channels are INDEPENDENT (user request, v1.8.46): a stable release
 * must never be blocked by a higher beta tag and vice versa, so each
 * workflow compares only against tags of its own channel.
 *
 *   stable channel : v1.8.44, v1.8.45, ...      (no -beta/-rc suffix)
 *   beta channel   : v1.8.45-beta, v1.8.46-beta.2, ...
 *
 * Usage:
 *   node utils/scripts/latest-channel-tag.mjs [--beta] [--exclude <tag>]
 *
 * Prints the highest tag of the channel (e.g. "v1.8.44"); empty output
 * when the channel has no tags yet (or only the excluded one).
 */

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Whether a tag belongs to the beta/pre-release channel.
 * Matches v1.2.3-beta, v1.2.3-beta.2, v1.2.3-rc.1 ... (any -beta/-rc
 * prerelease suffix); a plain stable tag like v1.2.3 returns false.
 * @param {string} tag
 * @returns {boolean}
 */
export function isBetaTag(tag) {
        return /-(beta|rc)/.test(String(tag ?? ""));
}

/**
 * Filters a descending version-sorted tag list to one channel.
 * @param {string[]} tags tags sorted highest-first
 * @param {"stable"|"beta"} channel
 * @returns {string[]} tags of the channel, original order kept
 */
export function filterChannelTags(tags, channel) {
        const wantBeta = channel === "beta";
        return (tags ?? []).filter((tag) => isBetaTag(tag) === wantBeta);
}

/**
 * Highest tag of a channel, optionally excluding one tag (the tag being
 * re-pointed by a "force" re-run must not be compared against itself).
 * @param {string[]} tags tags sorted highest-first
 * @param {"stable"|"beta"} channel
 * @param {string} [exclude] tag to skip (e.g. the current release tag)
 * @returns {string} highest tag or "" when the channel is empty
 */
export function latestChannelTag(tags, channel, exclude) {
        const list = filterChannelTags(tags, channel).filter(
                (tag) => tag && tag !== exclude,
        );
        return list[0] ?? "";
}

/** CLI entry point. */
function main() {
        const args = process.argv.slice(2);
        const channel = args.includes("--beta") ? "beta" : "stable";
        const excludeIndex = args.indexOf("--exclude");
        const exclude = excludeIndex !== -1 ? args[excludeIndex + 1] : undefined;

        let tags = [];
        try {
                tags = execFileSync("git", ["tag", "--sort=-v:refname"], {
                        encoding: "utf8",
                })
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean);
        } catch {
                // no git or no tags — treat as an empty channel
        }
        process.stdout.write(`${latestChannelTag(tags, channel, exclude)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
        main();
}
