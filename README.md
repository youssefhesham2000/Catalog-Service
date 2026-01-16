A high-performance product search API built with NestJS, PostgreSQL, OpenSearch, and Redis.

## Features

- **Full-text search** with relevance ranking and fuzzy matching
- **Attribute filtering** (color, size, brand, category, price range)
- **Faceted search** for dynamic filter options
- **Product grouping** with variant options
- **Best-selling ranking** using 30-day sales data
- **Cursor-based pagination** for efficient paging
- **Response caching** with Redis
- **Distributed rate limiting** with Redis
- **Circuit breakers** for resilience (Opossum)
- **Connection pooling** with PgBouncer
- **Health checks** for all dependencies
- **Structured logging** with Pino

## Tech Stack

- **Runtime**: Bun / Node.js
- **Framework**: NestJS 10
- **Database**: PostgreSQL 18 with Prisma ORM
- **Connection Pool**: PgBouncer
- **Search**: OpenSearch 2 (3-node cluster)
- **Cache**: Redis 7
- **Load Balancer**: Nginx
- **Documentation**: OpenAPI/Swagger

## Environment Setup:
### Starting the docker deployment:
Navigate to the project folder that contains docker-compose.yml
```bash
docker compose --profile full up -d --build
```
### Check all services are healthy (wait ~30-60 seconds)
```bash
docker compose ps
```
###  Verify health endpoint
curl http://localhost:3000/api/v1/health
```

Expected output:
```json
{
  "status": "ok",
  "info": {
    "postgres": { "status": "up" },
    "opensearch": { "status": "green", "numberOfNodes": 3 },
    "redis": { "status": "up" }
  }
}
```
###  Run Database Migrations

```bash
docker exec bosta-api-1 bunx prisma migrate deploy
docker exec bosta-api-1 bun scripts/create-index.ts
```

###  Seed Data

```bash
# Seed 2 million products (~10 minutes)
docker exec bosta-api-1 bun scripts/seed-bulk.ts

# Or seed smaller dataset for testing (~1 minute)
docker exec bosta-api-1 bun scripts/seed-bulk.ts -- --count=10000
```

### Test the API

```bash
# Search products
curl "http://localhost:3000/api/v1/search?q=shirt&limit=5" | jq
```
### 6. Access Swagger Docs

Open http://localhost:3000/api/docs in your browser.
