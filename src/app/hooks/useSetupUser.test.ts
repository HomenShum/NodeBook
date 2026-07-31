import { getIsValidToken } from "./useSetupUser";

function tokenWithExpiry(exp: number) {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

describe("NodeBook persisted Auth0 session", () => {
  test("a freshly issued one-hour token survives the post-login profile render", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(getIsValidToken(tokenWithExpiry(now + 60 * 60))).toBe(true);
  });

  test("an expiring or malformed token is rejected before notebook data loads", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(getIsValidToken(tokenWithExpiry(now + 60))).toBe(false);
    expect(getIsValidToken("not-a-jwt")).toBe(false);
  });
});
