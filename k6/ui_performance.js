import { browser } from "k6/browser";
import { check } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";
import { group } from "k6";
import { vu } from "k6/execution";

// Enhanced logger with timestamp and VU context
const logger = {
  _getPrefix: () => {
    const timestamp = new Date().toISOString().slice(11, -5);
    const vuId = vu.idInTest;
    const iterationId = vu.iterationInScenario;
    return `[${timestamp}] [VU ${vuId}] [Iter ${iterationId}]`;
  },
  info: (msg) => console.log(`[INFO] ${logger._getPrefix()} ${msg}`),
  error: (msg) => console.error(`[ERROR] ${logger._getPrefix()} ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${logger._getPrefix()} ${msg}`),
  debug: (msg) => console.debug(`[DEBUG] ${logger._getPrefix()} ${msg}`),
};

/**
 * Optimized component highlighting with performance improvements
 * @param {Object} page - Browser page instance
 * @param {string} selector - CSS selector
 * @param {string} expectedText - Text to highlight
 */
async function applyHighlighting(page, selector, expectedText) {
  if (!CONFIG.features.highlighting) {
    logger.debug("Highlighting disabled, skipping");
    return;
  }

  try {
    await page.evaluate(
      ([sel, text]) => {
        const element = document.querySelector(sel);
        if (!element || !text) return;

        const highlightedElements = [];
        const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );

        let node;
        while ((node = walker.nextNode())) {
          if (node.textContent.includes(text)) {
            const parent = node.parentElement;
            if (parent && !parent.dataset.highlighted) {
              const original = {
                backgroundColor: parent.style.backgroundColor,
                padding: parent.style.padding,
                border: parent.style.border,
                borderRadius: parent.style.borderRadius,
                boxShadow: parent.style.boxShadow,
                fontWeight: parent.style.fontWeight,
              };

              Object.assign(parent.style, {
                backgroundColor: "rgba(255,255,0,0.8)",
                padding: "4px 8px",
                border: "2px solid rgba(255,165,0,0.9)",
                borderRadius: "4px",
                boxShadow: "0 0 8px rgba(255,165,0,0.6)",
                fontWeight: "bold",
              });

              parent.dataset.highlighted = "true";
              highlightedElements.push({ element: parent, original });
            }
          }
        }
        window._highlightedElements = highlightedElements;
      },
      [selector, expectedText]
    );

    await page.waitForTimeout(CONFIG.timeouts.screenshot);

    if (expectedText) {
      await waitForTextVisibility(page, expectedText);
    }

    logger.debug(
      `Applied highlighting to ${selector} for text: ${expectedText}`
    );
  } catch (error) {
    logger.warn(`Could not highlight component ${selector}: ${error.message}`);
  }
}

/**
 * Optimized text visibility checker with timeout
 * @param {Object} page - Browser page instance
 * @param {string} text - Text to wait for
 * @param {number} timeout - Maximum wait time
 */
async function waitForTextVisibility(page, text, timeout = 2000) {
  try {
    const result = await page.evaluate(
      ([targetText, maxTimeout]) => {
        return new Promise((resolve) => {
          const startTime = Date.now();

          const checkText = () => {
            if (Date.now() - startTime > maxTimeout) {
              resolve(false);
              return;
            }

            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );

            let node;
            while ((node = walker.nextNode())) {
              if (node.textContent.includes(targetText)) {
                const element = node.parentElement;
                if (element?.offsetWidth > 0 && element?.offsetHeight > 0) {
                  const rect = element.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    resolve(true);
                    return;
                  }
                }
              }
            }

            setTimeout(checkText, 100);
          };

          checkText();
        });
      },
      [text, timeout]
    );

    if (result) {
      logger.debug(`Text "${text}" is now visible`);
    } else {
      logger.warn(`Text "${text}" visibility timeout after ${timeout}ms`);
    }

    return result;
  } catch (error) {
    logger.warn(`Text visibility check failed for "${text}": ${error.message}`);
    return false;
  }
}

/**
 * Optimized highlighting removal
 * @param {Object} page - Browser page instance
 */
