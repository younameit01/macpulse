# MacAI Storage Observatory

> **HackWesTX 2026 • macOS AI File System Metrics Challenge**  
> Local-first macOS storage observability system for administrators running AI workloads across multiple Macs.

## Project Structure

```
├── agent/       # macOS collectors, agent loop, config, elevated collector
├── backend/     # FastAPI coordinator, SQLite persistence, rule engine, Gemini Explain service
├── frontend/    # React admin dashboard (JavaScript)
├── scripts/     # Setup helpers, safe I/O workload generator, demo reset scripts
├── tests/       # Backend unit/parser tests and integration tests
├── docs/        # Architecture diagrams, specifications, notes
├── Makefile     # Unified build, run, test, and demo commands
└── .env.example # Environment variable template
```

## Quick Start

See `.env.example` to configure coordinator URL and optional Gemini API key.
