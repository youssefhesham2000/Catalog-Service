/**
 * Application configuration factory
 * Centralizes all environment variable access and provides typed configuration
 */
export default () => ({
  /**
   * Application settings
   */
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api',
    apiVersion: process.env.API_VERSION || 'v1',
  },

  /**
   * PostgreSQL database configuration
   */
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/product_catalog',
  },

  /**
   * OpenSearch configuration
   */
  opensearch: {
    node: process.env.OPENSEARCH_NODE || 'http://localhost:9200',
    indexVariants: process.env.OPENSEARCH_INDEX_VARIANTS || 'variants',
  },

  /**
   * Redis cache configuration
   */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  /**
   * Rate limiting configuration
   */
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  /**
   * Cache TTL configuration (in seconds)
   */
  cache: {
    searchTtl: parseInt(process.env.CACHE_TTL_SEARCH || '300', 10),
    facetsTtl: parseInt(process.env.CACHE_TTL_FACETS || '600', 10),
  },

  /**
   * Logging configuration
   */
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
    file: process.env.LOG_FILE || './logs/app.log',
  },

  /**
   * Search configuration
   */
  search: {
    maxPageSize: parseInt(process.env.SEARCH_MAX_PAGE_SIZE || '100', 10),
    defaultPageSize: parseInt(process.env.SEARCH_DEFAULT_PAGE_SIZE || '20', 10),
    salesBoostFactor: parseFloat(process.env.SEARCH_SALES_BOOST_FACTOR || '1.2'),
    salesBoostModifier: process.env.SEARCH_SALES_BOOST_MODIFIER || 'log1p',
  },

  /**
   * Timeout and circuit breaker configuration (in milliseconds)
   */
  timeouts: {
    // Global HTTP request timeout (safety net, should be higher than individual timeouts)
    request: parseInt(process.env.TIMEOUT_REQUEST || '60000', 10),
    // OpenSearch circuit breaker timeout (Opossum handles this)
    opensearch: parseInt(process.env.TIMEOUT_OPENSEARCH || '15000', 10),
    // OpenSearch connection timeout (initial connection only)
    opensearchConnection: parseInt(process.env.TIMEOUT_OPENSEARCH_CONNECTION || '5000', 10),
    // Database query timeout
    database: parseInt(process.env.TIMEOUT_DATABASE || '10000', 10),
  },

  /**
   * Circuit breaker configuration
   */
  circuitBreaker: {
    // Error percentage to trip the circuit
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_ERROR_THRESHOLD || '50', 10),
    // Time to wait before testing if service recovered (ms)
    resetTimeout: parseInt(process.env.CIRCUIT_RESET_TIMEOUT || '30000', 10),
    // Minimum requests before circuit can trip
    volumeThreshold: parseInt(process.env.CIRCUIT_VOLUME_THRESHOLD || '5', 10),
  },
});
