import path from "path";

import logger, { getGlobalLoggerFilter, updateGlobalLoggerFilter } from "@/lib/logger";
import { testAllExamplesInFileExecute } from "@/lib/testAllExamplesInFileExecute";

describe("logger", () => {
  describe("examples should run", () => {
    testAllExamplesInFileExecute(path.resolve(__dirname, "logger.ts"), {
      logger,
      getGlobalLoggerFilter,
      updateGlobalLoggerFilter,
    });
  });
});
