---
"@ai-hero/sandcastle": patch
---

fix: unescape `\n`, `\r`, `\t`, and `\\` in double-quoted `.env` values to match standard dotenv semantics
