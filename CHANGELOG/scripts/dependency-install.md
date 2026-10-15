# Dependency installation

## 2026-10-15 — Restore the declared Motion lock graph
Maintainers could not install the committed dependency graph: `package.json`
already declared `motion` `^12.43.0`, but `yarn.lock` omitted its workspace mapping
and four package records. Regenerate those missing records with the repository's
pinned Yarn 4.3.1. All existing package records and dependency declarations stay
unchanged, and CI continues to require `yarn install --immutable`.

Before the repair, that exact install command exited 1 with `YN0028`; afterwards
it exited 0. Local lint, TypeScript, 306 application scenarios and 49 Convex
scenarios passed. The newly reached component-type check exposed a separate
declaration-order mismatch, documented in the query-style lane below. Existing
peer-dependency and lint warnings remain; fresh Ubuntu CI is required before
claiming the complete workflow passes.

**Commit**: `this commit`. **Author**: Codex.
**Touches**: `CHANGELOG/components/query-style-declarations.md`
