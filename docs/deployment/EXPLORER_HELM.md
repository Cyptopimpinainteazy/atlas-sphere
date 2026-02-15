# Deploy Explorer (in‑house / Kubernetes + Helm)

Quick step‑by‑step to deploy the `apps/explorer` frontend to your on‑prem / in‑house Kubernetes cluster using the Helm chart bundled in this repo.

Prerequisites
- kubectl configured for target cluster (context set to `atlas-testnet` or equivalent)
- helm >= 3.8 installed
- Docker credentials (or internal registry) accessible from CI / runners
- TLS secret `explorer-tls-cert` created in `atlas-sphere` namespace (cert-manager will create it automatically when using Let's Encrypt)

Build & push image (example)
1. Build locally (CI will do this automatically):

   docker build -f deployment/docker/Dockerfile.explorer -t ghcr.io/<ORG>/atlas-sphere-explorer:<SHA> ./apps/explorer
   docker push ghcr.io/<ORG>/atlas-sphere-explorer:<SHA>

Helm deploy (manual)
1. Install / upgrade from repo chart (overrides image tag):

   helm upgrade --install explorer deployment/helm/explorer \
     --namespace atlas-sphere --create-namespace \
     --set image.repository=ghcr.io/<ORG>/atlas-sphere-explorer \
     --set image.tag=<SHA> \
     --wait --timeout 120s

2. Verify:

   kubectl get pods -n atlas-sphere -l app=explorer
   kubectl describe svc explorer -n atlas-sphere
   kubectl get ingress -n atlas-sphere
   curl -f https://explorer.testnet.atlas-sphere.io/ || echo "unreachable"

Rollbacks & updates
- Roll back to previous release:
  helm rollback explorer 1 -n atlas-sphere
- Update values (example change replica count):
  helm upgrade explorer deployment/helm/explorer --set replicaCount=3 -n atlas-sphere

Autoscaling (HPA)
- Enable autoscaling using the chart values or overrides:
  helm upgrade --install explorer deployment/helm/explorer \
    --namespace atlas-sphere --set autoscaling.enabled=true \
    --set autoscaling.minReplicas=2 --set autoscaling.maxReplicas=6 \
    --set autoscaling.targetCPUUtilizationPercentage=70

Canary / rollout example
- Quick canary using a separate release & host (manual approach):
  helm upgrade --install explorer-canary deployment/helm/explorer \
    --namespace atlas-sphere --create-namespace \
    --set image.tag=<CANARY_SHA> \
    --set replicaCount=1 \
    --set ingress.host=canary.explorer.testnet.atlas-sphere.io

  Verify the canary pod and check behaviour; when ready promote by updating the main release image tag.

Health-check & graceful shutdown
- Chart exposes `healthPath` (default `/`) and `lifecycle.preStopSleepSeconds`.
- To use a custom health endpoint:
  helm upgrade explorer deployment/helm/explorer --set healthPath=/api/health -n atlas-sphere
- Graceful termination is controlled by `lifecycle.preStopSleepSeconds` (default 10s).

Notes
- Chart path: `deployment/helm/explorer/` (default and env-specific values available)
- TLS secret name expected by chart: `explorer-tls-cert` (adjust `values.yaml` if different)
- CI updates image tag automatically and runs `helm upgrade --install explorer` when pushing to `main` (see `.github/workflows/production-deploy.yml`).

Troubleshooting
- If ingress TLS not issued check cert-manager logs and `Certificate`/`Ingress` events.
- For fast local testing you can use `kubectl port-forward svc/explorer 3000:3000 -n atlas-sphere` and visit http://localhost:3000

Contact
- DevOps / infra: devops@atlas-sphere.io
