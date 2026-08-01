import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { useAuth } from "@/app/auth/useAuth";
import useSetupUser from "@/app/hooks/useSetupUser";
import { LocalStorageUser } from "@/app/util";
import { JWT_LOCAL_STORAGE_KEY } from "@/app/graph/constants";

jest.mock("@/app/auth/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("@/app/util", () => {
  const actual = jest.requireActual("@/app/util");
  return {
    ...actual,
    LocalStorageUser: {
      get: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    },
  };
});
jest.mock("@/app/envFrontend", () => ({
  env: {
    env: "production",
    isAuthEnabled: true,
  },
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedStoredUserGet = jest.mocked(LocalStorageUser.get);

function UserProbe({ renderNumber }: { renderNumber: number }) {
  const user = useSetupUser();
  return <output data-render={renderNumber}>{user?.id ?? "loading"}</output>;
}

describe("NodeBook authenticated store lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockedUseAuth.mockReturnValue({ isLoading: true } as never);
    mockedStoredUserGet.mockReset();
    mockedStoredUserGet.mockReturnValue(null);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("hydrates the cached owner once across repeated parent renders", () => {
    act(() => root.render(<UserProbe renderNumber={1} />));
    act(() => root.render(<UserProbe renderNumber={2} />));
    act(() => root.render(<UserProbe renderNumber={3} />));

    expect(mockedStoredUserGet).toHaveBeenCalledTimes(1);
    expect(container.querySelector("output")?.getAttribute("data-render")).toBe("3");
  });

  it("returns an expired signed-in browser session to the login boundary instead of loading forever", async () => {
    const logout = jest.fn(async () => undefined);
    mockedUseAuth.mockReturnValue({
      isLoading: false,
      user: { sub: "auth0|returning-owner" },
      getAccessTokenSilently: jest.fn(async () => { throw new Error("Missing Refresh Token"); }),
      logout,
    } as never);
    localStorage.setItem(JWT_LOCAL_STORAGE_KEY, "expired-token");

    await act(async () => {
      root.render(<UserProbe renderNumber={1} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(LocalStorageUser.delete).toHaveBeenCalled();
    expect(localStorage.getItem(JWT_LOCAL_STORAGE_KEY)).toBeNull();
    expect(logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    });
  });
});
