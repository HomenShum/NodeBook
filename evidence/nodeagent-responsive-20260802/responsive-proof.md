# NodeBook anonymous responsive proof

Date: 2026-08-02

Deployment: `dpl_BQBAQQRfQ2L5kZ4zVwRb15rgpT7F` (`READY`, production)

## Scenario

A fresh anonymous visitor opened the production landing page, chose **Continue as guest**, and reached the original graph-native Global Hub notebook shell. The first run exposed two protected canonical-cache requests returning 401. Root cause: the local-only guest persona still invoked the signed Axios cache resource. The client boundary now returns local empty-cache receipts whenever a guest session is active or no bearer token exists; the protected server route remains unchanged.

The scenario was repeated in a fresh tab after deployment. The notebook loaded with zero console errors and zero warnings.

## Responsive evidence

Each viewport was held fixed until DOM geometry, console state, and pixels were captured:

- Desktop: 1249×1381 — `guest-desktop-dom.md`, `guest-desktop.png`.
- Tablet: 768×1024 — `guest-tablet-dom.md`, `guest-tablet.png`; document/body width 768, no horizontal overflow.
- Phone: 390×844 — `guest-phone-dom.md`, `guest-phone.png`; document/body width 390, no horizontal overflow.

Visual judgment: all three retain the original notebook chrome, breadcrumb, search/filter/display controls, graph/list content, and sign-in affordance. The long internal `__global_relation_types__` system label wraps on phone but remains readable and unclipped.

## Honest limitation

These are rendered stills and DOM captures of the anonymous notebook path, not the requested signed NodeAgent end-to-end video clips. The dedicated Chrome session is waiting for a human Google sign-in before the signed trace, two-tab checkpoint race, populated NodeAgent responsive state, and final clips can be recorded.
