"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useEffect, useMemo, useState } from "react";

import { GraphStore } from "@/app/graph/GraphStore";

const recentTransactionsReference = makeFunctionReference<
  "query",
  { ownerCursor: string; publicCursor: string; limit?: number },
  {
    own: { cursor: string; payload: string; appliedAtMs: number }[];
    shared: { cursor: string; payload: string | null; appliedAtMs: number }[];
  }
>("graph:recentTransactions");

export function ConvexSyncBridge({ graphStore }: { graphStore: GraphStore }) {
  const { isAuthenticated } = useConvexAuth();
  const initialCursor = useMemo(
    () => (Date.now() - 5 * 60_000).toString().padStart(16, "0"),
    [],
  );
  const [ownerCursor, setOwnerCursor] = useState(initialCursor);
  const [publicCursor, setPublicCursor] = useState(initialCursor);
  const transactions = useQuery(
    recentTransactionsReference,
    isAuthenticated
      ? {
        ownerCursor,
        publicCursor,
        limit: 20,
      }
      : "skip",
  );
  const signature = useMemo(
    () => transactions
      ? [...transactions.own, ...transactions.shared]
        .map((entry) => `${entry.cursor}:${entry.payload ?? ""}`)
        .join("|")
      : "",
    [transactions],
  );

  useEffect(() => {
    if (!transactions || (!transactions.own.length && !transactions.shared.length)) return;
    let cancelled = false;
    void (async () => {
      const merged = [...transactions.own, ...transactions.shared]
        .filter((entry): entry is typeof entry & { payload: string } => entry.payload !== null)
        .sort((left, right) => left.appliedAtMs - right.appliedAtMs);
      for (const entry of merged) {
        if (cancelled) return;
        await graphStore.updateManager.acceptRemoteSync(JSON.parse(entry.payload));
      }
      if (!cancelled) {
        const lastOwned = transactions.own.at(-1);
        const lastShared = transactions.shared.at(-1);
        if (lastOwned) setOwnerCursor(lastOwned.cursor);
        if (lastShared) setPublicCursor(lastShared.cursor);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [graphStore, signature, transactions]);

  return null;
}
