interface DownloadTask {
  id: string;
  url: string;
  name: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  startTime: number;
}

class PdfDownloadManager {
  private static instance: PdfDownloadManager;
  private downloadQueue: DownloadTask[] = [];
  private activeDownloads: Set<string> = new Set();
  private maxConcurrentDownloads = 3;
  private downloadTimeout = 30000; // 30 seconds timeout

  private constructor() {
    // Start the download processor
    this.processQueue();
  }

  public static getInstance(): PdfDownloadManager {
    if (!PdfDownloadManager.instance) {
      PdfDownloadManager.instance = new PdfDownloadManager();
    }
    return PdfDownloadManager.instance;
  }

  public async downloadPdf(url: string, name: string): Promise<any> {
    const taskId = `${url}-${Date.now()}-${Math.random()}`;
    
    return new Promise((resolve, reject) => {
      const task: DownloadTask = {
        id: taskId,
        url,
        name,
        resolve,
        reject,
        startTime: Date.now()
      };

      this.downloadQueue.push(task);
      console.log(`PDF download queued: ${name} (${this.downloadQueue.length} in queue, ${this.activeDownloads.size} active)`);
    });
  }

  private async processQueue(): Promise<void> {
    while (true) {
      // Check for completed downloads and remove them
      this.activeDownloads.forEach(downloadId => {
        // This would be updated when downloads complete
        // For now, we'll rely on the timeout mechanism
      });

      // Start new downloads if we have capacity
      while (this.activeDownloads.size < this.maxConcurrentDownloads && this.downloadQueue.length > 0) {
        const task = this.downloadQueue.shift();
        if (task) {
          this.startDownload(task);
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private async startDownload(task: DownloadTask): Promise<void> {
    this.activeDownloads.add(task.id);
    console.log(`Starting PDF download: ${task.name} (${this.activeDownloads.size} active downloads)`);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      this.activeDownloads.delete(task.id);
      task.reject(new Error(`Download timeout for ${task.name}`));
      console.log(`PDF download timeout: ${task.name}`);
    }, this.downloadTimeout);

    try {
      // Import PDF.js dynamically to avoid circular dependencies
      const pdfjsLib = require('pdfjs-dist');
      
      // Note: Worker setup is handled in PdfViewer.tsx to avoid conflicts

      // Load the PDF
      const loadingTask = pdfjsLib.getDocument(task.url);
      const pdf = await loadingTask.promise;

      clearTimeout(timeoutId);
      this.activeDownloads.delete(task.id);
      
      const duration = Date.now() - task.startTime;
      console.log(`PDF download completed: ${task.name} (${duration}ms)`);
      
      task.resolve(pdf);
    } catch (error) {
      clearTimeout(timeoutId);
      this.activeDownloads.delete(task.id);
      
      const duration = Date.now() - task.startTime;
      console.error(`PDF download failed: ${task.name} (${duration}ms)`, error);
      
      task.reject(error);
    }
  }

  public getStatus(): {
    queueLength: number;
    activeDownloads: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.downloadQueue.length,
      activeDownloads: this.activeDownloads.size,
      maxConcurrent: this.maxConcurrentDownloads
    };
  }

  public clearQueue(): void {
    this.downloadQueue.forEach(task => {
      task.reject(new Error('Download cancelled - queue cleared'));
    });
    this.downloadQueue = [];
    console.log('PDF download queue cleared');
  }
}

export default PdfDownloadManager; 