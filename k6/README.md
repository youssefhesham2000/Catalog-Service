# K6 Load Tests

Load testing suite for the Bosta Product Catalog Search API.

## Prerequisites

Install k6:

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6

# Windows
choco install k6
```

## Test Files

| File | Purpose | Duration | VUs |
|------|---------|----------|-----|
| `quick-test.js` | Fast iteration testing | 1 min | 50 |
| `load-test.js` | Full load test suite | ~12 min | 0→300 |
| `stress-test.js` | Find breaking point | ~6 min | 0→500 |
| `soak-test.js` | Long-term stability | 30 min | 100 |

## Running Tests

### Quick Test (1 minute)

```bash
# Default (50 VUs, 1 min)
bun run k6:quick

# Custom
k6 run --vus 100 --duration 2m k6/quick-test.js
```

### Full Load Test (~12 minutes)

```bash
bun run k6:load

# With HTML report
k6 run --out json=results.json k6/load-test.js
```

### Stress Test (~6 minutes)

```bash
bun run k6:stress
```

### Soak Test (30 minutes)

```bash
bun run k6:soak
```

## Configuration

Set environment variables:

```bash
# Custom base URL
BASE_URL=http://api.example.com/api/v1 k6 run k6/quick-test.js
```

## Metrics

### Custom Metrics

| Metric | Description |
|--------|-------------|
| `search_latency` | Search endpoint response time |
| `facets_latency` | Facets endpoint response time |
| `error_rate` | Request failure rate |
| `cache_hit_rate` | Estimated cache hit ratio |

### Thresholds

| Metric | Threshold |
|--------|-----------|
| P95 Response Time | < 500ms |
| P99 Response Time | < 1000ms |
| Error Rate | < 1% |

## Scenarios (load-test.js)

1. **Smoke** (10s) - Verify system works
2. **Average Load** (4m) - Normal traffic pattern
3. **Stress** (3.5m) - Push to 200 VUs
4. **Spike** (1.5m) - Sudden burst to 300 VUs

## Request Mix

| Request Type | Percentage |
|--------------|------------|
| Basic Search | 60% |
| Filtered Search | 20% |
| Facets | 15% |
| Pagination Flow | 5% |

## Expected Results (2M Records)

With 2 million records on decent hardware:

| Metric | Expected |
|--------|----------|
| P50 Latency | 50-100ms |
| P95 Latency | 150-300ms |
| P99 Latency | 300-500ms |
| Throughput | 500-1000 RPS |

## Troubleshooting

### High Error Rates

1. Check if API is running: `curl http://localhost:3000/api/v1/health`
2. Check database connections
3. Check OpenSearch health
4. Review rate limiting settings

### High Latency

1. Check OpenSearch cluster health
2. Verify Redis cache is working
3. Check for slow Postgres queries
4. Review index optimization
