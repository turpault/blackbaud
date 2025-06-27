export interface QueueTask<T = any> {
  id: string;
  type: string;
  priority?: number;
  execute: () => Promise<T>;
  onSuccess?: (result: T) => void;
  onError?: (error: any) => void;
  retries?: number;
  maxRetries?: number;
}

export interface QueueStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  pendingTasks: number;
  runningTasks: number;
  averageExecutionTime: number;
  tasksByType: Record<string, { total: number; completed: number; failed: number }>;
}

export interface QueueOptions {
  maxConcurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  enableStats?: boolean;
  onTaskComplete?: (taskId: string, result: any) => void;
  onTaskError?: (taskId: string, error: any) => void;
  onQueueEmpty?: () => void;
}

class ConcurrentQueue {
  private queue: QueueTask[] = [];
  private running: Set<string> = new Set();
  private completed: Map<string, any> = new Map();
  private failed: Map<string, any> = new Map();
  private stats: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    executionTimes: number[];
    tasksByType: Record<string, { total: number; completed: number; failed: number }>;
  };
  private options: Required<QueueOptions>;
  private isProcessing = false;

  constructor(options: QueueOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency || 3,
      retryDelay: options.retryDelay || 1000,
      maxRetries: options.maxRetries || 3,
      enableStats: options.enableStats ?? true,
      onTaskComplete: options.onTaskComplete || (() => {}),
      onTaskError: options.onTaskError || (() => {}),
      onQueueEmpty: options.onQueueEmpty || (() => {})
    };

    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      executionTimes: [],
      tasksByType: {}
    };
  }

  add(task: QueueTask): void {
    if (this.options.enableStats && !this.stats.tasksByType[task.type]) {
      this.stats.tasksByType[task.type] = { total: 0, completed: 0, failed: 0 };
    }

    if (this.options.enableStats) {
      this.stats.totalTasks++;
      this.stats.tasksByType[task.type].total++;
    }

    if (task.retries === undefined) {
      task.retries = 0;
    }
    if (task.maxRetries === undefined) {
      task.maxRetries = this.options.maxRetries;
    }

    const priority = task.priority || 0;
    const insertIndex = this.queue.findIndex(t => (t.priority || 0) > priority);
    
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    console.log(`📋 Added task ${task.id} (${task.type}) to queue. Queue size: ${this.queue.length}`);
    this.process();
  }

  remove(taskId: string): boolean {
    const index = this.queue.findIndex(task => task.id === taskId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      console.log(`🗑️ Removed task ${taskId} from queue`);
      return true;
    }
    return false;
  }

  clear(): void {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`🧹 Cleared ${clearedCount} pending tasks from queue`);
  }

  getStats(): QueueStats {
    const totalExecutionTime = this.stats.executionTimes.reduce((sum, time) => sum + time, 0);
    const averageExecutionTime = this.stats.executionTimes.length > 0 
      ? totalExecutionTime / this.stats.executionTimes.length 
      : 0;

    return {
      totalTasks: this.stats.totalTasks,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
      pendingTasks: this.queue.length,
      runningTasks: this.running.size,
      averageExecutionTime,
      tasksByType: { ...this.stats.tasksByType }
    };
  }

  isCompleted(taskId: string): boolean {
    return this.completed.has(taskId);
  }

  isFailed(taskId: string): boolean {
    return this.failed.has(taskId);
  }

  getResult(taskId: string): any {
    return this.completed.get(taskId);
  }

  getError(taskId: string): any {
    return this.failed.get(taskId);
  }

  async waitForTask(taskId: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkTask = () => {
        if (this.completed.has(taskId)) {
          resolve(this.completed.get(taskId));
        } else if (this.failed.has(taskId)) {
          reject(this.failed.get(taskId));
        } else if (timeout && (Date.now() - startTime) > timeout) {
          reject(new Error(`Task ${taskId} timed out after ${timeout}ms`));
        } else {
          setTimeout(checkTask, 100);
        }
      };
      
      checkTask();
    });
  }

  async waitForAll(timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkQueue = () => {
        if (this.queue.length === 0 && this.running.size === 0) {
          resolve();
        } else if (timeout && (Date.now() - startTime) > timeout) {
          reject(new Error(`Queue timed out after ${timeout}ms`));
        } else {
          setTimeout(checkQueue, 100);
        }
      };
      
      checkQueue();
    });
  }

  private async process(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.running.size < this.options.maxConcurrency) {
      const task = this.queue.shift()!;
      this.running.add(task.id);
      
      console.log(`🚀 Starting task ${task.id} (${task.type}). Running: ${this.running.size}/${this.options.maxConcurrency}`);
      
      this.executeTask(task).finally(() => {
        this.running.delete(task.id);
        console.log(`🏁 Finished task ${task.id} (${task.type}). Running: ${this.running.size}/${this.options.maxConcurrency}`);
        
        if (this.queue.length > 0) {
          this.process();
        } else if (this.running.size === 0) {
          this.isProcessing = false;
          this.options.onQueueEmpty();
        }
      });
    }
    
    this.isProcessing = false;
  }

  private async executeTask(task: QueueTask): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await task.execute();
      const executionTime = Date.now() - startTime;
      
      if (this.options.enableStats) {
        this.stats.completedTasks++;
        this.stats.tasksByType[task.type].completed++;
        this.stats.executionTimes.push(executionTime);
      }
      
      this.completed.set(task.id, result);
      
      console.log(`✅ Task ${task.id} (${task.type}) completed in ${executionTime}ms`);
      
      if (task.onSuccess) {
        task.onSuccess(result);
      }
      this.options.onTaskComplete(task.id, result);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      console.error(`❌ Task ${task.id} (${task.type}) failed after ${executionTime}ms:`, error);
      
      if (task.retries! < task.maxRetries!) {
        task.retries!++;
        console.log(`🔄 Retrying task ${task.id} (${task.type}) - attempt ${task.retries}/${task.maxRetries}`);
        
        setTimeout(() => {
          this.add(task);
        }, this.options.retryDelay);
        
        return;
      }
      
      if (this.options.enableStats) {
        this.stats.failedTasks++;
        this.stats.tasksByType[task.type].failed++;
      }
      
      this.failed.set(task.id, error);
      
      if (task.onError) {
        task.onError(error);
      }
      this.options.onTaskError(task.id, error);
    }
  }
}

export const constituentQueue = new ConcurrentQueue({
  maxConcurrency: 2,
  retryDelay: 2000,
  maxRetries: 3,
  enableStats: true
});

export const attachmentQueue = new ConcurrentQueue({
  maxConcurrency: 3,
  retryDelay: 1000,
  maxRetries: 2,
  enableStats: true
});

export default ConcurrentQueue;
