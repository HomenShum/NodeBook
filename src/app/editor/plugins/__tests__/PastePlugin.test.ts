import { getDepthFromTextOffset, getLinesFromPlainText, normalizeDepth, getLinesFromHtmlList } from "@/app/editor/plugins/PastePlugin";

const INDENTED_TEXT = `1
			2
				3
	4
5`;

describe("PastePlugin", () => {
  it("should get depth from text offset correctly", () => {
    const { depth, remainingText } = getDepthFromTextOffset("\t123");
    expect(depth).toBe(1);
    expect(remainingText).toBe("123");
  });
  it("should get depth from text offset correctly", () => {
    const { depth, remainingText } = getDepthFromTextOffset("    123\t123"); // 4 spaces = 2 tabs
    expect(depth).toBe(2);
    expect(remainingText).toBe("123\t123");
  });

  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 2, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 2, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ]);
  });
  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [], isChecked: null },
      { depth: 2, chips: [], isChecked: null },
      { depth: 4, chips: [], isChecked: null },
      { depth: 2, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 2, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ]);
  });
  it("should normalize depth correctly", () => {
    const lines = [
      { depth: 0, chips: [], isChecked: null },
      { depth: 4, chips: [], isChecked: null },
      { depth: 4, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ];
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { depth: 0, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 1, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
      { depth: 0, chips: [], isChecked: null },
    ]);
  });

  it("should parse text and normalize depth", () => {
    const lines = getLinesFromPlainText(INDENTED_TEXT, false);
    const normalized = normalizeDepth(lines);
    expect(normalized).toEqual([
      { chips: [{ type: "text", value: "1" }], depth: 0, isChecked: null },
      { chips: [{ type: "text", value: "2" }], depth: 1, isChecked: null },
      { chips: [{ type: "text", value: "3" }], depth: 2, isChecked: null },
      { chips: [{ type: "text", value: "4" }], depth: 1, isChecked: null },
      { chips: [{ type: "text", value: "5" }], depth: 0, isChecked: null },
    ]);
  });

  /* ───────────── GitHub / fenced-code HTML ───────────── */
  it("handles GitHub-style snippet with a fenced code block", () => {
    const html = `
      <html><body>
        <ul><li>If I paste this snippet it breaks it, as in, it only shows me the first line in the node.</li></ul>
        <div class="snippet-clipboard-content">
          <pre><code>
        getDefaultStore().set(syncStateAtom, {
            ...getDefaultStore().get(syncStateAtom),
            serverHasUpdates: false,
          });
          </code></pre>
        </div>
        <ul><li>Since we are introducing a lot of code, we should write unit tests for the <code>getLinesFromHtmlList</code> function.</li></ul>
      </body></html>
    `;

    /* run the parser */
    const normalised = normalizeDepth(getLinesFromHtmlList(html, false));

    /* ---------- first bullet ---------- */
    expect(normalised[0]).toEqual({
      chips: [{
        type: "text",
        value: "If I paste this snippet it breaks it, as in, it only shows me the first line in the node.",
      }],
      depth: 0,
      isChecked: null,
      nodeId: undefined,
    });

    /* ---------- fenced code block ---------- */
    const codeNode = normalised[1];
    expect(codeNode.depth).toBe(1);
    expect(codeNode.isChecked).toBeNull();
    expect(codeNode.chips).toHaveLength(1);
    const codeText = codeNode.chips[0].type === "text" ? codeNode.chips[0].value : "";

    /* just assert essential structure/content, not exact spaces */
    expect(codeText.startsWith("```")).toBe(true);
    expect(codeText.endsWith("```")).toBe(true);
    expect(codeText).toContain("getDefaultStore().set(syncStateAtom");

    /* ---------- final bullet ---------- */
    expect(normalised[2]).toEqual({
      chips: [{
        type: "text",
        value: "Since we are introducing a lot of code, we should write unit tests for the getLinesFromHtmlList function.",
      }],
      depth: 0,
      isChecked: null,
      nodeId: undefined,
    });
  });

/* ────────────────────────────────────────────────────────────────────── */
it("parses a simple nested UL list into correct depths", () => {
  const html = `
    <html><body>
      <ul>
        <li>Parent</li>
        <li>
          <ul><li>Child</li></ul>
        </li>
      </ul>
    </body></html>
  `;

  const out = normalizeDepth(getLinesFromHtmlList(html, false));

  expect(out).toEqual([
    {
      chips:[{ type:"text", value:"Parent" }],
      depth:0,
      isChecked:null,
      nodeId:undefined,
    },
    {
      chips:[{ type:"text", value:"Child" }],
      depth:1,
      isChecked:null,
      nodeId:undefined,
    },
  ]);
});

  /* ───────────── Google-Docs malformed list HTML ───────────── */
  it("repairs Google-Docs sibling list structure", () => {
    const html = `
      <html><body>
        <p>A</p>
        <ul><li><p>B</p></li><li><p>C</p></li></ul>
        <p>D</p>
        <ul>
          <li><p>E</p></li>
          <ul><li><p>F</p></li></ul>
          <li><p>g</p></li>
        </ul>
      </body></html>
    `;

    const normalised = normalizeDepth(getLinesFromHtmlList(html, false));

    expect(normalised).toEqual([
      { chips:[{ type:"text", value:"A" }], depth:0, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"B" }], depth:0, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"C" }], depth:0, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"D" }], depth:0, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"E" }], depth:0, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"F" }], depth:1, isChecked:null, nodeId:undefined },
      { chips:[{ type:"text", value:"g" }], depth:0, isChecked:null, nodeId:undefined },
    ]);
  });
});