## ADDED Requirements

### Requirement: Floating Neural Terminal
The Explorer UI SHALL provide a floating, compact Neural Terminal widget that is available across Explorer routes and supports command-driven navigation.

#### Scenario: Navigate by command
- **WHEN** a user enters `go /quantum`
- **THEN** the application navigates to `/quantum`.

#### Scenario: Help output
- **WHEN** a user enters `help`
- **THEN** the terminal prints a list of supported commands.

### Requirement: AI Q&A via OpenRouter
The system SHALL provide a Q&A feature that routes user questions through an internal API endpoint to OpenRouter.

#### Scenario: Ask a question
- **WHEN** a user enters `ask What is Atlas Sphere?`
- **THEN** the UI sends a request to `POST /api/ai/ask` and prints the returned answer.

#### Scenario: Missing API key
- **WHEN** `OPENROUTER_API_KEY` is not configured
- **THEN** `POST /api/ai/ask` returns an error response that the UI can display.

### Requirement: Safety boundaries
The Neural Terminal MUST NOT execute OS commands or access a user’s real terminal directly.

#### Scenario: Disallowed execution
- **WHEN** a user enters `run rm -rf /`
- **THEN** the terminal rejects the command and prints a safety message.
