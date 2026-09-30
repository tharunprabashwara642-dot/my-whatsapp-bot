interface PendingJob<T> {
  task: () => Promise<T> | T;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

export class WorkLimiter {
  private active = 0;
  private closed = false;
  private queue: PendingJob<unknown>[] = [];
  private drainWaiters: Array<() => void> = [];

  constructor(
    private readonly concurrency: number,
    private readonly maxQueued: number,
  ) {
    if (
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      !Number.isInteger(maxQueued) ||
      maxQueued < 0
    ) {
      throw new Error("WorkLimiter needs positive concurrency and a non-negative queue limit.");
    }
  }

  run<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Service is shutting down."));
    return new Promise<T>((resolve, reject) => {
      const job: PendingJob<T> = { task, resolve, reject };
      if (this.active < this.concurrency) this.start(job);
      else if (this.queue.length < this.maxQueued) this.queue.push(job as PendingJob<unknown>);
      else reject(new Error("Work queue is full."));
    });
  }

  close(): void {
    this.closed = true;
    for (const job of this.queue.splice(0)) job.reject(new Error("Service is shutting down."));
    this.notifyDrained();
  }

  async drain(): Promise<void> {
    if (this.active === 0) return;
    await new Promise<void>((resolve) => this.drainWaiters.push(resolve));
  }

  private start<T>(job: PendingJob<T>): void {
    this.active += 1;
    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        this.active -= 1;
        const next = this.queue.shift();
        if (next && !this.closed) this.start(next);
        else if (next) next.reject(new Error("Service is shutting down."));
        this.notifyDrained();
      });
  }

  private notifyDrained(): void {
    if (this.active !== 0) return;
    for (const resolve of this.drainWaiters.splice(0)) resolve();
  }
}
