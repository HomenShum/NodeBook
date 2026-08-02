import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

function sourceFiles(root: string, limit = 500) {
  const files: string[] = [];
  const pending = [root];
  while (pending.length && files.length < limit) {
    const current = pending.pop()!;
    for (const name of readdirSync(current)) {
      const target = path.join(current, name);
      if (statSync(target).isDirectory()) pending.push(target);
      else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx"))
        files.push(target);
    }
  }
  if (pending.length) throw new Error("NodeAgent sole-engine scan exceeded its file bound");
  return files;
}

describe("NodeAgent sole-engine gate", () => {
  test("all API entrypoints converge on the integrated workflow engine", () => {
    const apiRoot = path.resolve(process.cwd(), "src/app/api");
    const files = sourceFiles(apiRoot);
    const callers = files
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return (
          source.includes("executeWorkflowAgent(") && !source.includes("export async function executeWorkflowAgent(")
        );
      })
      .map((file) => path.relative(apiRoot, file).replaceAll("\\", "/"))
      .sort();

    expect(callers).toEqual(["query/evals/route.ts", "query/route.ts"]);
  });

  test("removed MewAgent classes and duplicate agent API routes cannot return unnoticed", () => {
    const apiRoot = path.resolve(process.cwd(), "src/app/api");
    const files = sourceFiles(apiRoot);
    const legacyClasses = files.filter((file) => /class\s+(MewAgent|NodeAgent)\b/.test(readFileSync(file, "utf8")));
    const duplicateRoutes = files
      .map((file) => path.relative(apiRoot, file).replaceAll("\\", "/"))
      .filter((file) => /(^|\/)mewagent\//i.test(file) || /(^|\/)llm\/[^/]+\/agent\/route\.tsx?$/.test(file));

    expect(legacyClasses).toEqual([]);
    expect(duplicateRoutes).toEqual([]);
  });

  test("the integrated workflow mutation is the only durable agent-run writer", () => {
    const convexRoot = path.resolve(process.cwd(), "convex");
    const writers = sourceFiles(convexRoot)
      .filter((file) => readFileSync(file, "utf8").includes('ctx.db.insert("agentRuns"'))
      .map((file) => path.relative(convexRoot, file).replaceAll("\\", "/"))
      .sort();

    expect(writers).toEqual(["agentWorkflows.ts"]);
    expect(() => statSync(path.join(convexRoot, "agentRuns.ts"))).toThrow();
  });

  test("all NodeAgent UI mutations converge on the typed NotebookTools port", () => {
    const appRoot = path.resolve(process.cwd(), "src/app");
    const guardedCalls = ["applyAgentOperations(", "undoAgentOperations(", "runCheckpointExecutionLifecycle("];
    const callers = sourceFiles(appRoot)
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return guardedCalls.some((call) => source.includes(call))
          && !source.includes("export async function applyAgentOperations(")
          && !source.includes("export async function undoAgentOperations(")
          && !source.includes("export async function runCheckpointExecutionLifecycle(");
      })
      .map((file) => path.relative(appRoot, file).replaceAll("\\", "/"))
      .sort();

    expect(callers).toEqual(["query/notebookTools.ts"]);
  });
});
