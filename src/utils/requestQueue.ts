import { toast } from 'sonner';

interface QueuedRequest {
  id: string;
  fn: () => Promise<void>;
  timestamp: number;
}

class RequestQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private listeners: Set<(queue: QueuedRequest[]) => void> = new Set();

  /**
   * Add a request to the queue
   */
  add(fn: () => Promise<void>): string {
    const id = `${Date.now()}-${Math.random()}`;
    const request: QueuedRequest = {
      id,
      fn,
      timestamp: Date.now(),
    };

    this.queue.push(request);
    this.notifyListeners();

    // Start processing if not already
    if (!this.processing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process all queued requests
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        await request.fn();
        
        // Remove from queue on success
        this.queue.shift();
        this.notifyListeners();
      } catch (error) {
        console.error('Failed to process queued request:', error);
        
        // Keep in queue to retry later
        break;
      }
    }

    this.processing = false;

    // If there are still items in queue, retry after a delay
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 5000);
    }
  }

  /**
   * Retry processing the queue (called when connection is restored)
   */
  retryQueue() {
    if (this.queue.length > 0 && !this.processing) {
      toast.info('Retrying pending messages...', {
        description: `${this.queue.length} message(s) in queue`,
      });
      this.processQueue();
    }
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedRequest[]) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getQueue()));
  }

  /**
   * Clear the queue
   */
  clear() {
    this.queue = [];
    this.notifyListeners();
  }
}

// Singleton instance
export const requestQueue = new RequestQueue();