async function removeHighlighting(page) {
  if (!CONFIG.features.highlighting) return;

  try {
    await page.evaluate(() => {
      if (window._highlightedElements) {
        window._highlightedElements.forEach(({ element, original }) => {
          Object.assign(element.style, original);
          delete element.dataset.highlighted;
        });
        window._highlightedElements = null;
      }
    });
    logger.debug("Highlighting removed successfully");
  } catch (error) {
    logger.warn(`Could not clean up highlighting: ${error.message}`);
  }
}

/**
 * Enhanced screenshot function with better file naming and error handling
 * @param {Object} page - Browser page instance
 * @param {string} testType - Type of test (component/page/error)
 * @param {string} status - Test status (pass/fail)
 * @param {string} identifier - Additional identifier
 * @param {string} selector - CSS selector to highlight (optional)
 * @param {string} expectedText - Expected text (optional)
 * @returns {Promise<string|null>} Screenshot file path or null if disabled/failed
 */
async function takeScreenshot(
  page,
  testType,
  status,
  identifier = "",
  selector = null,
  expectedText = null
) {
  if (!CONFIG.features.screenshots) {
    logger.debug("Screenshots disabled, skipping");
    return null;
  }

  try {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const vuId = vu.idInTest;
    const iterationId = vu.iterationInScenario;

    // Apply highlighting before screenshot if needed
    if (selector && testType === "component" && CONFIG.features.highlighting) {
      await applyHighlighting(page, selector, expectedText);
    }

    // Generate clean filename
    const scenarioName = (__ENV.SCENARIO_NAME || "unknown_scenario")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 30);

    const scenarioTags = (__ENV.SCENARIO_TAGS || "")
      .replace(/[@,]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 20);

    const cleanExpectedText = expectedText
      ? expectedText
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 15)
      : "";

    const filenameParts = [
      timestamp,
      scenarioName,
      scenarioTags,
      testType,
      status,
      cleanExpectedText,
      `VU${vuId}`,
      `Iter${iterationId}`,
    ].filter(Boolean);

    const filename = `${filenameParts.join("_")}.png`;
    const screenshotPath = `screenshots/${filename}`;

    // Wait for paint to complete
    await page.evaluate(() => {
      return new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
    });

    await page.waitForTimeout(CONFIG.timeouts.screenshot);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      quality: 85, // Optimize file size
    });

    // Remove highlighting after screenshot
    if (selector && testType === "component" && CONFIG.features.highlighting) {
      await removeHighlighting(page);
    }

    logger.info(
      `📸 Screenshot saved: ${screenshotPath} (${testType}/${status})`
    );
    return screenshotPath;
  } catch (error) {
    logger.error(`Failed to take screenshot: ${error.message}`);
    return null;
  }
}

// Configuration object with validation and defaults
const CONFIG = {
  vus: Math.max(1, +__ENV.VUS || 1),
  iterations: Math.max(1, +__ENV.ITERATIONS || 1),
  connectivityTimeThreshold: Math.max(
    100,
    +__ENV.USER_CONNECTIVITY_TIME || 1000
  ),
  testUrl: __ENV.TEST_URL?.trim(),
  subcomponentSelector: __ENV.SUBCOMPONENT_SELECTOR?.trim(),
  expectedText: __ENV.EXPECTED_TEXT?.trim(),
  timeouts: {
    domcontentloaded: Math.max(5000, +__ENV.DOM_TIMEOUT || 20000),
    element: Math.max(1000, +__ENV.ELEMENT_TIMEOUT || 10000),
    component: Math.max(1000, +__ENV.COMPONENT_TIMEOUT || 5000),
    http: Math.max(1000, +__ENV.HTTP_TIMEOUT || 5000),
    screenshot: Math.max(200, +__ENV.SCREENSHOT_TIMEOUT || 500),
  },
  pollInterval: Math.max(50, +__ENV.POLL_INTERVAL || 100),
  network: {
    condition: __ENV.K6_NETWORK_CONDITION || "WIFI",
    profile: __ENV.K6_NETWORK_PROFILE || "WiFi",
  },
  cpu: {
    condition: __ENV.K6_CPU_CONDITION || "HighCPU",
    throttling: Math.max(1, +__ENV.K6_CPU_THROTTLING || 1),
  },
  features: {
    screenshots: __ENV.ENABLE_SCREENSHOTS !== "false",
    networkLogging: __ENV.ENABLE_NETWORK_LOGGING !== "false",
    highlighting: __ENV.ENABLE_HIGHLIGHTING !== "false",
  },
};

