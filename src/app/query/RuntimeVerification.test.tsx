import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import RuntimeVerification from "./RuntimeVerification";

const mockAuthFetch = jest.fn();

jest.mock("@/app/util", () => ({ getAuthFetch: () => mockAuthFetch }));
jest.mock("./RuntimeSynapseMap", () => ({
  __esModule: true,
  default: () => jest.requireActual("react").createElement("div", { "data-testid": "mock-runtime-map" }),
}));

const history = {
  benchmarkVersion: "runtime-v1",
  cases: [
    { caseId: "one", title: "One" },
    { caseId: "two", title: "Two" },
  ],
  preflight: { provider: "openai" as const, model: "gpt-test", fallbackModels: [] },
  evaluations: [],
};

describe("NodeAgent runtime verification disclosure", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockAuthFetch.mockReset();
    mockAuthFetch.mockResolvedValue({ ok: true, status: 200, json: async () => history });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test("a returning owner opens the disclosure before the graph mounts, then can close it without stale canvas state", async () => {
    await act(async () => {
      root.render(<RuntimeVerification />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const details = container.querySelector("details");
    const summary = container.querySelector("summary");
    expect(details?.open).toBe(false);
    expect(container.querySelector('[data-testid="mock-runtime-map"]')).toBeNull();

    await act(async () => {
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(details?.open).toBe(true);
    expect(container.querySelector('[data-testid="mock-runtime-map"]')).not.toBeNull();

    await act(async () => {
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(details?.open).toBe(false);
    expect(container.querySelector('[data-testid="mock-runtime-map"]')).toBeNull();
  });

  test("a returning owner retrying one failed case sees one-of-one progress instead of an impossible suite count", async () => {
    const failedReceipt = {
      evalId: "eval-one-failed",
      suiteId: "suite-current",
      caseId: "one",
      benchmarkVersion: "runtime-v1",
      provider: "openai" as const,
      model: "gpt-test",
      disposition: "execution_failed" as const,
      passed: false,
      reasons: ["Agent checkpoint failed validation"],
      toolOrder: [], operationKinds: [], selectedNodeIds: [], sourceBindings: [], proposalDigest: null,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      latencyMs: 100, startedAtMs: 1, completedAtMs: 101, persisted: true as const, graphMutated: false as const,
    };
    let finishRetry!: (value: unknown) => void;
    mockAuthFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (!options) return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...history, evaluations: [failedReceipt] }) });
      return new Promise((resolve) => { finishRetry = resolve; });
    });
    await act(async () => {
      root.render(<RuntimeVerification />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const retry = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry failed"));
    await act(async () => { retry?.click(); });
    expect(container.querySelector("summary strong")?.textContent).toBe("Running 1 of 1");
    expect(container.querySelector('[data-testid="runtime-eval-running"] strong')?.textContent).toBe("1 of 1");

    await act(async () => {
      finishRetry({ ok: true, status: 200, json: async () => ({ receipt: { ...failedReceipt, evalId: "eval-one-passed", passed: true, reasons: [] } }) });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });
});
