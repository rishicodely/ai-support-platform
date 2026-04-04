export type EventPayload = {
  subject: string;
  priority: string;
};

export type EventEnvelope = {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  tenant_id: string;
  timestamp: string;
  payload: {
    status: string;
    subject: string;
    priority: string;
  };
};
