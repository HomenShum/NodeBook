import axios from "axios";

import { GUEST_SESSION_KEY } from "@/app/auth/guestSession";

import { CacheResource } from "./Cache";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    defaults: { headers: { common: {} } },
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe("canonical cache persona boundary", () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete axios.defaults.headers.common["Authorization"];
    jest.clearAllMocks();
  });

  test("a guest notebook stays local and emits no authenticated cache requests", async () => {
    sessionStorage.setItem(GUEST_SESSION_KEY, "1");
    await expect(CacheResource.canonical.get(["guest-root"])).resolves.toEqual({ status: "ok", data: [] });
    await expect(CacheResource.canonical.update({ "guest-root": [] })).resolves.toEqual({ status: "ok" });
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  });

  test("a signed notebook with a bearer token still uses the protected cache route", async () => {
    axios.defaults.headers.common["Authorization"] = "Bearer signed-test-token";
    (axios.post as jest.Mock).mockResolvedValue({ data: { status: "ok", data: [] } });
    await CacheResource.canonical.get(["signed-root"]);
    expect(axios.post).toHaveBeenCalledWith("/api/cache/canonical", { objectIds: ["signed-root"] });
  });
});
