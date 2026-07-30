import fs from "fs";

import puppeteer, { Page } from "puppeteer";

interface QueryResult {
  query: string;
  timeMs: number;
  resultCount: number;
  success: boolean;
  error?: string;
}

async function readQueriesFromFile(filePath: string): Promise<string[]> {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    throw new Error(`Failed to read queries file: ${error}`);
  }
}

async function executeSearchQuery(page: Page, query: string): Promise<QueryResult> {
  try {
    console.log(`Testing query: "${query}"`);

    // Find the input field in the command bar
    const inputSelector = '[role="dialog"] input, [role="dialog"] [contenteditable="true"]';

    // Clear any existing content using Cmd+A and then typing
    const isMac = process.platform === "darwin";
    const modifierKey = isMac ? "Meta" : "Control";

    await page.click(inputSelector);
    await page.keyboard.down(modifierKey);
    await page.keyboard.press("KeyA");
    await page.keyboard.up(modifierKey);

    // Type the query
    await page.type(inputSelector, query);

    // Start timing
    const startTime = Date.now();

    // Wait for results to populate
    await page.waitForFunction(
      () => {
        const elements = document.querySelectorAll('[id="CommandBarLoader"]');
        if (elements.length > 0) {
          console.log("Loader found");
          return true;
        }
        return false;
      },
      { timeout: 10000 },
    );

    await page.waitForFunction(
      () => {
        const elements = document.querySelectorAll('[id="CommandBarLoader"]');
        if (elements.length > 0) {
          console.log("Loader loading");
          return false;
        }
        return true;
      },
      { timeout: 10000 },
    );

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Count the results
    const resultCount = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      for (const dialog of dialogs) {
        const listElements = dialog.querySelectorAll("div");
        for (const listEl of listElements) {
          if (listEl.children.length > 0) {
            let count = 0;
            for (const child of listEl.children) {
              if (child.textContent && child.textContent.trim()) {
                count++;
              }
            }
            if (count > 0) return count;
          }
        }
      }
      return 0;
    });

    console.log(`  Results populated in ${responseTime}ms (${resultCount} results)`);

    return {
      query,
      timeMs: responseTime,
      resultCount,
      success: true,
    };
  } catch (error) {
    console.error(`  Query "${query}" failed:`, error);
    return {
      query,
      timeMs: -1,
      resultCount: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testCommandBarPerformance(queriesFilePath: string): Promise<QueryResult[]> {
  const browser = await puppeteer.launch({
    headless: false, // Set to true if you want to run without GUI
    devtools: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let page: Page | undefined;
  const results: QueryResult[] = [];

  try {
    // Read queries from file
    const queries = await readQueriesFromFile(queriesFilePath);
    console.log(`Loaded ${queries.length} queries from ${queriesFilePath}`);

    page = await browser.newPage();

    // Set viewport size
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to the app
    console.log("Navigating to http://localhost:3000...");
    await page.goto("https://nodebook-ec2.nodebook.app", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for the page to be fully loaded
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("Opening command bar...");

    // Open command bar (typically Cmd+K on Mac, Ctrl+K on PC)
    const isMac = process.platform === "darwin";
    const modifierKey = isMac ? "Meta" : "Control";

    await page.keyboard.down(modifierKey);
    await page.keyboard.down("Shift");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Shift");
    await page.keyboard.up(modifierKey);

    // Wait for command bar to open by checking for the dialog
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    console.log("Command bar opened successfully");

    // Wait a bit more to ensure it's fully rendered
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Execute each query sequentially
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];

      // Execute the search query
      const result = await executeSearchQuery(page, query);
      results.push(result);

      // If this isn't the last query, clear the search bar for the next one
      if (i < queries.length - 1) {
        // Wait a moment to see results
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Clear the search using Cmd+A and Delete
        const inputSelector = '[role="dialog"] input, [role="dialog"] [contenteditable="true"]';
        await page.click(inputSelector);
        await page.keyboard.down(modifierKey);
        await page.keyboard.press("KeyA");
        await page.keyboard.up(modifierKey);
        await page.keyboard.press("Backspace");

        // Wait a moment before next query
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Optional: Take a final screenshot
    await page.screenshot({
      path: "command-bar-final-results.png",
      fullPage: false,
    });
    console.log("Final screenshot saved as command-bar-final-results.png");

    return results;
  } catch (error) {
    console.error("Test failed:", error);

    // Take a screenshot on error for debugging
    try {
      if (page) {
        await page.screenshot({
          path: "command-bar-error.png",
          fullPage: true,
        });
        console.log("Error screenshot saved as command-bar-error.png");
      }
    } catch (screenshotError) {
      console.error("Could not take error screenshot:", screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
async function main() {
  console.log("🚀 Starting Command Bar Performance Test...");

  // Get queries file path from command line argument or use default
  const queriesFilePath = process.argv[2] || "queries.txt";

  if (!fs.existsSync(queriesFilePath)) {
    console.error(`Queries file not found: ${queriesFilePath}`);
    console.log("Usage: npm run test-command-bar [queries-file-path]");
    console.log("Create a file with one search query per line.");
    process.exit(1);
  }

  console.log(`Using queries file: ${queriesFilePath}`);
  console.log("Make sure your dev server is running on https://edge.globalbrain.ai");

  try {
    const results = await testCommandBarPerformance(queriesFilePath);

    console.log("\nTest Results:");
    console.log("================");

    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    if (successfulResults.length > 0) {
      console.log("\nSuccessful queries:");
      successfulResults.forEach((result) => {
        console.log(`  "${result.query}": ${result.timeMs}ms (${result.resultCount} results)`);
      });

      const avgTime = successfulResults.reduce((sum, r) => sum + r.timeMs, 0) / successfulResults.length;
      console.log(`\nAverage response time: ${avgTime.toFixed(1)}ms`);
    }

    if (failedResults.length > 0) {
      console.log("\nFailed queries:");
      failedResults.forEach((result) => {
        console.log(`  "${result.query}": ${result.error}`);
      });
    }

    console.log(`\nTotal queries: ${results.length}`);
    console.log(`Successful: ${successfulResults.length}`);
    console.log(`Failed: ${failedResults.length}`);

    // Return the raw results as well
    console.log("\n📄 Raw Results (query, timeMs):");
    results.forEach((result) => {
      if (result.success) {
        console.log(`${result.query}, ${result.timeMs}`);
      } else {
        console.log(`${result.query}, FAILED`);
      }
    });

    // Log the average time per query
    const avgTime = successfulResults.reduce((sum, r) => sum + r.timeMs, 0) / successfulResults.length;
    console.log(`\nAverage time per query: ${avgTime.toFixed(1)}ms`);
  } catch (error) {
    console.log("\nTest failed:", error);
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\nTest interrupted by user");
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main().catch(console.error);
