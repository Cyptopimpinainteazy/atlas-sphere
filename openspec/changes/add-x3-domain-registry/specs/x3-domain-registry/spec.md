## ADDED Requirements

### Requirement: On-chain `.x3` Domain Registry
The system MUST provide an on-chain registry for domain ownership and DNS record sets, and it MUST be the canonical source of truth for `.x3` domains used by Atlas Sphere official services.

#### Scenario: Register `.x3` domain succeeds
- **GIVEN** a domain name ending in `.x3`
- **WHEN** the domain is registered through the on-chain registry
- **THEN** the registry stores the domain ownership and emits an event.

#### Scenario: Register non-`.x3` domain fails
- **GIVEN** a domain name not ending in `.x3`
- **WHEN** the domain is registered through the on-chain registry
- **THEN** the call MUST fail and no state MUST be written.

### Requirement: `.x3` Enforcement for Record Updates
The system MUST reject any attempt to create or update DNS records for non-`.x3` domains.

#### Scenario: Update record for `.x3` succeeds
- **GIVEN** an existing `.x3` domain
- **WHEN** an authorized actor updates its DNS record set
- **THEN** the record set is updated and an event is emitted.

#### Scenario: Update record for non-`.x3` fails
- **GIVEN** a domain name not ending in `.x3`
- **WHEN** an update is attempted
- **THEN** the call MUST fail.

### Requirement: DNS Server MUST Serve `.x3` Only
The Atlas DNS server MUST serve `.x3` zones only and MUST reject queries outside `.x3`.

#### Scenario: Query outside `.x3` rejected
- **WHEN** a DNS query is received for a name not under `.x3`
- **THEN** the server MUST reject the query.

### Requirement: Public Endpoint Configuration MUST Use `.x3`
Official/public deployments MUST configure externally-advertised endpoints under `.x3` (e.g. `rpc.*.x3`, `bootnode.*.x3`, `faucet.*.x3`, `metrics.*.x3`).

#### Scenario: Deployment validation fails on non-`.x3` endpoints
- **GIVEN** a deployment configuration that declares a public endpoint not ending in `.x3`
- **WHEN** the validation tool runs
- **THEN** it MUST fail with a clear error message indicating the offending endpoint.
