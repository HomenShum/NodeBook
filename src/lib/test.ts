import fs from "fs";

import { parse } from "comment-parser";

/**
 * Execute all examples in a file and expect them to not throw.
 *
 * Examples are expected to be in the form of JSDoc comments with the `@example` tag.
 *
 * @param filePath The path to the file to run examples from.
 * @param references All objects referenced in the examples.
 */
export function testAllExamplesInFileExecute(filePath: string, references: { [key: string]: any }) {
  const source = fs.readFileSync(filePath, "utf-8");
  parse(source).forEach(({ tags }) => {
    tags.forEach(({ tag, description }) => {
      if (tag === "example") {
        it(description, () => {
          const exampleFunction = new Function(...Object.keys(references), description);
          expect(() => exampleFunction(...Object.values(references))).not.toThrow();
        });
      }
    });
  });
}
