---
"@ai-hero/sandcastle": patch
---

Add `copyFilesToSandbox` for staging explicit host files into bind-mount sandboxes before `onSandboxReady` hooks run. This supports credential/config flows such as using `pi()` with Codex auth inside Docker or Podman without mounting whole host config directories.
