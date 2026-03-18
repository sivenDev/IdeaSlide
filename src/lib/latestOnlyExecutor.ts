export type LatestOnlyExecutorResult<T> =
  | { status: "completed"; value: T }
  | { status: "replaced" };

interface PendingJob<TInput, TResult> {
  input: TInput;
  resolve: (value: LatestOnlyExecutorResult<TResult>) => void;
  reject: (reason?: unknown) => void;
}

export class LatestOnlyExecutor<TInput, TResult> {
  private activeJob: Promise<void> | null = null;
  private pendingJob: PendingJob<TInput, TResult> | null = null;
  private readonly worker: (input: TInput) => Promise<TResult>;

  constructor(worker: (input: TInput) => Promise<TResult>) {
    this.worker = worker;
  }

  schedule(input: TInput): Promise<LatestOnlyExecutorResult<TResult>> {
    return new Promise((resolve, reject) => {
      const job: PendingJob<TInput, TResult> = {
        input,
        resolve,
        reject,
      };

      if (this.activeJob) {
        if (this.pendingJob) {
          this.pendingJob.resolve({ status: "replaced" });
        }
        this.pendingJob = job;
        return;
      }

      this.activeJob = this.run(job);
    });
  }

  private async run(job: PendingJob<TInput, TResult>): Promise<void> {
    try {
      const value = await this.worker(job.input);
      job.resolve({ status: "completed", value });
    } catch (error) {
      job.reject(error);
    } finally {
      this.activeJob = null;

      if (!this.pendingJob) {
        return;
      }

      const nextJob = this.pendingJob;
      this.pendingJob = null;
      this.activeJob = this.run(nextJob);
    }
  }
}
