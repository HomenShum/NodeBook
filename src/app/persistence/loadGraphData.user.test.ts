import { fetchGetOrCreateUser } from "./loadGraphData";

describe("NodeBook Auth0 user onboarding", () => {
  test("a Google user without preferred_username still gets a valid durable profile", async () => {
    const userFetch = jest.fn().mockResolvedValue({
      json: async () => ({
        error: false,
        data: {
          id: "auth0|owner",
          username: "Researcher",
          name: "Researcher",
          email: "",
          picture: "",
          createdAt: "2026-07-31T00:00:00.000Z",
          settings: {},
        },
      }),
    });

    await fetchGetOrCreateUser(
      {
        sub: "auth0|owner",
        name: "Researcher",
        updated_at: "2026-07-31T00:00:00.000Z",
      },
      userFetch,
    );

    const request = JSON.parse(userFetch.mock.calls[0][1].body);
    expect(request.user.username).toBe("Researcher");
    expect(request.user.id).toBe("auth0|owner");
  });
});
