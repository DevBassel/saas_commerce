---
description: Bootstrap or refresh the Memory Bank by analyzing the repository
---
Create or refresh the Memory Bank in `memory-bank/`.

Read the root `AGENTS.md` and every app-level `AGENTS.md` first, then analyze `package.json`,
`turbo.json`, `pnpm-workspace.yaml`, `compose.yaml`, `project-description.md`, `RAILWAY.md`, and
representative source files. Populate these six files from real evidence only:

- `projectbrief.md` — purpose, apps, core features, scope boundaries, source-of-truth links
- `productContext.md` — why it exists, users and their surfaces, domain mental model, UX goals, non-goals
- `systemPatterns.md` — architecture diagram, key decisions with rationale, cross-cutting contracts, quirks
- `techContext.md` — stack, workspace layout, commands, database, env files, Docker, tooling notes
- `activeContext.md` — current focus, recent changes, active decisions, open questions, next steps
- `progress.md` — what works, what is left/not wired, known issues and tech debt, verification commands

Rules:
- Cite paths as `path:line`. Mark unknowns as "unknown" instead of inventing.
- Summarize and link to `AGENTS.md` sections; do not duplicate durable rules (avoids drift).
- Never include secrets, tokens, credentials, or `.env` values.
- Add or remove custom bank files only when a real need appears; keep the six core files.
- Do not modify application code.

Report each file created or changed and the evidence behind it.
