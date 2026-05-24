# Stockpile — Inventory Reserve System

A real-time inventory reservation system built with Next.js 15, Prisma, Neon (Postgres), and Redis. Designed to handle concurrent reservation requests correctly under load.

---

## Running Locally

### Prerequisites

- Node.js 20+
- A Neon (or any Postgres) database
- An Upstash Redis instance (or any Redis — optional but recommended for distributed locking)

### Setup

```bash
git clone <repo>
cd stockpile
npm install

cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, REDIS_URL, CRON_SECRET
```

### Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations against your hosted DB
npx prisma migrate deploy

# Seed with products, warehouses, and stock levels
npx prisma db seed
```

### Dev server

```bash
npm run dev
# http://localhost:3000
```

---

## Architecture

### Data model

```
Product --< StockLevel >-- Warehouse
   \------< Reservation
```

StockLevel tracks total_units and reserved_units per product/warehouse pair. Available = total minus reserved. On confirmation, both are decremented (units sold). On release/expiry, only reserved_units is decremented (units returned to pool).

---

## Concurrency Correctness

This is the core of the system. Two simultaneous requests for the last unit of a SKU must result in exactly one success and one 409.

### Layered defence

**Layer 1 — Redis distributed lock (SET NX PX)**

Before entering the database transaction, the reserve endpoint acquires a per-productId:warehouseId Redis lock. Only one request holds the lock at a time; the other gets a 503 and can retry. Release uses a compare-and-delete Lua script so a lock is never stolen.

**Layer 2 — SELECT FOR UPDATE inside a Postgres transaction**

Even if Redis is unavailable (the client falls back to a noop token), the StockLevel row is locked at the DB level with FOR UPDATE. The second transaction blocks until the first commits, then reads the updated reserved_units, correctly sees 0 available, and throws a 409.

**Layer 3 — Lazy expiry before every stock check**

Before reading available stock, stale PENDING reservations are expired atomically via UPDATE ... WHERE status = 'PENDING' AND expires_at <= now() RETURNING. This means reserved_units is always fresh when we subtract it.

---

## Reservation Expiry

### Production: Vercel Cron + lazy cleanup (dual approach)

**Vercel Cron** (vercel.json) hits GET /api/cron/expire every minute. The handler atomically flips PENDING to EXPIRED and decrements reserved_units for all rows past their expiresAt in a single raw SQL statement.

**Lazy cleanup** runs on every call to GET /api/products and GET /api/reservations/:id. This ensures stock is always accurate even between cron ticks.

**Why both?** The cron handles bulk expiry efficiently. Lazy cleanup provides a safety net and ensures correctness even if the cron misses a tick.

---

## Idempotency (Bonus)

POST /api/reservations and POST /api/reservations/:id/confirm support the Idempotency-Key header.

On each request, check the idempotency_keys table. If found, return the stored response. If not, proceed normally and persist the key + response. Stored in Postgres for consistency across instances.

---

## Trade-offs & What I'd Do Differently

- **Proper auth** — reservations are unauthenticated. Production needs userId association + JWT.
- **Webhook/email on confirm** — UI reflects state but no email receipt.
- **Unit tests** — the concurrency path deserves load tests hitting the reserve endpoint simultaneously for a SKU with 1 unit.
- **Payment integration** — confirm represents payment success. In reality, call Stripe, then confirm on success.
- **Expiry granularity** — cron fires every minute, lazy cleanup eliminates this from the user-facing side.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript end-to-end |
| ORM | Prisma |
| Database | Neon (hosted Postgres) |
| Distributed lock | Upstash Redis via ioredis |
| Validation | Zod |
| Hosting | Vercel |
| Cron | Vercel Cron Jobs |
