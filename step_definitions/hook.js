import { Before, After } from "@cucumber/cucumber";
import { getLogger } from "./logConfig.js";
import fs from "fs";
import path from "path";

const logger = getLogger("hooks");

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(process.cwd(), "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  logger.info(`Screenshots directory created: ${screenshotsDir}`);
} else {
  logger.info(`Screenshots directory already exists: ${screenshotsDir}`);
}

let currentScenario = null;
let networkCondition = null;
let cpuCondition = null;

// Standard k6 browser network profiles
const NETWORK_CONDITIONS = {
  "4G": {
    profile: "Regular 4G",
    description: "Regular 4G Network Profile",
  },
  WIFI: {
    profile: "WiFi",
    description: "WiFi Network Profile",
  },
  "3G": {
    profile: "Fast 3G",
    description: "Fast 3G Network Profile",
  },
};

// CPU condition mappings
const CPU_CONDITIONS = {
  HighCPU: {
    throttling: 1, // No throttling
    description: "High CPU Performance (No throttling)",
  },
  LowCPU: {
    throttling: 4, // 4x CPU throttling
    description: "Low CPU Performance (4x throttling)",
  },
};

// Tagged Before hook for network conditions
Before({ tags: "@4G" }, function (scenario) {
  networkCondition = "4G";
  const condition = NETWORK_CONDITIONS["4G"];
  logger.info(`🌐 Network Condition: ${condition.description}`);

  // Set environment variables for k6 script
  process.env.K6_NETWORK_CONDITION = "4G";
  process.env.K6_NETWORK_PROFILE = condition.profile;
});

Before({ tags: "@WIFI" }, function (scenario) {
  networkCondition = "WIFI";
  const condition = NETWORK_CONDITIONS["WIFI"];
  logger.info(`🌐 Network Condition: ${condition.description}`);

  // Set environment variables for k6 script
  process.env.K6_NETWORK_CONDITION = "WIFI";
  process.env.K6_NETWORK_PROFILE = condition.profile;
});

Before({ tags: "@3G" }, function (scenario) {
  networkCondition = "3G";
  const condition = NETWORK_CONDITIONS["3G"];
  logger.info(`🌐 Network Condition: ${condition.description}`);

  // Set environment variables for k6 script
  process.env.K6_NETWORK_CONDITION = "3G";
  process.env.K6_NETWORK_PROFILE = condition.profile;
});

// Tagged Before hook for CPU conditions
Before({ tags: "@HighCPU" }, function (scenario) {
  cpuCondition = "HighCPU";
  const condition = CPU_CONDITIONS["HighCPU"];
  logger.info(`💻 CPU Condition: ${condition.description}`);

  // Set environment variables for k6 script
  process.env.K6_CPU_CONDITION = "HighCPU";
  process.env.K6_CPU_THROTTLING = condition.throttling.toString();
});

Before({ tags: "@LowCPU" }, function (scenario) {
  cpuCondition = "LowCPU";
  const condition = CPU_CONDITIONS["LowCPU"];
  logger.info(`💻 CPU Condition: ${condition.description}`);

  // Set environment variables for k6 script
  process.env.K6_CPU_CONDITION = "LowCPU";
  process.env.K6_CPU_THROTTLING = condition.throttling.toString();
});

// Hook to capture scenario information
Before(function (scenario) {
  currentScenario = scenario.pickle.name;
  const scenarioTags = scenario.pickle.tags.map((tag) => tag.name).join(", ");

  logger.info(`=== STARTING SCENARIO: ${currentScenario} ===`);
  logger.info(`🏷️ Associated Tags: ${scenarioTags || "None"}`);

  // Set scenario information as environment variables for k6 script
  process.env.SCENARIO_NAME = currentScenario;
  process.env.SCENARIO_TAGS = scenarioTags;

  // Log active conditions
  if (networkCondition) {
    logger.info(
      `🔧 Active Network Simulation: ${NETWORK_CONDITIONS[networkCondition].description}`
    );
  }
  if (cpuCondition) {
    logger.info(
      `🔧 Active CPU Simulation: ${CPU_CONDITIONS[cpuCondition].description}`
    );
  }
});

// Hook to log scenario completion and cleanup
After(function (scenario) {
  const status = scenario.result?.status || "unknown";
  const scenarioTags = scenario.pickle.tags.map((tag) => tag.name).join(", ");

  logger.info(
    `=== COMPLETED SCENARIO: ${currentScenario} - STATUS: ${status.toUpperCase()} ===`
  );
  logger.info(`${"▓".repeat(100)}`); // Bold visual border separator

  // Clean up environment variables
  delete process.env.K6_NETWORK_CONDITION;
  delete process.env.K6_NETWORK_PROFILE;
  delete process.env.K6_CPU_CONDITION;
  delete process.env.K6_CPU_THROTTLING;
  delete process.env.SCENARIO_NAME;
  delete process.env.SCENARIO_TAGS;

  // Reset conditions
  networkCondition = null;
  cpuCondition = null;
});

// Export currentScenario and conditions for use in other step files if needed
export {
  currentScenario,
  networkCondition,
  cpuCondition,
  NETWORK_CONDITIONS,
  CPU_CONDITIONS,
};
