# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the Bosta Search API.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    32GB RAM Allocation                       │
├─────────────────────────────────────────────────────────────┤
│  OpenSearch (3 × 4GB)     │████████████████│ 15GB           │
│  PostgreSQL               │████████        │  4GB           │
│  Redis                    │██              │  1GB           │
│  API Pods (3-15)          │████            │ 1.5-7.5GB      │
│  K8s/System               │████████        │  4GB           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Kubernetes Cluster** (1.24+)
2. **kubectl** configured
3. **OpenSearch Operator** (for OpenSearch CRD):
   ```bash
   helm repo add opensearch-operator https://opensearch-project.github.io/opensearch-k8s-operator/
   helm install opensearch-operator opensearch-operator/opensearch-operator \
     --namespace opensearch-operator-system \
     --create-namespace
   ```

4. **Storage Class** with dynamic provisioning

## Quick Start

### 1. Update Secrets

Edit `secret.yaml` and set your actual passwords:
```yaml
stringData:
  POSTGRES_PASSWORD: "your-actual-secure-password"
  DATABASE_URL: "postgresql://postgres:your-actual-secure-password@postgres-service:5432/product_catalog"
```

### 2. Build and Push Docker Image

```bash
# Build the image
docker build -t bosta/search-api:latest .

# Push to your registry
docker tag bosta/search-api:latest your-registry/search-api:latest
docker push your-registry/search-api:latest
```

### 3. Deploy

```bash
# Using Kustomize (recommended)
kubectl apply -k k8s/

# Or apply individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/opensearch.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
```

### 4. Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n bosta-search

# Check services
kubectl get svc -n bosta-search

# Check HPA status
kubectl get hpa -n bosta-search

# Check OpenSearch cluster (if using operator)
kubectl get opensearchcluster -n bosta-search
```

### 5. Run Database Migrations

```bash
# Get a pod name
POD=$(kubectl get pod -n bosta-search -l app=search-api -o jsonpath='{.items[0].metadata.name}')

# Run migrations
kubectl exec -n bosta-search $POD -- bunx prisma migrate deploy
```

### 6. Create OpenSearch Index

```bash
# Port forward to OpenSearch
kubectl port-forward -n bosta-search svc/opensearch 9200:9200

# Create index (in another terminal)
curl -X PUT "http://localhost:9200/variants" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 6,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  },
  "mappings": {
    "properties": {
      "productId": { "type": "keyword" },
      "variantId": { "type": "keyword" },
      "categoryId": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "description": { "type": "text", "analyzer": "standard" },
      "attributes": { "type": "object", "enabled": true },
      "attrs_flat": { "type": "keyword" },
      "price": { "type": "float" },
      "currency": { "type": "keyword" },
      "inStock": { "type": "boolean" },
      "supplierId": { "type": "keyword" },
      "supplierName": { "type": "keyword" },
      "sales30d": { "type": "integer" },
      "createdAt": { "type": "date" },
      "updatedAt": { "type": "date" }
    }
  }
}'
```

## Scaling

### Manual Scaling

```bash
# Scale API pods
kubectl scale deployment search-api --replicas=10 -n bosta-search

# Scale OpenSearch (update the CRD)
kubectl patch opensearchcluster bosta-opensearch -n bosta-search \
  --type=merge -p '{"spec":{"nodePools":[{"component":"nodes","replicas":5}]}}'
```

### HPA (Automatic)

The HPA automatically scales API pods between 3-15 based on CPU/memory:
- Scale up: When CPU > 70% or memory > 80%
- Scale down: After 5 minutes of low utilization

## Monitoring

### Check Logs

```bash
# API logs
kubectl logs -f -n bosta-search -l app=search-api

# OpenSearch logs
kubectl logs -f -n bosta-search -l opster.io/opensearch-cluster=bosta-opensearch

# PostgreSQL logs
kubectl logs -f -n bosta-search -l app=postgres
```

### Port Forward for Debugging

```bash
# API
kubectl port-forward -n bosta-search svc/search-api-service 3000:80

# OpenSearch
kubectl port-forward -n bosta-search svc/opensearch 9200:9200

# PostgreSQL
kubectl port-forward -n bosta-search svc/postgres-service 5432:5432

# Redis
kubectl port-forward -n bosta-search svc/redis-service 6379:6379
```

## Capacity

| Metric | Value |
|--------|-------|
| Total RAM | 32GB |
| OpenSearch | 3 nodes × 4GB = 12GB |
| PostgreSQL | 4GB |
| Redis | 1GB |
| API (3-15 pods) | 1.5-7.5GB |
| Supported Records | 50M variants |
| Supported MAU | 10M users |
| Peak RPS | ~156 req/s |
| With Cache | ~400 req/s |

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n bosta-search
kubectl logs <pod-name> -n bosta-search
```

### OpenSearch cluster issues
```bash
# Check cluster health
kubectl exec -n bosta-search opensearch-0 -- curl -s localhost:9200/_cluster/health?pretty

# Check node status
kubectl exec -n bosta-search opensearch-0 -- curl -s localhost:9200/_cat/nodes?v
```

### Database connection issues
```bash
# Test PostgreSQL connection
kubectl exec -n bosta-search postgres-0 -- pg_isready -U postgres

# Test Redis connection
kubectl exec -n bosta-search redis-0 -- redis-cli ping
```
