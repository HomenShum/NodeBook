import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { useAuth } from "@/app/auth/useAuth";
import useSetupUser from "@/app/hooks/useSetupUser";
import { UserProvider } from "@/app/UserProvider";

jest.mock("@/app/auth/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/app/hooks/useSetupUser", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@/app/envFrontend", () => ({
  env: { isAuthEnabled: true },
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseSetupUser = jest.mocked(useSetupUser);

describe("NodeBook production authentication scenarios", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    sessionStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockedUseAuth.mockReset();
    mockedUseSetupUser.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("keeps a signed-out visitor away from persisted notebook data and offers one explicit sign-in", () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: undefined,
      loginWithRedirect: jest.fn(),
    } as never);
    mockedUseSetupUser.mockReturnValue(null);

    act(() => {
      root.render(
        <UserProvider>
          <div>private notebook</div>
        </UserProvider>,
      );
    });

    expect(container.textContent).toContain("NodeBook");
    expect(container.textContent).toContain("Sign in");
    expect(container.textContent).toContain("Continue as guest");
    expect(container.textContent).not.toContain("private notebook");
    expect(container.querySelectorAll('[data-testid="nodebook-login"]')).toHaveLength(1);
  });

  it("lets a phone tester enter an isolated ephemeral notebook without exposing authenticated data", () => {
    mockedUseAuth.mockReturnValue({ isLoading: false, user: undefined, loginWithRedirect: jest.fn() } as never);
    mockedUseSetupUser.mockReturnValue(null);
    act(() => {
      root.render(<UserProvider><div>ephemeral notebook</div></UserProvider>);
    });
    const guestButton = [...container.querySelectorAll("button")].find((button) => button.textContent === "Continue as guest");
    act(() => guestButton?.click());
    expect(container.textContent).toBe("ephemeral notebook");
    expect(sessionStorage.getItem("nodebook:guest-session")).toBe("1");
  });

  it("shows an honest loading state while Auth0 restores an existing session", () => {
    mockedUseAuth.mockReturnValue({ isLoading: true } as never);
    mockedUseSetupUser.mockReturnValue(null);

    act(() => {
      root.render(
        <UserProvider>
          <div>private notebook</div>
        </UserProvider>,
      );
    });

    expect(container.querySelector('[aria-busy="true"]')?.textContent).toContain("Loading NodeBook");
    expect(container.textContent).not.toContain("private notebook");
  });

  it("mounts the notebook only after Auth0 and the server user agree on an authenticated owner", () => {
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: { sub: "auth0|owner-a" },
    } as never);
    mockedUseSetupUser.mockReturnValue({ id: "owner-a" } as never);

    act(() => {
      root.render(
        <UserProvider>
          <div>private notebook</div>
        </UserProvider>,
      );
    });

    expect(container.textContent).toBe("private notebook");
    expect(container.querySelector('[data-testid="nodebook-login"]')).toBeNull();
  });
});
