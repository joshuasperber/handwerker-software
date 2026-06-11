export interface JobReport {
  job: string;
  processed: number;
  skipped: number;
  errors: number;
  details?: string[];
}

export function emptyReport(job: string): JobReport {
  return { job, processed: 0, skipped: 0, errors: 0, details: [] };
}
