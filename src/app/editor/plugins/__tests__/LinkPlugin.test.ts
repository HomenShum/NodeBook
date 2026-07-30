import { findUrlMatches } from "@/app/editor/utils/links";

describe("LinkPlugin", () => {
  it("should be able to find URL matches with common TLDs", () => {
    const text = "Something something google.com something something nodebook.io something";
    const matches = findUrlMatches(text);
    expect(matches).toHaveLength(2);
    expect(matches[0].text).toEqual("google.com");
    expect(matches[0].url).toEqual("https://google.com");
    expect(matches[1].text).toEqual("nodebook.io");
    expect(matches[1].url).toEqual("https://nodebook.io");
  });

  it("should match weird (but valid) URLs when http is present", () => {
    const text = "something something http://some.ads.agency something";
    const matches = findUrlMatches(text);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toEqual("http://some.ads.agency");
    expect(matches[0].url).toEqual("http://some.ads.agency");
  });

  it("should properly handle URLs at beginning and end of text", () => {
    const text = "https://google.com something something nodebook.io";
    const matches = findUrlMatches(text);
    expect(matches).toHaveLength(2);
    expect(matches[0].text).toEqual("https://google.com");
    expect(matches[0].url).toEqual("https://google.com");
    expect(matches[1].text).toEqual("nodebook.io");
    expect(matches[1].url).toEqual("https://nodebook.io");

    const text2 = "google.com something something nodebook.io http://google.com";
    const matches2 = findUrlMatches(text2);
    expect(matches2).toHaveLength(3);
    expect(matches2[0].text).toEqual("google.com");
    expect(matches2[0].url).toEqual("https://google.com");
    expect(matches2[1].text).toEqual("nodebook.io");
    expect(matches2[1].url).toEqual("https://nodebook.io");
    expect(matches2[2].text).toEqual("http://google.com");
    expect(matches2[2].url).toEqual("http://google.com");

    const text3 = "http://localhost:3000/g/home";
    const matches3 = findUrlMatches(text3);
    expect(matches3).toHaveLength(1);
    expect(matches3[0].text).toEqual("http://localhost:3000/g/home");
    expect(matches3[0].url).toEqual("http://localhost:3000/g/home");
  });
});
