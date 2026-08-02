import fs from "fs";
import path from "path";

type LegacyCapabilityManifest = {
  sources: Array<{
    activeTools: string[];
    inactiveTools: string[];
  }>;
  streamEvents: string[];
  inlineCommands: string[];
};

describe("legacy NodeAgent parity inventory", () => {
  const repositoryRoot = process.cwd();
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, "evals/nodeagent-legacy-capabilities.json"),
      "utf8",
    ),
  ) as LegacyCapabilityManifest;
  const inventory = fs.readFileSync(
    path.join(repositoryRoot, "docs/NODEAGENT_LEGACY_PARITY_INVENTORY.md"),
    "utf8",
  );

  it("accounts for every declared legacy tool, event, and inline command", () => {
    const expectedCapabilities = new Set([
      ...manifest.sources.flatMap((source) => [
        ...source.activeTools,
        ...source.inactiveTools,
      ]),
      ...manifest.streamEvents,
      ...manifest.inlineCommands,
    ]);

    for (const capability of expectedCapabilities) {
      expect(inventory).toContain(`\`${capability}`);
    }
  });

  it("does not leave production parity items deferred or proof-pending", () => {
    expect(inventory).not.toMatch(/\| Deferred \|/);
    expect(inventory).not.toMatch(/live Notion proof pending/i);
    expect(inventory).not.toMatch(/responsive clips remain/i);
  });
});
