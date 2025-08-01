import { Given, When, Then } from "@cucumber/cucumber";
import { execSync } from "child_process";
import fs from "fs";
import yaml from "js-yaml";
import { getLogger } from "./logConfig.js";

const logger = getLogger();

let k6Output = null;
let k6Outputs = [];
let url = null;

Given("page url - {string}", function (url1) {
  url = url1;
});

/////////////////////////////

When("I load the subcomponents with selectors and text", function (dataTable) {
  // Each row: [selector, expectedText]
  const rows = dataTable.hashes();
  k6Outputs = [];
  const testUrl = url;
  if (!testUrl) {
    throw new Error(
      "TEST_URL is not set. Make sure to use the Given step to set the app URL."
    );
  }
  // Load k6env.yaml and convert to environment variables
  const envYaml = fs.readFileSync("k6env.yaml", "utf8");
  const envVars = yaml.load(envYaml);

  for (const { selector, expectedText } of rows) {
    try {
      logger.info(
        `Running k6 for subcomponent: ${selector} with TEST_URL="${testUrl}"`
      );

      // Prepare environment variables
      const env = {
        ...process.env,
        ...envVars,
        TEST_URL: testUrl,
        SUBCOMPONENT_SELECTOR: selector,
        EXPECTED_TEXT: expectedText,
      };

      const result = execSync(`k6 run k6/ui_performance.js`, {
        encoding: "utf-8",
        env: env,
      });
      k6Outputs.push({ selector, expectedText, output: result });
      logger.info(`Subcomponent ${selector} test completed successfully`);
      // Log the captured k6 output to console only
      logger.info(`k6 execution output for ${selector}:\n${result}`);
    } catch (err) {
      // k6 might exit with non-zero code but still have useful output in stderr
      const output = (err.stdout || "") + (err.stderr || "");
      k6Outputs.push({
        selector,
        expectedText,
        output: output,
      });
      logger.warn(
        `Subcomponent ${selector} test finished (captured from stdout/stderr)`
      );
      logger.warn(
        `k6 execution output for ${selector} (from stderr):\n${output}`
      );
    }
  }
});

When("I load the main page", function () {
  // Run the unified k6 script for the main page (no selector), passing TEST_URL from the Given step
  const testUrl = url;
  if (!testUrl) {
    throw new Error(
      "TEST_URL is not set. Make sure to use the Given step to set the app URL."
    );
  }
  // Load k6env.yaml and convert to environment variables
  const envYaml = fs.readFileSync("k6env.yaml", "utf8");
  const envVars = yaml.load(envYaml);

  try {
    logger.info(`Running k6 with TEST_URL="${testUrl}"`);

    // Prepare environment variables
    const env = {
      ...process.env,
      ...envVars,
      TEST_URL: testUrl,
    };

    const result = execSync(`k6 run k6/ui_performance.js`, {
      encoding: "utf-8",
      env: env,
    });
    k6Output = result;
    logger.info("k6 execution completed successfully");
    // Log the captured k6 output to console only
    logger.info(`k6 execution output for main page:\n${result}`);
  } catch (err) {
    // k6 might exit with non-zero code but still have useful output in stderr
    k6Output = (err.stdout || "") + (err.stderr || "");
    logger.warn("k6 execution finished (captured from stdout/stderr)");
    logger.warn(
      `k6 execution output for main page (from stderr):\n${k6Output}`
    );
  }
});

/////////////////////////////

Then(
  "each subcomponent load time should be less than {int} seconds",
  function (maxTime) {
    if (!Array.isArray(k6Outputs) || k6Outputs.length === 0) {
      throw new Error(
        "No k6 outputs found. Did you run the subcomponents step?"
      );
    }
    for (const { selector, output } of k6Outputs) {
      // Parse subcomponent load time from custom metric
      // Format: subcomponent_load_time.....: avg=2.45s or avg=318ms
      const loadTimeMatch = output.match(
        /subcomponent_load_time[.\s]*:\s*avg=([0-9.]+)(ms|s)/
      );
      if (!loadTimeMatch) {
        throw new Error(
          `Could not find subcomponent_load_time metric for selector ${selector} in k6 output. Output was:\n${output}`
        );
      }
      const value = parseFloat(loadTimeMatch[1]);
      const unit = loadTimeMatch[2];
      // Convert to seconds if needed
      const loadTime = unit === "ms" ? value / 1000 : value;
      logger.info(
        `Subcomponent ${selector} load time: ${loadTime.toFixed(
          2
        )}s (limit: ${maxTime}s)`
      );
      if (isNaN(loadTime) || loadTime >= maxTime) {
        throw new Error(
          `Subcomponent load time for selector ${selector} was ${loadTime.toFixed(
            2
          )}s, which is not less than ${maxTime}s.`
        );
      }
    }
  }
);

Then(
  "the main page load time should be less than {int} seconds",
  function (maxTime) {
    if (!k6Output || typeof k6Output !== "string") {
      throw new Error(
        "No k6 output found for main page. Did you run the main page step?"
      );
    }
    // Parse the k6 output for main page load time from custom metric
    // Format: main_page_load_time.....: avg=3.62s    min=3.62s    med=3.62s    max=3.62s
    // Or:     main_page_load_time.....: avg=996ms    min=996ms    med=996ms    max=996ms
    const match = k6Output.match(
      /main_page_load_time[.\s]*:\s*avg=([0-9.]+)(ms|s)?/
    );
    if (!match) {
      throw new Error(
        `Could not find main_page_load_time metric in k6 output. Output was:\n` +
          k6Output
      );
    }
    let loadTime = parseFloat(match[1]);
    const unit = match[2];

    // Convert milliseconds to seconds if needed
    if (unit === "ms") {
      loadTime = loadTime / 1000;
    }
    logger.info(
      `Main page load time: ${loadTime.toFixed(2)}s (limit: ${maxTime}s)`
    );
    if (isNaN(loadTime) || loadTime >= maxTime) {
      throw new Error(
        `Main page load time was ${loadTime.toFixed(
          2
        )}s, which is more than ${maxTime}s.`
      );
    }
  }
);
