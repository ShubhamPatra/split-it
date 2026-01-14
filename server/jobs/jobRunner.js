/**
 * Job Runner Utility
 * 
 * Provides job execution with automatic retry logic, timeout protection,
 * and error isolation for the simple in-process job system.
 */

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a job with retry logic, error isolation, and abort support
 * @param {string} jobName - Name of the job for logging
 * @param {Function} handler - Async function to execute: handler(data, { signal })
 * @param {Object} data - Data to pass to the handler
 * @param {Object} options - Execution options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number|null} options.timeout - Timeout in ms, null to disable (default: 30000)
 * @param {number} options.initialDelay - Initial delay between retries in ms (default: 1000)
 * @param {AbortSignal} options.signal - External abort signal to respect
 * @returns {Promise<Object>} Result object with success status and data/error
 */
export const executeJob = async (jobName, handler, data, options = {}) => {
  const {
    maxRetries = 3,
    timeout = 30000,
    initialDelay = 1000,
    signal: externalSignal,
  } = options;

  const startTime = Date.now();

  // Check if already aborted before starting
  if (externalSignal?.aborted) {
    return {
      success: false,
      error: 'Job aborted before start',
      aborted: true,
      duration: 0,
    };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Create AbortController for this attempt (for timeout signaling)
    const controller = new AbortController();
    let timeoutId = null;

    // If external signal aborts, also abort internal controller
    const externalAbortHandler = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
    }

    try {
      // Create timeout promise (if timeout is enabled)
      let timeoutPromise;
      if (timeout !== null && timeout > 0) {
        timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            // Signal abort so handler can stop gracefully
            controller.abort();
            reject(new Error(`Job timeout after ${timeout}ms`));
          }, timeout);
        });
      }

      // Execute handler with abort signal
      const handlerPromise = handler(data, { signal: controller.signal });

      // Race between handler and timeout (if timeout enabled)
      const result = timeout !== null && timeout > 0
        ? await Promise.race([handlerPromise, timeoutPromise])
        : await handlerPromise;

      // Clear timeout on success
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      const duration = Date.now() - startTime;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[${jobName}] Completed in ${duration}ms (attempt ${attempt}/${maxRetries})`);
      }

      return {
        success: true,
        data: result,
        attempt,
        duration,
      };
    } catch (error) {
      // Clear timeout on failure as well
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Check if aborted (either by external signal or timeout)
      const wasAborted = controller.signal.aborted || externalSignal?.aborted;
      const isTimeoutError = error.message?.includes('timeout');

      const isLastAttempt = attempt === maxRetries;

      console.error(`[${jobName}] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      // Don't retry if externally aborted (timeout-induced aborts can still retry)
      if (externalSignal?.aborted) {
        const duration = Date.now() - startTime;
        return {
          success: false,
          error: 'Job aborted externally',
          aborted: true,
          attempt,
          duration,
        };
      }

      if (isLastAttempt) {
        const duration = Date.now() - startTime;
        console.error(`[${jobName}] All ${maxRetries} attempts failed. Total time: ${duration}ms`);

        return {
          success: false,
          error: error.message,
          aborted: wasAborted && !isTimeoutError,
          attempt,
          duration,
        };
      }

      // Exponential backoff: initialDelay * 2^(attempt-1)
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`[${jobName}] Retrying in ${delay}ms...`);
      await sleep(delay);
    } finally {
      // Cleanup external signal listener
      if (externalSignal) {
        externalSignal.removeEventListener('abort', externalAbortHandler);
      }
    }
  }
};

/**
 * Execute a handler with retry logic (simpler version without job name)
 * @param {Function} handler - Async function to execute
 * @param {Object} data - Data to pass to the handler
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} timeout - Timeout in ms (default: 30000)
 * @returns {Promise<any>} Result from handler or throws error
 */
export const executeWithRetry = async (handler, data, maxRetries = 3, timeout = 30000) => {
  const result = await executeJob('job', handler, data, { maxRetries, timeout });

  if (result.success) {
    return result.data;
  }

  throw new Error(result.error);
};

/**
 * Execute a job without throwing errors (fire and forget with logging)
 * Useful for non-critical background tasks
 * @param {string} jobName - Name of the job for logging
 * @param {Function} handler - Async function to execute
 * @param {Object} data - Data to pass to the handler
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Result object (never throws)
 */
export const executeJobSafe = async (jobName, handler, data, options = {}) => {
  try {
    return await executeJob(jobName, handler, data, options);
  } catch (error) {
    console.error(`[${jobName}] Unexpected error:`, error);
    return {
      success: false,
      error: error.message,
      unexpected: true,
    };
  }
};

/**
 * Execute multiple jobs in parallel with error isolation
 * Each job is executed independently; failures don't affect others
 * @param {Array<{name: string, handler: Function, data: Object, options?: Object}>} jobs
 * @returns {Promise<Array<Object>>} Array of results for each job
 */
export const executeJobsParallel = async (jobs) => {
  return Promise.all(
    jobs.map(({ name, handler, data, options }) =>
      executeJobSafe(name, handler, data, options)
    )
  );
};

export default {
  executeJob,
  executeWithRetry,
  executeJobSafe,
  executeJobsParallel,
};