// Performance metrics with enhanced configuration
const metrics = {
  mainPageLoadTime: new Trend("main_page_load_time", true),
  subcomponentLoadTime: new Trend("subcomponent_load_time", true),
  apiResponseTime: new Trend("api_response_time", true),
  domContentLoadedTime: new Trend("dom_content_loaded_time", true),
  networkIdleTime: new Trend("network_idle_time", true),
};

// Optimized browser options
const browserOptions = {
  type: "chromium",
  headless: __ENV.HEADLESS !== "false",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
  env: CONFIG.network.condition
    ? {
        K6_NETWORK_CONDITION: CONFIG.network.condition,
        K6_NETWORK_PROFILE: CONFIG.network.profile,
      }
    : undefined,
};

export const options = {
  scenarios: {
    ui: {
      executor: "shared-iterations",
      options: { browser: browserOptions },
      vus: CONFIG.vus,
      iterations: CONFIG.vus * CONFIG.iterations,
      maxDuration: "10m",
    },
  },
};

/**
 * Enhanced utility functions
 */

/**
 * Validates required environment variables with detailed error messages
 * @throws {Error} If any required environment variable is missing or invalid
 */
function validateRequiredEnvironmentVariables() {
  const validationErrors = [];

  if (!CONFIG.testUrl) {
    validationErrors.push("TEST_URL is required and cannot be empty");
  } else {
    // Simple URL validation for K6 environment (which doesn't have URL constructor)
    const urlPattern = /^https?:\/\/[^\s]+$/;
    if (!urlPattern.test(CONFIG.testUrl)) {
      validationErrors.push(
        `TEST_URL must be a valid URL with http or https protocol, got: ${CONFIG.testUrl}`
      );
    }
  }

  if (CONFIG.subcomponentSelector) {
    // More flexible CSS selector validation - allow any non-empty string that could be a selector
    const selectorPattern = /^[a-zA-Z0-9\[\]="':._#\-\s\(\),>+~*|^$]+$/;
    if (!CONFIG.subcomponentSelector.match(selectorPattern)) {
      validationErrors.push(
        `SUBCOMPONENT_SELECTOR must be a valid CSS selector, got: ${CONFIG.subcomponentSelector}`
      );
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${validationErrors
        .map((e) => `  - ${e}`)
        .join("\n")}`
    );
  }

  logger.debug("Environment variables validated successfully");
}

/**
 * Optimized element waiting with retry logic
 * @param {Object} page - Browser page instance
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<Object>} Element if found
 */
async function waitForElementSafe(
  page,
  selector,
  timeout = CONFIG.timeouts.element,
  retries = 3
) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const element = await page.waitForSelector(selector, {
        timeout: timeout / retries,
        state: "visible",
      });

      if (element) {
        logger.debug(
          `Element found: ${selector} (attempt ${attempt}/${retries})`
        );
        return element;
      }
    } catch (error) {
      lastError = error;
      logger.debug(
        `Element wait attempt ${attempt}/${retries} failed for ${selector}: ${error.message}`
      );

      if (attempt < retries) {
        await page.waitForTimeout(CONFIG.pollInterval);
      }
    }
  }

  throw new Error(
    `Failed to find element "${selector}" after ${retries} attempts: ${
      lastError?.message || "Unknown error"
    }`
  );
}

/**
 * Safe text input with validation
 * @param {Object} element - DOM element
 * @param {string} text - Text to type
 * @param {string} fieldName - Name of the field for error reporting
 */
async function typeTextSafe(element, text, fieldName) {
  if (!element) {
    throw new Error(
      `Cannot type into ${fieldName}: element is null or undefined`
    );
  }

  if (typeof text !== "string" || text.length === 0) {
    throw new Error(
      `Cannot type into ${fieldName}: text must be a non-empty string`
    );
  }

  try {
    await element.clear();
    await element.type(text, { delay: 50 }); // Add small delay for more reliable input
    logger.debug(`Successfully typed into ${fieldName}`);
  } catch (error) {
    throw new Error(`Failed to type into ${fieldName}: ${error.message}`);
  }
}

/**
 * Optimized network and CPU simulation with better error handling
 * @param {Object} context - Browser context
 * @param {Object} page - Browser page instance
 */
async function applySimulationConditions(context, page) {
  try {
    // Apply network simulation
    if (CONFIG.network.condition && CONFIG.network.condition !== "WIFI") {
      logger.info(`🌐 Applying ${CONFIG.network.condition} network simulation`);
      await page.emulateNetworkConditions(CONFIG.network.profile);
    }

    // Apply CPU throttling
    if (CONFIG.cpu.condition && CONFIG.cpu.throttling > 1) {
      logger.info(
        `💻 Applying ${CONFIG.cpu.condition} CPU simulation (${CONFIG.cpu.throttling}x throttling)`
      );
      await page.emulateCPUThrottling(CONFIG.cpu.throttling);
    }

    logger.debug("Simulation conditions applied successfully");
  } catch (error) {
    logger.warn(`Could not apply simulation conditions: ${error.message}`);
  }
}

/**
 * Optimized React component readiness checker with better performance
 * @param {Object} page - Browser page instance
 * @param {string} selector - CSS selector for the React component
 * @param {string} expectedText - Optional text content to verify
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<Object>} Component state and timing information
 */
async function waitForReactComponentReady(
  page,
  selector,
  expectedText = null,
  timeout = CONFIG.timeouts.component
) {
  const startTime = Date.now();
  let lastCheckTime = 0;
  const minCheckInterval = Math.max(50, CONFIG.pollInterval);

  const componentState = {
    isVisible: false,
    isEnabled: false,
    isInteractable: false,
    containsExpectedText: false,
    expectedTextIsVisible: false,
    paintWorkCompleted: false,
    loadTime: 0,
  };

  logger.debug(`Waiting for component: ${selector} (timeout: ${timeout}ms)`);

  while (Date.now() - startTime < timeout) {
    try {
      // Throttle checks to avoid excessive polling
      const now = Date.now();
      if (now - lastCheckTime < minCheckInterval) {
        await page.waitForTimeout(minCheckInterval - (now - lastCheckTime));
        continue;
      }
      lastCheckTime = now;

      const element = await page.$(selector);
      if (!element) {
        await page.waitForTimeout(CONFIG.pollInterval);
        continue;
      }

      // Check visibility first (most likely to fail)
      componentState.isVisible = await element.isVisible();
      if (!componentState.isVisible) {
        await page.waitForTimeout(CONFIG.pollInterval);
        continue;
      }

      // Check if element is enabled
      componentState.isEnabled =
        typeof element.isEnabled === "function"
          ? await element.isEnabled()
          : true;

      componentState.isInteractable =
        componentState.isVisible && componentState.isEnabled;

      if (componentState.isInteractable) {
        // Handle expected text validation
        if (expectedText) {
          const textContent = await element.textContent();
          componentState.containsExpectedText =
            textContent?.includes(expectedText) ?? false;

          if (componentState.containsExpectedText) {
            try {
              const textElement = page.locator(`text=${expectedText}`).first();
              componentState.expectedTextIsVisible =
                await textElement.isVisible();
            } catch {
              componentState.expectedTextIsVisible = componentState.isVisible;
            }

            if (componentState.expectedTextIsVisible) {
              componentState.paintWorkCompleted = await checkPaintCompletion(
                page
              );
              if (componentState.paintWorkCompleted) {
                componentState.loadTime = Date.now() - startTime;
                logger.debug(`Component ready in ${componentState.loadTime}ms`);
                break;
              }
            }
          }
        } else {
          // No text validation required
          componentState.containsExpectedText = true;
          componentState.expectedTextIsVisible = true;
          componentState.paintWorkCompleted = await checkPaintCompletion(page);

          if (componentState.paintWorkCompleted) {
            componentState.loadTime = Date.now() - startTime;
            logger.debug(`Component ready in ${componentState.loadTime}ms`);
            break;
          }
        }
      }
    } catch (error) {
      logger.debug(`Component check iteration failed: ${error.message}`);
    }

    await page.waitForTimeout(CONFIG.pollInterval);
  }

  if (!componentState.loadTime) {
    componentState.loadTime = Date.now() - startTime;
    logger.warn(
      `Component readiness timeout after ${componentState.loadTime}ms`
    );
  }

  return componentState;
}

/**
 * Optimized paint completion checker
 * @param {Object} page - Browser page instance
 * @returns {Promise<boolean>} True if paint work is completed
 */
async function checkPaintCompletion(page) {
  try {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        if (document.readyState === "complete") {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Force layout recalculation
              document.body.offsetHeight;
              resolve(performance.now() > 0);
            });
          });
        } else {
          resolve(false);
        }
      });
    });
  } catch (error) {
    logger.debug(`Paint completion check failed: ${error.message}`);
    return false;
  }
}

/**
 * Optimized component validation with better error reporting
 * @param {Object} componentState - State object from waitForReactComponentReady
 * @param {string} expectedText - Expected text content (optional)
 * @param {string} selector - CSS selector for the component being tested
 * @throws {Error} If any component validation check fails
 */
function performReactComponentChecks(componentState, expectedText, selector) {
  const checks = {
    "Component is visible": (s) => s.isVisible === true,
    "Component is enabled": (s) => s.isEnabled === true,
    "Component is interactable": (s) => s.isInteractable === true,
    "Component paint work completed": (s) => s.paintWorkCompleted === true,
  };

  if (expectedText) {
    checks["Component contains expected text"] = (s) =>
      s.containsExpectedText === true;
    checks["Expected text is visible"] = (s) =>
      s.expectedTextIsVisible === true;
  }

  const checkResults = check(componentState, checks);
  const failedChecks = Object.entries(checks)
    .filter(([, fn]) => !fn(componentState))
    .map(([name]) => name);

  // Log validation results
  group("Component Validation", () => {
    logger.info(`🎯 Validating component: "${selector}"`);
    if (expectedText) {
      logger.info(`📝 Expected text: "${expectedText}"`);
    }

    Object.entries(checks).forEach(([name, fn]) => {
      const passed = fn(componentState);
      logger.info(`${passed ? "✅" : "❌"} ${name}`);
    });

    if (failedChecks.length === 0) {
      logger.info(`✅ All component checks passed`);
    }
  });

  if (failedChecks.length > 0) {
    const errorMessage = `Component validation failed for "${selector}". Failed: ${failedChecks.join(
      ", "
    )}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return checkResults;
}

/**
 * Optimized component performance measurement
 * @param {Object} page - Browser page instance
 * @param {string} selector - CSS selector for the React component
 * @param {string} expectedText - Optional expected text content
 * @returns {Promise<number>} Component load time in milliseconds
 */
async function measureReactComponentPerformance(page, selector, expectedText) {
  logger.info(`🎯 Measuring component performance: ${selector}`);
  if (expectedText) {
    logger.info(`📝 Expected text: "${expectedText}"`);
  }

  const componentState = await waitForReactComponentReady(
    page,
    selector,
    expectedText
  );

  try {
    performReactComponentChecks(componentState, expectedText, selector);
    metrics.subcomponentLoadTime.add(componentState.loadTime);

    logger.info(`🎯 Component load time: ${componentState.loadTime}ms`);

    await takeScreenshot(
      page,
      "component",
      "pass",
      selector,
      selector,
      expectedText
    );
    return componentState.loadTime;
  } catch (error) {
    await takeScreenshot(
      page,
      "component",
      "fail",
      selector,
      selector,
      expectedText
    );
    throw error;
  }
}

/**
 * Optimized page performance measurement with multiple load states
 * @param {Object} page - Browser page instance
 * @returns {Promise<Object>} Object containing timing details
 */
async function measureReactPagePerformance(page) {
  const timings = {
    domContentLoaded: 0,
    networkIdle: 0,
    total: 0,
    networkIdleSuccess: false,
  };

  const startTime = Date.now();

  try {
    // Measure DOM content loaded time
    const domStartTime = Date.now();
    await page.waitForLoadState("domcontentloaded");
    timings.domContentLoaded = Date.now() - domStartTime;
    metrics.domContentLoadedTime.add(timings.domContentLoaded);

    // Measure network idle time
    const networkStartTime = Date.now();
    try {
      await page.waitForLoadState("networkidle", {
        timeout: CONFIG.timeouts.http * 2,
      });
      timings.networkIdleSuccess = true;
    } catch (error) {
      logger.warn(`Network idle timeout: ${error.message}`);
    }
    timings.networkIdle = Date.now() - networkStartTime;
    metrics.networkIdleTime.add(timings.networkIdle);

    timings.total = Date.now() - startTime;
    metrics.mainPageLoadTime.add(timings.total);

    logger.info(
      `🚀 Page performance - DOM: ${timings.domContentLoaded}ms, Network: ${timings.networkIdle}ms, Total: ${timings.total}ms`
    );

    await takeScreenshot(
      page,
      "page",
      timings.networkIdleSuccess ? "pass" : "partial",
      CONFIG.testUrl
    );

    return timings;
  } catch (error) {
    timings.total = Date.now() - startTime;
    logger.error(`Page performance measurement failed: ${error.message}`);
    await takeScreenshot(page, "page", "fail", CONFIG.testUrl);
    throw error;
  }
}

/**
 * Optimized main UI performance measurement with enhanced network logging
 * @param {Object} page - Browser page instance
 */
async function measureReactUIPerformance(page) {
  const networkLogs = [];
  const requestTimings = new Map();
  const apiMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

  // Set up network monitoring if enabled
  if (CONFIG.features.networkLogging) {
    page.on("request", (req) => {
      const method =
        typeof req.method === "function" ? req.method() : req.method;
      if (apiMethods.includes(method?.toUpperCase())) {
        const requestId = req._guid || req.url();
        requestTimings.set(requestId, {
          start: Date.now(),
          method: method.toUpperCase(),
          url: req.url(),
        });
      }
    });

    page.on("response", (res) => {
      const req = res.request();
      const method =
        typeof req.method === "function" ? req.method() : req.method;
      if (apiMethods.includes(method?.toUpperCase())) {
        const requestId = req._guid || req.url();
        const timing = requestTimings.get(requestId);
        if (timing) {
          const responseTime = Date.now() - timing.start;
          networkLogs.push({
            method: method.toUpperCase(),
            url: req.url(),
            responseTime,
            status: res.status(),
          });
          requestTimings.delete(requestId);
        }
      }
    });
  }

  // Navigate to the test URL
  logger.info(`🚀 Navigating to: ${CONFIG.testUrl}`);
  await page.goto(CONFIG.testUrl, {
    waitUntil: "domcontentloaded",
    timeout: CONFIG.timeouts.domcontentloaded,
  });

  // Apply simulation conditions
  await applySimulationConditions(null, page);

  let result;

  // Measure either component or page performance
  if (CONFIG.subcomponentSelector) {
    logger.info(`🎯 Measuring subcomponent: ${CONFIG.subcomponentSelector}`);
    const loadTime = await measureReactComponentPerformance(
      page,
      CONFIG.subcomponentSelector,
      CONFIG.expectedText
    );
    result = { type: "component", loadTime };
    logger.info(`🎯 Subcomponent performance: ${loadTime}ms`);
  } else {
    logger.info(`🚀 Measuring page performance`);
    const pageResult = await measureReactPagePerformance(page);
    result = { type: "page", ...pageResult };
    logger.info(
      `🚀 Page performance: ${pageResult.total}ms (Network idle: ${
        pageResult.networkIdleSuccess ? "✅" : "❌"
      })`
    );
  }

  // Log network performance if enabled
  if (CONFIG.features.networkLogging && networkLogs.length > 0) {
    logNetworkPerformance(networkLogs);
  }

  return result;
}

/**
 * Enhanced network performance logging
 * @param {Array} networkLogs - Array of network request logs
 */
function logNetworkPerformance(networkLogs) {
  // Sort by response time (slowest first)
  networkLogs.sort((a, b) => b.responseTime - a.responseTime);

  const apiRequests = networkLogs.filter((log) => log.url.includes("/api/"));

  if (apiRequests.length === 0) {
    logger.info("📡 No API requests detected");
    return;
  }

  logger.info("📡 API Performance Summary:");
  logger.info(
    "┌────────┬─────────────────┬─────────┬──────────────────────────────────────────────────────────────────────┐"
  );
  logger.info(
    "│ METHOD │ RESPONSE (ms)   │ STATUS  │ URL                                                                  │"
  );
  logger.info(
    "├────────┼─────────────────┼─────────┼──────────────────────────────────────────────────────────────────────┤"
  );

  for (const log of apiRequests.slice(0, 10)) {
    // Show top 10 slowest
    const apiIndex = log.url.indexOf("/api/");
    const truncatedUrl = apiIndex >= 0 ? log.url.substring(apiIndex) : log.url;

    // Add to metrics
    metrics.apiResponseTime.add(log.responseTime, { url: truncatedUrl });

    // Format row
    const method = (log.method || "").padEnd(6);
    const responseTime = String(log.responseTime).padStart(12);
    const status = String(log.status || "").padStart(6);
    const url =
      truncatedUrl.length > 68
        ? truncatedUrl.substring(0, 65) + "..."
        : truncatedUrl.padEnd(68);

    logger.info(`│ ${method} │ ${responseTime}    │ ${status}  │ ${url} │`);
  }

  logger.info(
    "└────────┴─────────────────┴─────────┴──────────────────────────────────────────────────────────────────────┘"
  );

  if (apiRequests.length > 10) {
    logger.info(`📡 ... and ${apiRequests.length - 10} more API requests`);
  }

  // Calculate statistics
  const responseTimes = apiRequests.map((log) => log.responseTime);
  const avgResponseTime =
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  logger.info(
    `📊 API Stats - Count: ${
      apiRequests.length
    }, Avg: ${avgResponseTime.toFixed(
      1
    )}ms, Min: ${minResponseTime}ms, Max: ${maxResponseTime}ms`
  );
}

/**
 * Optimized main test execution function
 */
export default async function () {
  const startTime = Date.now();

  logger.info("🚀 Starting k6 UI Performance Test");
  logger.info(`📋 Test URL: ${CONFIG.testUrl}`);
  logger.info(`👥 VUs: ${CONFIG.vus}, Iterations: ${CONFIG.iterations}`);
  logger.info(
    `⚙️ Features - Screenshots: ${CONFIG.features.screenshots}, Network Logging: ${CONFIG.features.networkLogging}, Highlighting: ${CONFIG.features.highlighting}`
  );

  // Validate environment before starting
  validateRequiredEnvironmentVariables();
  logger.info("✅ Environment validation completed");

  // HTTP connectivity check
  group("HTTP Connectivity Check", () => {
    try {
      const httpRes = http.get(CONFIG.testUrl, {
        timeout: `${CONFIG.timeouts.http}ms`,
      });

      const connectivityChecks = check(httpRes, {
        "HTTP status is 200": (r) => r.status === 200,
        [`HTTP response time < ${CONFIG.connectivityTimeThreshold}ms`]: (r) =>
          r.timings.duration < CONFIG.connectivityTimeThreshold,
      });

      logger.info(
        `🌐 HTTP Status: ${httpRes.status} (${
          httpRes.status === 200 ? "✅" : "❌"
        })`
      );
      logger.info(
        `⏱️ HTTP Response: ${httpRes.timings.duration}ms (${
          httpRes.timings.duration < CONFIG.connectivityTimeThreshold
            ? "✅"
            : "❌"
        })`
      );

      if (!connectivityChecks) {
        logger.warn(
          "⚠️ HTTP connectivity checks failed, but continuing with test"
        );
      }
    } catch (error) {
      logger.error(`❌ HTTP connectivity check failed: ${error.message}`);
      throw error;
    }
  });

  // Create browser context and page
  let context, page;

  try {
    logger.debug("🌐 Creating browser context");
    context = await browser.newContext(browserOptions);
    page = await context.newPage();

    // Run the main performance measurement
    const result = await measureReactUIPerformance(page);

    const totalTime = Date.now() - startTime;
    logger.info(`✅ Test iteration completed in ${totalTime}ms`);
    logger.info(`📊 Result: ${result.type} measurement completed successfully`);

    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    logger.error(
      `❌ Test iteration failed after ${totalTime}ms: ${error.message}`
    );

    // Take error screenshot if page is available
    if (page) {
      await takeScreenshot(page, "error", "fail", "critical_failure");
    }

    throw error;
  } finally {
    // Cleanup resources
    try {
      if (page) {
        await page.close();
        logger.debug("🧹 Page closed");
      }
      if (context) {
        await context.close();
        logger.debug("🧹 Browser context closed");
      }
    } catch (cleanupError) {
      logger.warn(`⚠️ Cleanup failed: ${cleanupError.message}`);
    }
  }
}
