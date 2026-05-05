---
"@ai-hero/sandcastle": patch
---

Add `copyFilesToSandbox` for staging explicit host files into bind-mount sandboxes before `onSandboxReady` hooks run. This supports credential/config flows such as using `pi()` with Codex auth inside Docker or Podman without mounting whole host config directories.

Fix package `build`/`typecheck` failures when the optional `@daytona/sdk` peer dependency is not installed by removing Sandcastle's hard type-level dependency on the Daytona SDK.

Fix packed releases missing scaffold templates by making `build` copy `src/templates` into `dist/templates` directly and making `npm pack` run a fresh build first.

Pin the Pi scaffold image to `@mariozechner/pi-coding-agent@0.73.0` so generated Docker/Podman sandboxes avoid the 0.72.1 `openai-codex` print/json hang.
