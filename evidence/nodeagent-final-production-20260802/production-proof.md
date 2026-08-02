# NodeBook final production evidence set

Date: 2026-08-02

## Current production

- Alias: `https://nodebook-rho.vercel.app`
- Deployment: `dpl_5pTRmwGidmHspgDGxW5ku6QWCBUW` (`Ready`)
- Code commit: `cd533b73`
- Raw live HTML: HTTP 200, contains `NodeBook`, contains neither active `Mew` nor `Ideaflow` product copy.

## Signed desktop observation

The preserved owner session loaded the original notebook shell and opened the integrated NodeAgent sidebar at 1249 x 1403. The document width equaled the viewport width (no horizontal overflow), the NodeAgent surface appeared exactly once, the locked runtime verifier showed 6/6 passed, and no visible application error alert was present.

Observed states:

1. `signed-desktop-integrated.png` - Ask empty state inside the notebook.
2. `signed-desktop-auto.png` - default checkpointed Auto copy: reversible changes execute after a durable checkpoint and high-risk work pauses.
3. `signed-desktop-plan.png` - optional preview-only Plan copy.
4. `signed-desktop-mode-sequence.mp4` - six-second frame-sequence evidence clip composed from those three exact signed production screenshots.

The Chrome connector did not expose continuous screen recording or console export. The MP4 is therefore explicitly a frame-sequence evidence clip, not a continuous interaction recording. The final retained browser tab was left in Auto mode for user testing.

## Responsive references

- `responsive-viewport-sequence.mp4` sequences the already certified guest desktop, tablet, and phone viewport frames from `evidence/nodeagent-responsive-20260802`.
- `mobile-agent-sequence.mp4` sequences the certified 390 x 844 opaque mobile agent and runtime-verification frames from `evidence/nodeagent-live-eval-ui-20260802`.

These responsive clips preserve the latest certified viewport evidence but were not recaptured from deployment `dpl_5pTRmwGidmHspgDGxW5ku6QWCBUW`; the current deployment changed the NotebookTools backend/UI orchestration boundary rather than responsive CSS. A fresh continuous signed tablet/phone recording remains a separate physical/browser-capture proof requirement.

## Regression gates

- Jest: 55 suites, 281 tests passed.
- Convex production-shaped tests: 49 passed.
- Changed-file lint: passed.
- TypeScript: passed.
- Local production build: passed with non-secret process-level validation values.
- Vercel production build: passed and deployment reached Ready.
