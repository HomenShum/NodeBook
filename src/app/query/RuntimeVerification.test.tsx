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
});
