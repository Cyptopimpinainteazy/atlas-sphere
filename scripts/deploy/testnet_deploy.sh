#!/usr/bin/env bash
set -euo pipefail

CHART_DIR="$(dirname "$0")/../../charts/atlas-sphere"
NAMESPACE="testnet"
IMAGE_TAG="${1:-latest}"

helm upgrade --install atlas-sphere "$CHART_DIR" --namespace "$NAMESPACE" --create-namespace \
  --set image.repository="${DOCKER_REGISTRY:-ghcr.io/local}/atlas-sphere" \
  --set image.tag="$IMAGE_TAG" \
  --set postgres.url="${POSTGRES_URL:-}"

kubectl -n "$NAMESPACE" rollout status deployment/atlas-sphere --timeout=180s

# quick health check
kubectl -n "$NAMESPACE" wait --for=condition=available --timeout=60s deployment/atlas-sphere
kubectl -n "$NAMESPACE" port-forward svc/atlas-sphere 8080:80 &
sleep 3
curl -fsS -m 5 http://127.0.0.1:8080/ready || (echo "health check failed" && exit 2)

echo "Deployment OK"
