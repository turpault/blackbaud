/**
 * Concurrency Limiter Decorator
 * 
 * A decorator that limits the number of concurrent executions of async functions.
 * Useful for controlling API request rates and preventing overwhelming external services.
 */

interface ConcurrencyLimiterOptions {
  maxConcurrent?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onQueueFull?: (functionName: string) => void;
  onTimeout?: (functionName: string, timeout: number) => void;
  onError?: (functionName: string, error: any) => void;
}

interface QueuedFunction {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  functionName: string;
  timestamp: number;
}

class ConcurrencyLimiter {
  private queue: QueuedFunction[] = [];
  private running: Set<string> = new Set();
  private options: Required<ConcurrencyLimiterOptions>;

  constructor(options: ConcurrencyLimiterOptions = {}) {
    this.options = {
      maxConcurrent: options.maxConcurrent || 5,
      timeout: options.timeout || 30000, // 30 seconds
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000, // 1 second
      onQueueFull: options.onQueueFull || (() => {}),
      onTimeout: options.onTimeout || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Decorator function that limits concurrency
   */
  limit<T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value!;

    descriptor.value = (async function(this: any, ...args: any[]): Promise<any> {
      return this.concurrencyLimiter.executeWithLimit(
        originalMethod.bind(this),
        propertyKey.toString(),
        args
      );
    }) as T;

    return descriptor;
  }

  /**
   * Execute a function with concurrency limits
   */
  async executeWithLimit<T>(
    fn: (...args: any[]) => Promise<T>,
    functionName: string,
    args: any[] = []
  ): Promise<T> {
    const id = `${functionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise<T>((resolve, reject) => {
      const queuedFunction: QueuedFunction = {
        id,
        fn: () => fn(...args),
        resolve,
        reject,
        functionName,
        timestamp: Date.now(),
      };

      // Check if queue is full
      if (this.queue.length >= this.options.maxConcurrent * 2) {
        this.options.onQueueFull(functionName);
        reject(new Error(`Queue full for ${functionName}. Too many pending requests.`));
        return;
      }

      this.queue.push(queuedFunction);
      this.processQueue();
    });
  }

  /**
   * Process the queue of pending functions
   */
  private async processQueue(): Promise<void> {
    if (this.running.size >= this.options.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const queuedFunction = this.queue.shift();
    if (!queuedFunction) return;

    this.running.add(queuedFunction.id);
    
    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout after ${this.options.timeout}ms`));
        }, this.options.timeout);
      });

      // Execute the function with retry logic
      const result = await this.executeWithRetry(
        queuedFunction.fn,
        queuedFunction.functionName
      );

      queuedFunction.resolve(result);
    } catch (error: any) {
      this.options.onError(queuedFunction.functionName, error);
      queuedFunction.reject(error);
    } finally {
      this.running.delete(queuedFunction.id);
      // Process next item in queue
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    functionName: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.options.retryAttempts) {
          await this.delay(this.options.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError;
  }

  /**
   * Determine if an error should not be retried
   */
  private shouldNotRetry(error: any): boolean {
    // Don't retry on authentication errors, validation errors, etc.
    const nonRetryableErrors = [
      'Not authenticated',
      'Authentication expired',
      'Invalid request',
      'Validation failed',
      'Permission denied',
      'Not found',
    ];

    const errorMessage = error.message || error.toString();
    return nonRetryableErrors.some(msg => errorMessage.includes(msg));
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue statistics
   */
  getStats(): {
    queueLength: number;
    runningCount: number;
    maxConcurrent: number;
    oldestQueuedItem?: number;
  } {
    return {
      queueLength: this.queue.length,
      runningCount: this.running.size,
      maxConcurrent: this.options.maxConcurrent,
      oldestQueuedItem: this.queue.length > 0 ? this.queue[0].timestamp : undefined,
    };
  }

  /**
   * Clear the queue (useful for cleanup)
   */
  clearQueue(): void {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Update concurrency limits
   */
  updateLimits(options: Partial<ConcurrencyLimiterOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Factory function to create a concurrency limiter instance
 */
export function createConcurrencyLimiter(options?: ConcurrencyLimiterOptions): ConcurrencyLimiter {
  return new ConcurrencyLimiter(options);
}

/**
 * Decorator factory for class methods
 */
export function withConcurrencyLimit(options?: ConcurrencyLimiterOptions) {
  const limiter = createConcurrencyLimiter(options);
  
  return function<T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    return limiter.limit(target, propertyKey, descriptor);
  };
}

/**
 * Function wrapper for non-class functions
 */
export function limitConcurrency<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: ConcurrencyLimiterOptions
): T {
  const limiter = createConcurrencyLimiter(options);
  
  return (async (...args: any[]) => {
    return limiter.executeWithLimit(fn, fn.name || 'anonymous', args);
  }) as T;
}

export default ConcurrencyLimiter; 