---
"@ai-hero/sandcastle": patch
---

Fix Docker mount failures on Windows hosts by switching from `-v host:sandbox` to `--mount type=bind,source=...,target=...` format (avoiding colon ambiguity with drive letters), and adding missing `patchGitMountsForWindows` calls in `createSandbox` and `createSandboxFromWorktree` code paths.
