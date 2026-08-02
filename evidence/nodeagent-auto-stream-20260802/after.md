# NodeAgent safe Auto streaming proof

Date: 2026-08-02

## Named proof

A signed production Agent/Auto run must create exactly one reversible child through the streaming route, leave a durable applied receipt, expose whole-run Undo, remove the exact graph identity, and recover the undone receipt after reload.

## Environment and input

- Production: `https://nodebook-rho.vercel.app`
- Session: `NodeBook safe Auto streaming proof`
- Viewport: 2560 × 1375, existing signed-in owner session
- Query: create exactly one child titled `NodeAgent Auto Stream Proof 2026-08-02` with a disposable proof body; do not modify, move, relate, clone, or delete existing nodes
- Starting graph match count: zero

## Observed lifecycle

1. The UI used Agent mode with Auto selected and the documented checkpointed execution boundary.
2. The run traversed the production SSE query route and produced one `create_node` operation.
3. Durable run `f8ff6303-530a-46c2-af56-24525d586b5d` reached `Checkpoint: applied` and exposed `Undo this run`.
4. The graph displayed the requested title/body as node identity `5539f98e`; `applied.png` captures the created work product and receipt surface together.
5. Clicking Undo changed the durable state to `Checkpoint: undone`; `undone.png` captures the graph after removal.
6. Before reload, `[data-nodeid="5539f98e"]` was absent.
7. After hard reload, reopening AI on proposal `1fcda85b-78bd-43c8-a050-4a954b1d8f5e` recovered `Checkpoint: undone`, retained the durable receipt, and still had no `[data-nodeid="5539f98e"]`.
8. Application console error count was zero after recovery.

## Executable regression replay

- `checkpointExecution.test.ts`, `agentStreamProtocol.test.ts`, and `soleEngine.test.ts`: 3 suites, 7 tests passed in 14.6 seconds.
- The repository's existing `npm test` script uses Unix inline environment-variable syntax and does not launch directly from Windows PowerShell. The same Jest command passed after setting `DOTENV_CONFIG_PATH` with native PowerShell syntax; this is recorded as a workflow portability caveat, not hidden as a product failure.

## Evidence files

- `applied.png`: created graph node plus Auto execution surface
- `undone.png`: graph after whole-run Undo
- `reloaded-undone-panel.png`: recovered proposal/tool-trace panel after reload

## Scope and caveats

- No existing graph node was edited or deleted; the only created proof node was removed by the product's own Undo action.
- The live UI moved directly from its streamed run to the applied state; the transient `Checkpoint ready` message was not observable as a rendered frame because adjacent SSE events were consumed in one browser task. The route-level event protocol remains scenario-tested, while the durable checkpoint, apply, receipt, undo, and recovery states were observed in production.
- The two-tab single-winner checkpoint race remains covered by executable scenario tests; a renewed live two-tab replay under the new streaming transport remains outstanding.
