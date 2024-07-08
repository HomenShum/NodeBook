import fs from "fs";

import { parse } from "comment-parser";

/**
 * Execute all examples in a file and expect them to not throw.
 * Supports async examples using await.
 *
 * Examples are expected to be in the form of JSDoc comments with the `@example` tag.
 *
 * @param filePath The path to the file to run examples from.
 * @param references All objects referenced in the examples.
 */
export function testAllExamplesInFileExecute(filePath: string, references: { [key: string]: any }) {
  const source = fs.readFileSync(filePath, "utf-8");
  parse(source, { spacing: "preserve" }).forEach(({ tags }) => {
    tags.forEach(({ tag, description }) => {
      if (tag === "example") {
        const code = removeSingleLineComments(description.trim().replace(/^```|```$/g, "")).trim();
        const title = `Example: ${code.split("\n")[0]}...`;
        it(title, async () => {
          const mockFn = jest.fn(async () => {
            const exampleFunction = new Function(
              "assert",
              ...Object.keys(references),
              `
              return (async () => {
                ${code}
              })();
            `,
            );
            await exampleFunction(assert, ...Object.values(references));
          });
          await expect(mockFn()).resolves.not.toThrow("Example threw an error");
        });
      }
    });
  });
}

/**
 * Helper function to assert a condition is true in an example.
 */
function assert(condition: boolean, message = "Assertion failed") {
  if (!condition) {
    throw new Error(message);
  }
}

function removeSingleLineComments(source: string): string {
  const lines = source.split("\n");
  const resultLines = lines.map((line) => {
    const commentIndex = line.indexOf("//");
    if (commentIndex !== -1) {
      // Check if the '//' is within a string
      const beforeComment = line.slice(0, commentIndex);
      const stringDelimiters = beforeComment.match(/['"`]/g) || [];
      if (stringDelimiters.length % 2 === 0) {
        // Even number of string delimiters, so '//' is a comment
        return line.slice(0, commentIndex);
      }
    }
    return line;
  });
  return resultLines.join("\n");
}
