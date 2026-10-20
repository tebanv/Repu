---
name: opencode
description: Execute OpenCode CLI tasks in WSL environment with project documentation context
---

# OpenCode Integration Skill

When the user requests complex code analysis, refactoring, or execution using OpenCode:

1. Execute commands via WSL using: `wsl opencode <args>`
2. Ensure OpenCode runs from the root directory so it automatically indexes `./docs/` and `AGENTS.md`.
3. Pass prompt parameters using `wsl opencode run "<prompt>"` or interactive execution flags.
