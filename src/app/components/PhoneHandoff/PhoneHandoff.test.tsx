import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import PhoneHandoff from "./PhoneHandoff";

describe("NodeBook desktop-to-phone handoff", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("gives a desktop user one scannable canonical entry without leaking a private route", async () => {
    await act(async () => root.render(<PhoneHandoff variant="inline" />));

    const handoff = container.querySelector('[data-testid="nodebook-phone-handoff"]');
    const qr = container.querySelector<HTMLImageElement>('img[alt="QR code for the NodeBook phone app"]');
    const fallback = container.querySelector<HTMLAnchorElement>('a[target="_blank"]');

    expect(handoff).not.toBeNull();
    expect(fallback?.href).toBe("https://nodebook-rho.vercel.app/g");
    expect(decodeURIComponent(qr?.src ?? "")).toContain("text=https://nodebook-rho.vercel.app/g");
    expect(qr?.src).not.toContain("proposalId");
  });

  it("keeps the direct phone path usable when the QR provider is degraded", async () => {
    await act(async () => root.render(<PhoneHandoff />));

    const qr = container.querySelector<HTMLImageElement>('img[alt="QR code for the NodeBook phone app"]');
    await act(async () => qr?.dispatchEvent(new Event("error")));

    expect(container.textContent).toContain("QR image unavailable. Use the link below.");
    expect(container.querySelector<HTMLAnchorElement>('a[target="_blank"]')?.href).toBe(
      "https://nodebook-rho.vercel.app/g",
    );
  });

  it("handles a burst of copy requests without changing or duplicating the destination", async () => {
    await act(async () => root.render(<PhoneHandoff />));

    const copy = container.querySelector<HTMLButtonElement>('button[aria-label="Copy NodeBook phone link"]');
    await act(async () => {
      copy?.click();
      copy?.click();
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(1, "https://nodebook-rho.vercel.app/g");
    expect(navigator.clipboard.writeText).toHaveBeenNthCalledWith(2, "https://nodebook-rho.vercel.app/g");
    expect(copy?.textContent).toContain("Copied");
  });
});
