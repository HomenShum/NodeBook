import { MOCK_NODEBOOK_USER } from "@/app/auth/NodeBookUser";
import { SettingsStore } from "@/app/graph/SettingsStore";

describe("settings persistence under production-style reload and burst pressure", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("opening or reloading a notebook does not write unchanged settings", async () => {
    const store = new SettingsStore({ ...MOCK_NODEBOOK_USER, isAnonymous: false });
    const persist = jest.spyOn(store, "persist").mockResolvedValue();

    await jest.advanceTimersByTimeAsync(5_000);

    expect(persist).not.toHaveBeenCalled();
    store.cleanup();
  });

  test("one hundred rapid toggles coalesce into one write containing the final state", async () => {
    const store = new SettingsStore({ ...MOCK_NODEBOOK_USER, isAnonymous: false });
    const persist = jest.spyOn(store, "persist").mockResolvedValue();

    for (let index = 0; index < 100; index++) store.setShowNodeDetails(index % 2 === 0);
    await jest.advanceTimersByTimeAsync(300);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0].showNodeDetails).toBe(false);
    store.cleanup();
  });

  test("sustained changes never overlap writes and retain the newest pending snapshot", async () => {
    const store = new SettingsStore({ ...MOCK_NODEBOOK_USER, isAnonymous: false });
    let releaseFirst!: () => void;
    let active = 0;
    let maxActive = 0;
    const firstWrite = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const persist = jest.spyOn(store, "persist").mockImplementation(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      if (persist.mock.calls.length === 1) await firstWrite;
      active--;
    });

    store.setShowNodeDetails(true);
    await jest.advanceTimersByTimeAsync(300);
    store.setShowNodeDetails(false);
    store.setShowNodeDetails(true);
    await jest.advanceTimersByTimeAsync(300);
    expect(persist).toHaveBeenCalledTimes(1);

    releaseFirst();
    await Promise.resolve();
    await Promise.resolve();

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[1][0].showNodeDetails).toBe(true);
    expect(maxActive).toBe(1);
    store.cleanup();
  });
});
