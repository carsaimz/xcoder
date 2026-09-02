import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockBackend = {
	config: { announcements: [{ id: "a1", text: "Hello" }], marketplaceUrl: "" },
	sendFeedback: vi.fn(),
};

vi.mock("lib/backend", () => ({
	backendConfig: () => mockBackend.config,
	sendFeedback: (...args) => mockBackend.sendFeedback(...args),
	backendUrl: () => "https://xcoder.vercel.app",
	deviceId: () => "test-device",
}));

vi.mock("lib/settings", () => ({
	default: {
		value: {
			firebaseEnabled: false,
		},
		update: vi.fn(),
	},
}));

import settings from "lib/settings";
import {
	fromFirestoreFields,
	getDocument,
	isReady,
	logEvent,
	toFirestoreFields,
} from "lib/firebaseLite";

describe("firebaseLite", () => {
	beforeEach(() => {
		mockBackend.sendFeedback.mockReset();
		mockBackend.sendFeedback.mockResolvedValue(true);
	});

	it("is ready only when the user enabled events", () => {
		expect(isReady()).toBe(false);
		settings.value.firebaseEnabled = true;
		expect(isReady()).toBe(true);
	});

	it("does not send events when not ready", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		await logEvent("test");
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(mockBackend.sendFeedback).not.toHaveBeenCalled();
	});

	it("routes events to the site feedback API when ready", async () => {
		settings.value.firebaseEnabled = true;

		const result = await logEvent("chat_sent", { model: "llama" });

		expect(result).toBe(true);
		expect(mockBackend.sendFeedback).toHaveBeenCalledWith("event", {
			name: "chat_sent",
			model: "llama",
		});
	});

	it("returns false when the site rejects the event", async () => {
		settings.value.firebaseEnabled = true;
		mockBackend.sendFeedback.mockResolvedValue(false);
		const result = await logEvent("x");
		expect(result).toBe(false);
	});

	it("reads remote config documents served by the site", async () => {
		settings.value.firebaseEnabled = true;

		const announcements = await getDocument("xcoder_config", "announcements");
		expect(announcements).toEqual({
			announcements: [{ id: "a1", text: "Hello" }],
		});

		const full = await getDocument("xcoder_config", "config");
		expect(full).toEqual(mockBackend.config);

		expect(await getDocument("xcoder_config", "missing")).toBeNull();
	});

	it("field converters round-trip scalars", () => {
		const plain = { a: "x", b: true, c: 3, d: 1.5 };
		expect(fromFirestoreFields(toFirestoreFields(plain))).toEqual(plain);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	settings.value.firebaseEnabled = false;
});
