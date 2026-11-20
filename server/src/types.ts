export interface WebhookEvent {
  id: string;
  sessionId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  timestamp: number;
  sizeBytes: number;
}
