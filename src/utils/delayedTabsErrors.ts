export type DelayedTabsErrorCode =
  | 'extensionUnavailable'
  | 'backgroundUnavailable'
  | 'invalidTime'
  | 'invalidDuration';

export class DelayedTabsError extends Error {
  constructor(
    public readonly code: DelayedTabsErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'DelayedTabsError';
  }
}
