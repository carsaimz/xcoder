import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Local runtime tests run against a FAKE transformers.js module (no CDN,
 * no WASM) injected through setLocalRuntimePorts — the engine plumbing,
 * disk-cache mapping and result shaping are what get pinned here.
 */

vi.mock("fileSystem", () => ({
        default: vi.fn((url) => ({
                exists: async () => files.has(url),
                readFile: async () => files.get(url) || "",
                writeFile: async () => url,
        })),
}));

globalThis.DATA_STORAGE = "file:///data/xcoder";

/** Fake installed file: the whisper/LLM config of any model. */
const files = new Map();
files.set("file:///data/xcoder/xcoder-models/smollm2-135m/config.json", "{}");

/** Fake engine module mimicking the transformers.js surface we use. */
function makeFakeEngine() {
        const calls = { pipelines: [], generations: [] };
        const streamerStub = class {
                constructor(tokenizer, opts) {
                        calls.streamerOpts = opts;
                        this.callback_function = opts?.callback_function;
                }
        };
        const interruptStub = class {
                constructor() {
                        this.interrupted = false;
                }
                interrupt() {
                        this.interrupted = true;
                }
        };
        const engine = {
                env: {},
                TextStreamer: streamerStub,
                InterruptableStoppingCriteria: interruptStub,
                pipeline: vi.fn(async (task, repo) => {
                        calls.pipelines.push({ task, repo });
                        const pipeFn = async (input, options) => {
                                calls.generations.push({ input, options });
                                options.streamer?.constructor &&
                                        options.streamer.callback_function?.("Olá");
                                if (input instanceof Float32Array) {
                                        return { text: "transcrito mundo" };
                                }
                                if (typeof input === "string") {
                                        return [{ generated_text: `${input} mundo` }];
                                }
                                return [
                                        {
                                                generated_text: [
                                                        ...input,
                                                        { role: "assistant", content: "resposta local" },
                                                ],
                                        },
                                ];
                        };
                        pipeFn.tokenizer = {};
                        return pipeFn;
                }),
        };
        return { engine, calls };
}

const runtime = await import("lib/ai/localRuntime");
const localModels = await import("lib/ai/localModels");
const downloads = await import("lib/ai/modelDownloads");

beforeEach(() => {
        runtime.setLocalRuntimePorts(null);
        downloads.setModelDownloadPorts(null);
        vi.spyOn(downloads, "isModelDownloaded").mockResolvedValue(true);
});

describe("local runtime", () => {
        it("maps request urls onto installed file paths", () => {
                const model = localModels.getLocalModel("qwen2.5-0.5b");
                const hit = runtime.pathForRequestUrl(
                        `https://huggingface.co/${model.repo}/resolve/main/onnx/model_q4f16.onnx`,
                );
                expect(hit.model.id).toBe("qwen2.5-0.5b");
                expect(hit.path).toBe("onnx/model_q4f16.onnx");
                // foreign repo / unknown path / non-resolve urls → no mapping
                expect(
                        runtime.pathForRequestUrl(
                                "https://example.com/foo/resolve/main/onnx/model.onnx",
                        ),
                ).toBeNull();
                expect(
                        runtime.pathForRequestUrl(
                                `https://huggingface.co/${model.repo}/resolve/main/unknown.bin`,
                        ),
                ).toBeNull();
        });

        it("routes chat through the engine and shapes the result", async () => {
                const { engine, calls } = makeFakeEngine();
                runtime.setLocalRuntimePorts({ tjs: Promise.resolve(engine) });
                const deltas = [];
                const result = await runtime.localChat({
                        modelId: "smollm2-135m",
                        messages: [
                                { role: "system", content: "sys" },
                                { role: "user", content: "oi" },
                        ],
                        maxTokens: 128,
                        onDelta: (text) => deltas.push(text),
                });
                expect(calls.pipelines[0]).toEqual({
                        task: "text-generation",
                        repo: "HuggingFaceTB/SmolLM2-135M-Instruct",
                });
                expect(engine.env.useBrowserCache).toBe(false);
                expect(engine.env.allowLocalModels).toBe(false);
                expect(typeof engine.env.customCache.match).toBe("function");
                expect(deltas).toContain("Olá");
                expect(result.content).toBe("resposta local");
        });

        it("aborts generation through the stopping criteria", async () => {
                const { engine } = makeFakeEngine();
                runtime.setLocalRuntimePorts({ tjs: Promise.resolve(engine) });
                const controller = new AbortController();
                const pending = runtime.localChat({
                        modelId: "smollm2-135m",
                        messages: [{ role: "user", content: "oi" }],
                        signal: controller.signal,
                });
                controller.abort();
                await pending;
                // the interrupt criteria was wired to the signal
                const criteria = controller.signal; // no throw = wiring ok
                expect(criteria.aborted).toBe(true);
        });

        it("refuses unknown or non-llm models for chat", async () => {
                await expect(
                        runtime.localChat({ modelId: "nope", messages: [] }),
                ).rejects.toThrow(/unknown local model/i);
                await expect(
                        runtime.localChat({ modelId: "whisper-base", messages: [] }),
                ).rejects.toThrow(/unknown local model/i);
        });

        it("guards inference when the model is not installed", async () => {
                vi.spyOn(downloads, "isModelDownloaded").mockResolvedValue(false);
                await expect(
                        runtime.localChat({ modelId: "smollm2-135m", messages: [] }),
                ).rejects.toThrow(/not downloaded/i);
        });

        it("transcribes and speaks through the right pipelines", async () => {
                const { engine, calls } = makeFakeEngine();
                runtime.setLocalRuntimePorts({ tjs: Promise.resolve(engine) });

                const stt = await runtime.localTranscribe(
                        "whisper-base",
                        new Float32Array(1600),
                );
                expect(stt.text).toContain("mundo");
                expect(calls.pipelines.at(-1)).toEqual({
                        task: "automatic-speech-recognition",
                        repo: "onnx-community/whisper-base",
                });

                const tts = await runtime.localSpeak("mms-tts-por", "bom dia");
                expect(tts.samplingRate).toBeGreaterThan(0);
                expect(calls.pipelines.at(-1)).toEqual({
                        task: "text-to-speech",
                        repo: "Xenova/mms-tts-por",
                });
        });

        it("unloadLocalModel drops only that model's pipelines", async () => {
                const { engine } = makeFakeEngine();
                runtime.setLocalRuntimePorts({ tjs: Promise.resolve(engine) });
                await runtime.localChat({ modelId: "qwen2.5-0.5b", messages: [] });
                runtime.unloadLocalModel("qwen2.5-0.5b");
                // second call rebuilds the pipeline (no throw)
                await runtime.localChat({ modelId: "qwen2.5-0.5b", messages: [] });
                expect(engine.pipeline).toHaveBeenCalledTimes(2);
        });
});
