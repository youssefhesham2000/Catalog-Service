/**
 * K6 Load Test for Bosta Product Catalog Search API
 *
 * Run:
 *   k6 run k6/load-test.js
 *
 * With options:
 *   k6 run --vus 50 --duration 2m k6/load-test.js
 *
 * With HTML report:
 *   k6 run --out json=results.json k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const searchLatency = new Trend('search_latency', true);
const facetsLatency = new Trend('facets_latency', true);
const searchErrors = new Counter('search_errors');
const facetsErrors = new Counter('facets_errors');
const cacheHitRate = new Rate('cache_hit_rate');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
const NO_CACHE = __ENV.NO_CACHE !== '0'; // Default to NO_CACHE=true for accurate load testing

// Price ranges for cache bypass (still return results)
const PRICE_RANGES = [
  { min: 0, max: 50 },
  { min: 50, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: 500 },
  { min: 500, max: 1000 },
  { min: 0, max: 100 },
  { min: 100, max: 500 },
  { min: 0, max: 200 },
  { min: 50, max: 500 },
  { min: 0, max: 1000 },
];

// Test data pools
const SEARCH_QUERIES = [
  'shirt', 'jeans', 'sneakers', 'headphones', 'watch',
  'jacket', 'boots', 'backpack', 'sunglasses', 'hoodie',
  'red shirt', 'blue jeans', 'black sneakers', 'wireless headphones',
  'cotton', 'leather', 'premium', 'classic', 'modern',
  'nike', 'adidas', 'puma', 'reebok', 'fashion',
];

const COLORS = ['Red', 'Blue', 'Green', 'Black', 'White', 'Gray', 'Navy', 'Pink'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL', '9', '10', '11', '32', '34'];
const BRANDS = ['Nike', 'Adidas', 'Puma', 'StyleBasics', 'Premium Picks', 'Urban Edge'];

const FACET_KEYS = [
  'brand',
  'attributes.color',
  'attributes.size',
  'attributes.material',
  'categoryName',
  'priceFrom',
];

// Scenario definitions
const ALL_SCENARIOS = {
  // Scenario 1: Smoke test - verify system works
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '10s',
    startTime: '0s',
    tags: { scenario: 'smoke' },
  },

  // Scenario 2: Average load - normal traffic
  average_load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },  // Ramp up
      { duration: '1m', target: 20 },   // Stay at 20
      { duration: '30s', target: 50 },  // Ramp up more
      { duration: '2m', target: 50 },   // Stay at 50
      { duration: '30s', target: 0 },   // Ramp down
    ],
    startTime: '0s',
    tags: { scenario: 'average_load' },
  },

  // Scenario 3: Stress test - push limits
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 100 },  // Ramp to 100
      { duration: '1m', target: 100 },   // Stay
      { duration: '30s', target: 300 },  // Push to 500
      { duration: '1m', target: 300 },   // Stay at peak
      { duration: '30s', target: 0 },    // Ramp down
    ],
    startTime: '0s',
    tags: { scenario: 'stress' },
  },

  // Scenario 4: Spike test - sudden traffic burst
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 10 },   // Normal
      { duration: '10s', target: 300 },  // Spike!
      { duration: '30s', target: 300 },  // Stay at spike
      { duration: '10s', target: 10 },   // Drop back
      { duration: '30s', target: 10 },   // Recovery
    ],
    startTime: '0s',
    tags: { scenario: 'spike' },
  },
};

// Select scenario(s) via SCENARIO env var: smoke, average_load, stress, spike, or all (default)
const SCENARIO = __ENV.SCENARIO || 'all';
const scenarios = SCENARIO === 'all' 
  ? ALL_SCENARIOS 
  : { [SCENARIO]: ALL_SCENARIOS[SCENARIO] };

// Load test configuration
export const options = {
  scenarios,

  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
    search_latency: ['p(95)<400', 'p(99)<800'],
    facets_latency: ['p(95)<300', 'p(99)<600'],

    // Error rate thresholds
    http_req_failed: ['rate<0.01'],  // Less than 1% errors
    search_errors: ['count<100'],
    facets_errors: ['count<50'],
  },
};

// Helper functions
function getRandomQuery() {
  return randomItem(SEARCH_QUERIES);
}

// Generate unique price range to bypass cache (different per VU + iteration)
function getUniquePriceRange(vu, iter) {
  const baseRange = PRICE_RANGES[Math.floor(Math.random() * PRICE_RANGES.length)];
  return {
    min: baseRange.min + (vu % 10),
    max: baseRange.max + (iter % 100),
  };
}

function getRandomFilters() {
  const filters = {};
  if (Math.random() > 0.5) {
    filters['attributes.color'] = randomItem(COLORS);
  }
  if (Math.random() > 0.7) {
    filters['attributes.size'] = randomItem(SIZES);
  }
  return filters;
}

function buildSearchUrl(query, filters = {}, limit = 20, cursor = null, priceRange = null) {
  let url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`;

  for (const [key, value] of Object.entries(filters)) {
    url += `&filters[${encodeURIComponent(key)}]=${encodeURIComponent(value)}`;
  }

  if (Math.random() > 0.7) {
    url += `&brand=${encodeURIComponent(randomItem(BRANDS))}`;
  }

  // Add unique price range to bypass cache
  if (priceRange) {
    url += `&priceRange[min]=${priceRange.min}&priceRange[max]=${priceRange.max}`;
  }

  if (cursor) {
    url += `&cursor=${encodeURIComponent(cursor)}`;
  }

  return url;
}

function buildFacetsUrl(query, facetKeys, vu = 0, iter = 0) {
  const keys = facetKeys.join(',');
  // For facets, we vary the query slightly to bypass cache (add unique suffix)
  const uniqueQuery = NO_CACHE ? `${query} ${vu}${iter}` : query;
  return `${BASE_URL}/search/facets?q=${encodeURIComponent(uniqueQuery)}&facetKeys=${encodeURIComponent(keys)}`;
}

// Main test function
export default function () {
  const correlationId = `k6-${__VU}-${__ITER}-${Date.now()}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Correlation-ID': correlationId,
  };

  // Mix of different request patterns
  const requestType = Math.random();

  if (requestType < 0.6) {
    // 60% - Basic search
    group('Basic Search', () => {
      const query = getRandomQuery();
      const priceRange = NO_CACHE ? getUniquePriceRange(__VU, __ITER) : null;
      const url = buildSearchUrl(query, {}, 20, null, priceRange);

      const start = Date.now();
      const res = http.get(url, { headers, tags: { type: 'search' } });
      const duration = Date.now() - start;

      searchLatency.add(duration);

      const success = check(res, {
        'search status is 200': (r) => r.status === 200,
        'search has data': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data !== undefined;
          } catch {
            return false;
          }
        },
        'search response time < 500ms': (r) => r.timings.duration < 500,
      });

      if (!success) {
        searchErrors.add(1);
      }

      // Check for cache indicator (fast response suggests cache hit)
      if (res.timings.duration < 50) {
        cacheHitRate.add(1);
      } else {
        cacheHitRate.add(0);
      }
    });

  } else if (requestType < 0.8) {
    // 20% - Search with filters
    group('Filtered Search', () => {
      const query = getRandomQuery();
      const filters = getRandomFilters();
      const priceRange = NO_CACHE ? getUniquePriceRange(__VU, __ITER) : null;
      const url = buildSearchUrl(query, filters, 20, null, priceRange);

      const start = Date.now();
      const res = http.get(url, { headers, tags: { type: 'filtered_search' } });
      const duration = Date.now() - start;

      searchLatency.add(duration);

      const success = check(res, {
        'filtered search status is 200': (r) => r.status === 200,
        'filtered search has results': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.meta && body.meta.pagination;
          } catch {
            return false;
          }
        },
      });

      if (!success) {
        searchErrors.add(1);
      }
    });

  } else if (requestType < 0.95) {
    // 15% - Facets request
    group('Facets', () => {
      const query = getRandomQuery();
      const numFacets = Math.floor(Math.random() * 3) + 2;  // 2-4 facets
      const facetKeys = FACET_KEYS.slice(0, numFacets);
      const url = buildFacetsUrl(query, facetKeys, __VU, __ITER);

      const start = Date.now();
      const res = http.get(url, { headers, tags: { type: 'facets' } });
      const duration = Date.now() - start;

      facetsLatency.add(duration);

      const success = check(res, {
        'facets status is 200': (r) => r.status === 200,
        'facets has buckets': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.data && body.data.length > 0;
          } catch {
            return false;
          }
        },
        'facets response time < 300ms': (r) => r.timings.duration < 300,
      });

      if (!success) {
        facetsErrors.add(1);
      }
    });

  } else {
    // 5% - Pagination flow (multi-page)
    group('Pagination Flow', () => {
      const query = getRandomQuery();
      const priceRange = NO_CACHE ? getUniquePriceRange(__VU, __ITER) : null;
      let cursor = null;
      let pages = 0;
      const maxPages = 3;

      while (pages < maxPages) {
        const url = buildSearchUrl(query, {}, 10, cursor, priceRange);
        const res = http.get(url, { headers, tags: { type: 'pagination' } });

        const success = check(res, {
          'pagination page status is 200': (r) => r.status === 200,
        });

        if (!success || res.status !== 200) {
          searchErrors.add(1);
          break;
        }

        try {
          const body = JSON.parse(res.body);
          cursor = body.meta?.pagination?.nextCursor;
          pages++;

          if (!cursor) break;  // No more pages
        } catch {
          break;
        }

        sleep(0.1);  // Small delay between pages
      }

      searchLatency.add(pages * 100);  // Approximate total time
    });
  }

  // Random sleep between requests (simulate user think time)
  sleep(Math.random() * 2 + 0.5);  // 0.5-2.5 seconds
}

// Setup function - runs once before test
export function setup() {
  console.log(`Load test starting against: ${BASE_URL}`);
  console.log(`Cache bypass: ${NO_CACHE ? 'ENABLED (unique queries)' : 'DISABLED (may hit cache)'}`);

  // Verify API is reachable with a simple search (use 'shirt' which has results)
  const testRes = http.get(`${BASE_URL}/search?q=shirt&limit=1`);
  if (testRes.status !== 200) {
    console.log(`Response body: ${testRes.body}`);
    throw new Error(`API check failed: ${testRes.status}`);
  }

  console.log('API check passed');
  return { startTime: Date.now() };
}

// Teardown function - runs once after test
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(1)} seconds`);
}
