import path from "path";

import appLogger, { getGlobalLoggerFilter, updateGlobalLoggerFilter } from "@/lib/logger";
import { testAllExamplesInFileExecute } from "@/lib/testAllExamplesInFileExecute";

describe("logger", () => {
  describe("examples should run", () => {
    const logger = appLogger.child({ transports: [] });
    testAllExamplesInFileExecute(path.resolve(__dirname, "..", "logger.ts"), {
      logger,
      getGlobalLoggerFilter,
      updateGlobalLoggerFilter,
    });
  });
});
