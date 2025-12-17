# Delta Specifications for Testnet Deployment Capability

## ADDED Requirements

### Requirement: Testnet Infrastructure Preparation
The Atlas Sphere testnet deployment system MUST provide comprehensive infrastructure preparation capabilities including hardware specifications, network configuration, and security setup.

#### Scenario: Hardware specification validation
- **GIVEN** validator deployment requirements
- **WHEN** hardware specifications are defined
- **THEN** system MUST validate minimum requirements: 4GB RAM, 2 vCPU, 50GB SSD for validators; 8GB RAM, 4 vCPU, 100GB SSD for RPC nodes

#### Scenario: Network configuration validation
- **GIVEN** testnet network setup
- **WHEN** network ports are configured
- **THEN** system MUST verify firewall rules for ports 30333 (P2P), 9944 (RPC), 9615 (Metrics), 22 (SSH)

#### Scenario: DNS domain configuration
- **GIVEN** Atlas DNS server integration
- **WHEN** testnet domains are configured
- **THEN** system MUST validate DNS records for rpc.testnet.x3, bootnode.testnet.x3, faucet.testnet.x3, metrics.testnet.x3

### Requirement: Validator Node Deployment
The testnet system MUST provide automated deployment procedures for validator nodes including key generation, chain specification, and service configuration.

#### Scenario: Bootnode deployment
- **GIVEN** Atlas Sphere binary and chain specification
- **WHEN** bootnode is deployed
- **THEN** system MUST generate node key, create systemd service, start service, and verify listening on port 30333

#### Scenario: Validator deployment
- **GIVEN** validator nodes and bootnode availability
- **WHEN** validators are deployed
- **THEN** system MUST generate Aura and GRANDPA keys, insert keys via RPC, verify key loading, and confirm node syncing

#### Scenario: Key management validation
- **GIVEN** validator key generation
- **WHEN** keys are inserted into nodes
- **THEN** system MUST validate key insertion via `author_insertKey` RPC and verify "Loaded authority keys" in logs

### Requirement: RPC Node and Load Balancer Setup
The testnet system MUST provide RPC node deployment with load balancing, health checks, and rate limiting capabilities.

#### Scenario: RPC node deployment
- **GIVEN** RPC node configuration
- **WHEN** RPC nodes are deployed
- **THEN** system MUST configure external RPC access, Safe RPC methods, verify syncing, and confirm external accessibility

#### Scenario: Load balancer configuration
- **GIVEN** multiple RPC nodes
- **WHEN** load balancer is configured
- **THEN** system MUST set up health checks, rate limiting (1000 req/min per IP), CORS for web apps, and verify failover

#### Scenario: RPC health validation
- **GIVEN** deployed RPC nodes
- **WHEN** health checks are performed
- **THEN** system MUST verify `system_health` endpoint returns healthy status and RPC responses are under 200ms

### Requirement: Monitoring and Telemetry System
The testnet system MUST provide comprehensive monitoring including Prometheus metrics, Grafana dashboards, and alerting capabilities.

#### Scenario: Prometheus setup
- **GIVEN** monitoring server
- **WHEN** Prometheus is configured
- **THEN** system MUST scrape all validator and RPC nodes on port 9615 and provide metrics at `/metrics` endpoint

#### Scenario: Grafana dashboard configuration
- **GIVEN** Prometheus data source
- **WHEN** Grafana is set up
- **THEN** system MUST display block production, validator uptime, peer count, memory usage, and custom Atlas Kernel metrics

#### Scenario: Alert configuration
- **GIVEN** monitoring system
- **WHEN** alerts are configured
- **THEN** system MUST trigger alerts for node down, high memory (>80%), high disk (>70%), slow blocks (>10s), low peers (<3)

### Requirement: Faucet Service Integration
The testnet system MUST provide a secure faucet service with rate limiting, captcha protection, and monitoring capabilities.

#### Scenario: Faucet deployment
- **GIVEN** faucet service configuration
- **WHEN** faucet is deployed
- **THEN** system MUST configure 100 tATLAS per request, 1 req/24h per address, captcha protection, and webhook monitoring

#### Scenario: Faucet security validation
- **GIVEN** deployed faucet service
- **WHEN** security measures are tested
- **THEN** system MUST verify rate limiting prevents abuse, captcha blocks bots, and transaction monitoring detects anomalies

### Requirement: Health Check Automation
The testnet system MUST provide automated health checks for all network components with escalation procedures.

#### Scenario: Comprehensive health checks
- **GIVEN** deployed testnet infrastructure
- **WHEN** health checks are executed
- **THEN** system MUST verify block production (~6s), finalization (<30s), peer count (5+), and no validator equivocation

#### Scenario: Automated monitoring scripts
- **GIVEN** health check requirements
- **WHEN** scripts are executed
- **THEN** system MUST run `system_health`, `chain_getBlock`, finality checks, peer discovery validation, and Atlas Kernel RPC methods

### Requirement: Incident Response Procedures
The testnet system MUST provide structured incident response procedures for network halts, RPC failures, and security incidents.

#### Scenario: Network halt response
- **GIVEN** network halt (no new blocks)
- **WHEN** incident is detected
- **THEN** system MUST check all validators, verify GRANDPA finality, restart failed validators, and post status updates within 15 minutes

#### Scenario: RPC failure response
- **GIVEN** RPC node failure
- **WHEN** failure is detected
- **THEN** system MUST verify load balancer failover, check node status, restart services, check disk space, and provision emergency RPC if needed

#### Scenario: Security incident response
- **GIVEN** security incident (faucet exploit)
- **WHEN** incident is detected
- **THEN** system MUST pause service, review logs, identify exploit, patch code, deploy new instance, and conduct post-mortem

### Requirement: DNS Server Integration
The testnet system MUST integrate with the Atlas DNS server for domain configuration and management.

#### Scenario: DNS server configuration
- **GIVEN** Atlas DNS server deployment
- **WHEN** testnet domains are configured
- **THEN** system MUST add A records for rpc.testnet.x3, bootnode.testnet.x3, faucet.testnet.x3, metrics.testnet.x3 with proper TTL

#### Scenario: DNS propagation validation
- **GIVEN** DNS configuration
- **WHEN** propagation is tested
- **THEN** system MUST verify domain resolution across multiple DNS servers and confirm subdomains resolve correctly

### Requirement: GPU Swarm Integration
The testnet system MUST provide integration points for GPU swarm operations during testnet deployment.

#### Scenario: GPU swarm node integration
- **GIVEN** GPU swarm infrastructure
- **WHEN** testnet is deployed
- **THEN** system MUST coordinate GPU nodes with Atlas Sphere validators and provide swarm status monitoring

#### Scenario: Compute job coordination
- **GIVEN** testnet and GPU swarm running
- **WHEN** compute jobs are submitted
- **THEN** system MUST route jobs to appropriate GPU nodes and track job completion status

### Requirement: X3 Language Runtime Testing
The testnet system MUST provide X3 language runtime testing capabilities during deployment validation.

#### Scenario: X3 runtime validation
- **GIVEN** deployed testnet
- **WHEN** X3 runtime is tested
- **THEN** system MUST execute sample X3 scripts, verify bytecode compilation, test deterministic execution, and validate cross-VM integration

#### Scenario: X3 script deployment
- **GIVEN** X3 script examples
- **WHEN** scripts are deployed to testnet
- **THEN** system MUST compile and execute jit_lp.x3, mev_smooth.x3, flash.x3, arb.x3 examples successfully
