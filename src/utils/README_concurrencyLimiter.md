# Concurrency Limiter Decorator

A powerful TypeScript decorator and utility for limiting concurrent executions of async functions. This is particularly useful for controlling API request rates and preventing overwhelming external services.

## Features

- 🚦 **Concurrency Control**: Limit the number of simultaneous executions
- 📊 **Queue Management**: LIFO queue handling with overflow protection
- 🎯 **Error Handling**: Graceful error handling with custom callbacks
- 📈 **Statistics & Monitoring**: Real-time queue and execution statistics
- 🔧 **Dynamic Configuration**: Update limits at runtime
- 🎨 **Multiple Usage Patterns**: Decorator, function wrapper, and direct usage

## Installation

The concurrency limiter is included in the project utilities. No additional installation required.

## Basic Usage

### 1. Method Decorator

```typescript
import { withConcurrencyLimit } from '../utils/concurrencyLimiter';

class ApiService {
  @withConcurrencyLimit({ maxConcurrent: 3 })
  async fetchData(id: string): Promise<any> {
    // Your API call here
    return await fetch(`/api/data/${id}`);
  }
}
```

### 2. Function Wrapper

```typescript
import { limitConcurrency } from '../utils/concurrencyLimiter';

const limitedApiCall = limitConcurrency(
  async (endpoint: string) => {
    return await fetch(endpoint);
  },
  {
    maxConcurrent: 5
  }
);
```

### 3. Direct Usage

```typescript
import { createConcurrencyLimiter } from '../utils/concurrencyLimiter';

const limiter = createConcurrencyLimiter({
  maxConcurrent: 2
});

const result = await limiter.executeWithLimit(
  async () => { /* your function */ },
  'functionName',
  [/* arguments */]
);
```

## Configuration Options

```typescript
interface ConcurrencyLimiterOptions {
  maxConcurrent?: number;        // Maximum concurrent executions (default: 5)
  onQueueFull?: (functionName: string) => void;     // Queue overflow callback
  onError?: (functionName: string, error: any) => void;         // Error callback
}
```

## Queue Behavior

The concurrency limiter uses a **LIFO (Last In, First Out)** queue, meaning:
- The most recently queued function will be executed first
- This is useful for scenarios where newer requests are more important
- Helps prioritize recent user actions over older background tasks
- Reduces latency for interactive operations

### Example LIFO Behavior:
```typescript
// If you queue functions A, B, C in that order
// They will execute in order: C, B, A (LIFO)
const limiter = createConcurrencyLimiter({ maxConcurrent: 1 });

limiter.executeWithLimit(() => console.log('A'), 'A', []);
limiter.executeWithLimit(() => console.log('B'), 'B', []);
limiter.executeWithLimit(() => console.log('C'), 'C', []);

// Output: C, B, A
```

## Advanced Usage

### Batch Processing

```typescript
class BatchProcessor {
  private limiter = createConcurrencyLimiter({ maxConcurrent: 3 });

  async processBatch(items: string[]): Promise<any[]> {
    const promises = items.map(item => 
      this.limiter.executeWithLimit(
        this.processItem.bind(this),
        'processItem',
        [item]
      )
    );
    
    return Promise.all(promises);
  }

  private async processItem(item: string): Promise<any> {
    // Process individual item
    return { item, processed: true };
  }
}
```

### Dynamic Limit Adjustment

```typescript
class AdaptiveService {
  private limiter = createConcurrencyLimiter({ maxConcurrent: 2 });

  async adaptiveRequest(endpoint: string): Promise<any> {
    const stats = this.limiter.getStats();
    
    // Adjust limits based on current load
    if (stats.queueLength > 5) {
      this.limiter.updateLimits({ maxConcurrent: 1 });
    } else if (stats.queueLength === 0) {
      this.limiter.updateLimits({ maxConcurrent: 3 });
    }

    return this.limiter.executeWithLimit(
      this.makeRequest.bind(this),
      'makeRequest',
      [endpoint]
    );
  }
}
```

### Monitoring and Statistics

```typescript
const limiter = createConcurrencyLimiter();

// Get current statistics
const stats = limiter.getStats();
console.log({
  queueLength: stats.queueLength,        // Items waiting in queue
  runningCount: stats.runningCount,      // Currently executing
  maxConcurrent: stats.maxConcurrent,    // Maximum allowed concurrent
  oldestQueuedItem: stats.oldestQueuedItem  // Timestamp of oldest queued item
});
```

## Error Handling

The concurrency limiter includes graceful error handling:

### Custom Error Handling

```typescript
const limiter = createConcurrencyLimiter({
  onQueueFull: (functionName) => {
    console.error(`Queue overflow for ${functionName}`);
  },
  onError: (functionName, error) => {
    console.error(`Error in ${functionName}:`, error.message);
  }
});
```

## Integration Examples

### With Existing Services

```typescript
class IntegrationExample {
  private limiter = createConcurrencyLimiter({ maxConcurrent: 3 });

  // Wrap existing async functions
  async callExternalApi(url: string): Promise<any> {
    return this.limiter.executeWithLimit(
      async (url: string) => {
        // Your existing API call logic
        return await fetch(url);
      },
      'callExternalApi',
      [url]
    );
  }
}
```

### Progress Tracking

```typescript
async function processWithProgress(items: string[]): Promise<any[]> {
  const limiter = createConcurrencyLimiter({ maxConcurrent: 2 });
  const results = [];
  let completed = 0;

  const promises = items.map(async (item, index) => {
    const result = await limiter.executeWithLimit(
      async (item: string) => {
        // Process item
        return { item, processed: true };
      },
      'processItem',
      [item]
    );
    
    completed++;
    console.log(`Progress: ${completed}/${items.length}`);
    
    return result;
  });

  return Promise.all(promises);
}
```

## Best Practices

1. **Choose Appropriate Limits**: Start with conservative limits and adjust based on performance
2. **Monitor Queue Length**: Use statistics to identify bottlenecks
3. **Handle Queue Overflow**: Implement appropriate error handling for queue full scenarios
4. **Monitor Performance**: Track execution times and adjust limits accordingly

## Performance Considerations

- **Memory Usage**: Queue items are stored in memory, so avoid extremely large queues
- **CPU Overhead**: Minimal overhead for queue management
- **Network Impact**: Helps prevent overwhelming external APIs
- **Scalability**: Scales well for most use cases

## Troubleshooting

### Common Issues

1. **Queue Full Errors**: Increase `maxConcurrent` or implement backpressure
2. **Memory Leaks**: Ensure proper cleanup with `clearQueue()`
3. **Performance Issues**: Monitor statistics and adjust limits

### Debug Mode

Enable detailed logging by setting up error callbacks:

```typescript
const limiter = createConcurrencyLimiter({
  onQueueFull: (fn) => console.warn(`Queue full: ${fn}`),
  onError: (fn, error) => console.error(`Error in ${fn}:`, error)
});
```

## API Reference

### ConcurrencyLimiter Class

- `executeWithLimit(fn, functionName, args)`: Execute function with limits
- `getStats()`: Get current statistics
- `clearQueue()`: Clear all pending items
- `updateLimits(options)`: Update configuration

### Decorators

- `@withConcurrencyLimit(options)`: Method decorator
- `limitConcurrency(fn, options)`: Function wrapper

### Factory Functions

- `createConcurrencyLimiter(options)`: Create new limiter instance 