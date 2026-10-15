# Query style declarations

## 2026-10-15 — Match the generated declaration order
The query-page declaration file listed `loadingIcon` before `liveStatus`.
The existing generator sorts these names and compares the complete output, so
this order caused the component-type CI gate to fail even with LF line endings.
Swap only those two declaration lines; their names, types, CSS and runtime
behavior stay unchanged.

An outside-source comparison found this single content mismatch before the
change and exact matches for all 52 generated declarations with LF afterwards.
The native Windows check still reports its platform's CRLF differences against
the committed LF files. Keep the check unchanged and require fresh Ubuntu CI;
the LF comparison does not certify the entire remote workflow.

**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/scripts/dependency-install.md`
