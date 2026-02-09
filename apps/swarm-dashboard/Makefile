.PHONY: help install build dev test lint format clean docker docker-build docker-push deploy

# Variables
APP_NAME := swarm-dashboard
DOCKER_REGISTRY := ghcr.io
DOCKER_IMAGE := $(DOCKER_REGISTRY)/atlas-sphere/$(APP_NAME)
VERSION := $(shell jq -r '.version' package.json)

help:
	@echo "GPU Swarm Dashboard - Makefile Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install dependencies"
	@echo "  make dev              - Start development server"
	@echo "  make build            - Build for production"
	@echo ""
	@echo "Testing:"
	@echo "  make test             - Run unit tests"
	@echo "  make test-watch       - Run tests in watch mode"
	@echo "  make test-coverage    - Generate coverage report"
	@echo "  make e2e              - Run E2E tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint             - Run ESLint"
	@echo "  make type-check       - Run TypeScript type checking"
	@echo "  make format           - Format code with Prettier"
	@echo "  make format-check     - Check code formatting"
	@echo ""
	@echo "Docker:"
	@echo "  make docker           - Build Docker image"
	@echo "  make docker-push      - Push to registry"
	@echo "  make docker-compose   - Run with Docker Compose"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-staging   - Deploy to staging"
	@echo "  make deploy-prod      - Deploy to production"
	@echo "  make deploy-k8s       - Deploy to Kubernetes"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean            - Remove build artifacts"
	@echo "  make audit            - Security audit"
	@echo "  make update           - Update dependencies"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

test:
	npm test

test-watch:
	npm test -- --watch

test-coverage:
	npm test -- --coverage
	@echo "Coverage report: coverage/lcov-report/index.html"

e2e:
	npm run e2e

lint:
	npx eslint src --ext .ts,.tsx

type-check:
	npx tsc --noEmit

format:
	npx prettier --write src

format-check:
	npx prettier --check src

clean:
	rm -rf dist coverage node_modules .vite

docker:
	docker build -t $(DOCKER_IMAGE):$(VERSION) \
	            -t $(DOCKER_IMAGE):latest \
	            .

docker-build:
	docker buildx build --platform linux/amd64,linux/arm64 \
	                     -t $(DOCKER_IMAGE):$(VERSION) \
	                     -t $(DOCKER_IMAGE):latest \
	                     .

docker-push: docker-build
	docker push $(DOCKER_IMAGE):$(VERSION)
	docker push $(DOCKER_IMAGE):latest

docker-compose:
	docker-compose up -d

docker-compose-down:
	docker-compose down

docker-compose-logs:
	docker-compose logs -f dashboard

audit:
	npm audit

audit-fix:
	npm audit fix

update:
	npm update

preview: build
	npm run preview

analyze:
	npm run build -- --stats

check: lint type-check test format-check
	@echo "✅ All checks passed!"

deploy-staging: build docker
	@echo "Deploying to staging..."
	docker tag $(DOCKER_IMAGE):latest $(DOCKER_IMAGE):staging
	docker push $(DOCKER_IMAGE):staging
	@echo "✅ Deployed to staging"

deploy-prod: build docker
	@echo "Deploying to production..."
	docker tag $(DOCKER_IMAGE):latest $(DOCKER_IMAGE):$(VERSION)
	docker push $(DOCKER_IMAGE):$(VERSION)
	docker push $(DOCKER_IMAGE):latest
	@echo "✅ Deployed to production (v$(VERSION))"

deploy-k8s: docker
	@echo "Deploying to Kubernetes..."
	kubectl apply -f kubernetes-manifest.yml
	kubectl set image deployment/gpu-swarm-dashboard \
	  dashboard=$(DOCKER_IMAGE):$(VERSION) \
	  -n gpu-swarm
	kubectl rollout status deployment/gpu-swarm-dashboard -n gpu-swarm
	@echo "✅ Kubernetes deployment complete"

k8s-logs:
	kubectl logs -f deployment/gpu-swarm-dashboard -n gpu-swarm

k8s-status:
	kubectl get pods -l app=dashboard -n gpu-swarm
	kubectl describe deployment gpu-swarm-dashboard -n gpu-swarm

lighthouse:
	npm run build
	npm run preview &
	sleep 5
	lighthouse http://localhost:4173 --view
	killall node

bundle-analyze:
	npm run build -- --stats > stats.json
	npx rollup-plugin-visualizer stats.json -o bundle-analysis.html
	@echo "Bundle analysis: bundle-analysis.html"

# Pre-commit hook
pre-commit: lint type-check format
	@echo "✅ Pre-commit checks passed!"

# Development server with all services
dev-full: docker-compose-down docker-compose
	@echo "🚀 Development environment ready!"
	@echo "Dashboard: http://localhost:3000"
	@echo "API Mock: http://localhost:5000"
	@echo "PostgreSQL: localhost:5432"

# Clean everything
clean-all: clean docker-compose-down
	docker system prune -f
	rm -rf .env.local
	@echo "✅ Full cleanup complete"
