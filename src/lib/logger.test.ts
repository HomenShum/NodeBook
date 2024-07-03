import path from "path";

import logger from "@/lib/logger";
import { testAllExamplesInFileExecute } from "@/lib/testAllExamplesInFileExecute";

describe("logger", () => {
  describe("examples should run", () => {
    testAllExamplesInFileExecute(path.resolve(__dirname, "logger.ts"), { logger: logger });
  });
});
