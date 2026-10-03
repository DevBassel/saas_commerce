---
description: Sync the Memory Bank with the current state of the work
---
Read ALL files in `memory-bank/` first.

Then update them to match reality, verified against the repo (diffs, new files, commands run):

- Rewrite `activeContext.md` to the present focus, recent changes, active decisions, and next steps.
  Rewrite it — never append. Remove items that are no longer current.
- Update `progress.md` with completed work, new "not wired" gaps, and resolved or new tech debt.
- Touch `systemPatterns.md`, `techContext.md`, or `productContext.md` only when a durable fact
  changed; otherwise leave them alone.
- If `projectbrief.md` changed, re-check the others for consistency.

Rules:
- Use only verified facts from the repository. Never include secrets or `.env` values.
- Link to `AGENTS.md` for durable rules instead of copying them.
- Do not modify application code.

Report which files changed and why.
