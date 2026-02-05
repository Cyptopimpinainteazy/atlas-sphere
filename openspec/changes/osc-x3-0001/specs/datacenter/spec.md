## ADDED Requirements

### Requirement: Rack layout & compute roles
The system SHALL document a two-rack deployment that houses validator nodes, SVM worker farm, RPC/indexer nodes, archive/storage servers, load balancers, and management gear according to the prescribed U-by-U layout so the datacenter team can order and rack the hardware without guesswork.

#### Scenario: Rack procurement kit
- **WHEN** procurement reviews the spec
- **THEN** they see the exact counts for validator/SVM/RPC/archive nodes (active + hot spares), top-of-rack and spine switches, storage shelves, firewall/load balancer pairs, jumpbox, monitoring server, and blanking/cable management spaces and can place quotes with vendors (Supermicro, Dell, etc.)

### Requirement: Power, cooling, and networking
The system SHALL size a 20 kW power budget across two 42U racks, describe the UPS/PDUs, CRAC or in-row cooling, leaf-spine fabric (2 × 100GbE spine, 2 × 48-port ToR), VLAN segmentation (management, consensus, RPC, storage, observability), redundant uplinks, and time sync so the operations team can coordinate facilities and ensure deterministic performance.

#### Scenario: Facility readiness
- **WHEN** the facility team provision power and cooling
- **THEN** they allocate dual PDUs, 20–25 kVA UPS with generator failover, chilled-water cooling for 20 kW heat, redundant network uplinks with QSFP+/DAC/optics, and VLANs for management, consensus, RPC, storage, and monitoring traffic

### Requirement: Monitoring, security, and operations hygiene
The system SHALL detail the monitoring/logging stack (Prometheus/Grafana/Loki or ELK), jumpbox policies, bastion access with MFA and hardware keys, backup cadence, DR/playbooks, and compliance requirements (camera logs, HSM custody) so the self-hosted deployment remains trustworthy.

#### Scenario: Operational hardening
- **WHEN** the runbook is executed during deployment
- **THEN** teams follow the spec to enable firewall segmentation, vault secrets in HSM, rotate keys, ship immutable logs to remote storage, test failover scenarios, enforce IaC updates, and tie the datacenter into the overall governance plan
