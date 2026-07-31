import { act } from "react";
import { createRoot, Root } from "react-dom/client";

import { useAuth } from "@/app/auth/useAuth";
import useSetupUser from "@/app/hooks/useSetupUser";
import { LocalStorageUser } from "@/app/util";

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
});
