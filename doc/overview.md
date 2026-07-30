# NodeBook overview

NodeBook is a node-native notebook. The original notebook interaction model is preserved while Auth0 supplies identity and Convex is the only graph persistence and realtime backend.

## Loading, storing, and updating the graph

`GraphStore.ts` owns the in-browser graph. At session start, `StoresProvider` loads bounded pages from the Convex snapshot API into the serialized model defined by `SerializedData.ts`. `GraphStore.resetAndLoad()` reconstructs nodes, relations, relation types, relation lists, and the local search index.

Graph edits remain higher-level transactions in `GraphTransactionTypes.ts`. `UpdateManager.ts` converts them into atomic sync operations, keeps a bounded retry queue, and posts them to `api/sync/route.ts`. The Convex `graph:applySync` mutation authenticates ownership, applies the batch atomically, enforces entity versions, and returns honest idempotency or conflict status.

`ConvexSyncBridge.tsx` subscribes to separate owner and public realtime feeds. Deterministic stream cursors prevent simultaneous updates from being skipped, while the full snapshot remains the recovery source of truth.

## Searching

Client-side prefix search uses the graph's in-memory trie. Server-side search calls the bounded Convex full-text indexes for the authenticated owner's nodes and public nodes. The command bar exposes the combined result.

## Displaying and manipulating the tree

The tree and editor surfaces continue to consume the established `GraphStore` view model. Convex documents are translated at the persistence boundary, so the migration does not replace the original notebook UI or leak backend-shaped records into components.

## Production operations

See `PRODUCTION_CUTOVER.md` for the rehearsal, deterministic import receipt, activation, evidence, and rollback procedure.
