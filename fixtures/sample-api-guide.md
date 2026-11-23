# Payments API Quickstart

This guide explains how to authenticate, create a charge, and handle common errors with the Acme Payments API.

## Authentication

All requests require an API key. Pass it in the `Authorization` header:

```http
Authorization: Bearer acm_test_1234567890
```

Keys are scoped per environment. Use `acm_test_*` in sandbox and `acm_live_*` in production. Never commit live keys to source control.

## Create a charge

Send a `POST` request to `/v1/charges` with an amount in the smallest currency unit and a currency code.

### Request

```http
POST /v1/charges HTTP/1.1
Host: api.acme-payments.example
Authorization: Bearer acm_test_1234567890
Content-Type: application/json

{
  "amount": 2500,
  "currency": "usd",
  "source": "tok_visa_4242",
  "description": "Order #1842"
}
```

### Response

A successful response returns HTTP `201` and a charge object:

```json
{
  "id": "ch_9f3a2c",
  "status": "succeeded",
  "amount": 2500,
  "currency": "usd",
  "created_at": "2026-11-23T15:00:00Z"
}
```

## Idempotency

Retry-safe writes should include an `Idempotency-Key` header. If the same key is reused within 24 hours for the same endpoint and body, the API returns the original response instead of creating a duplicate charge.

## Error handling

| HTTP status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Missing or malformed fields |
| 401 | `unauthorized` | Missing or invalid API key |
| 402 | `card_declined` | The payment method was declined |
| 429 | `rate_limited` | Too many requests; retry with backoff |

When a charge fails, the response body includes `error.type`, `error.code`, and a human-readable `error.message`.

## Rate limits

Sandbox accounts are limited to **100 requests per minute**. Production accounts default to **600 requests per minute**. Rate-limit responses include `Retry-After` in seconds.

## Webhooks

Subscribe to `charge.succeeded` and `charge.failed` events to update order state asynchronously. Verify webhook signatures with your endpoint secret before trusting the payload.
