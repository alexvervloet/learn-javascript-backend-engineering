# Email Concepts

Sending, building, templating, testing, and reading email from Node — using the
2026 JS toolkit: **nodemailer** (SMTP), **nunjucks** (templates), and
**ImapFlow** (IMAP).

## The email stack in one picture

```
Your code
   │
   │ nodemailer                → submits outbound email
   ▼
SMTP server (Mailpit locally, Resend/SES in prod)
   │
   │ delivers to recipient's server
   ▼
Recipient's mailbox
   │
   │ ImapFlow                  → reads inbound email
   ▼
Your code
```

Mailpit is a local mail catcher: every email sent to port 1025 is captured and
shown at http://localhost:8025. Nothing reaches a real inbox — perfect for dev.

## Setup

```bash
npm install          # from the repo root (nodemailer, nunjucks, imapflow)
docker compose up -d # starts Mailpit
```

## Concept files

| File | What you'll learn |
|------|-------------------|
| [01_smtp_basics.ts](01_smtp_basics.ts) | Transports, connection modes (plain / STARTTLS / TLS), `verify`, debug logging |
| [02_message_building.ts](02_message_building.ts) | Message options, HTML + text, attachments, CC/BCC/Reply-To, custom headers |
| [03_templates.ts](03_templates.ts) | Nunjucks `{% extends %}`/`{% block %}` inheritance, auto-escaping, rendering + sending |
| [04_testing.test.ts](04_testing.test.ts) | `jsonTransport` for unit tests, Mailpit HTTP API for integration (Jest) |
| [05_transactional_pattern.ts](05_transactional_pattern.ts) | `EmailSender` abstraction, SMTP (dev) vs Resend HTTP API (prod), factory |
| [06_imap_reading.ts](06_imap_reading.ts) | ImapFlow connect, mailbox lock, search, fetch, flags, download |

## Running

```bash
docker compose up -d
npx tsx 01_smtp_basics.ts      # open http://localhost:8025 after each run
npm test -- email-concepts  # unit tests (no server needed)
# integration tests need Mailpit:
docker compose up -d && MAILPIT=1 npm test -- email-concepts
```

## Deliverability note (production)

Moving from Mailpit to real delivery needs three DNS records: **SPF** (allowed
sending IPs), **DKIM** (cryptographic signature on every message), and **DMARC**
(policy when SPF/DKIM fail). Transactional services (Resend, Postmark, SendGrid)
configure SPF/DKIM for you; raw SMTP from your own server means doing all three
by hand.
