# Vendra n8n Integration & Webhook Orchestration

`n8n` acts strictly as an external event and notification orchestration layer.
The Python backend (`vendra-backend`) and relational database remain the authoritative source of truth for all mission state, policy evaluation, and human approvals.

## Inbound Webhook Endpoints

1. `POST /api/webhooks/supplier-response`
   - Receives structured or unstructured supplier quote responses from email/ERP/WhatsApp bridges via n8n.
2. `POST /api/webhooks/external-event`
   - Receives supply chain disruption events (e.g., `DELIVERY_DELAY` where Supplier B lead time changes from `25 days` to `42 days`).
   - Example payload:
     ```json
     {
       "mission_id": "msn_...",
       "supplier_id": "sup_bommasandra_02",
       "event_type": "DELIVERY_DELAY",
       "message": "Delivery will now take 42 days.",
       "received_at": "2026-09-26T10:00:00Z"
     }
     ```
3. `POST /api/webhooks/approval`
   - Receives authenticated human approval/rejection callbacks.

## Security & Governance Rules
- Authenticate webhook requests with `X-N8N-Webhook-Secret` matching `N8N_WEBHOOK_SECRET` in `.env`.
- `n8n` must NEVER override the Policy Engine, approve payments autonomously, or mutate the database directly.
