"use client";

import { captureException } from "@sentry/nextjs";
import { Brain, Check, Loader2, Pin, RotateCcw, Search, Trash2, X } from "lucide-react";
import { action, observable } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useContext, useEffect } from "react";

import appStyles from "@/app/app.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useSetMainRoot } from "@/app/tree/utils";
import { getAuthFetch } from "@/app/util";
import { cn } from "@/lib/utils";

import { applyAgentOperations, undoAgentOperations } from "./applyProposal";
import { NodeAgentEmbeddingContext } from "./NodeAgentEmbeddingContext";
import { runCheckpointExecutionLifecycle } from "./checkpointExecution";
import { NODE_AGENT_INVOKE_EVENT, NodeAgentInvocation } from "./nodeAgentEvents";
import {
  AgentExecutionMode,
  AgentMode,
  AgentOperation,
  AgentQueryResponse,
  AgentReceipt,
  AgentStep,
  DurableAgentProposal,
} from "./types";

import styles from "./page.module.css";

const EXAMPLES = [
  "What themes recur across my recent notes?",
  "Create a project container and organize my customer interview notes under it.",
  "Find duplicate idea clusters and create a cleaner hierarchy.",
];

const state = observable({
  query: "",
  content: "",
  understanding: "",
  plan: [] as string[],
  operations: [] as AgentOperation[],
  steps: [] as AgentStep[],
  receipt: null as AgentReceipt | null,
  proposal: null as { id: string; digest: string; status: string } | null,
  inverseUpdates: null as unknown[] | null,
  error: "",
  isLoading: false,
  isTransitioning: false,
  consent: false,
  webResearch: false,
  mode: "ask" as AgentMode,
  executionMode: "auto" as AgentExecutionMode,
  riskReasons: [] as string[],
  rootNodeId: null as string | null,
  memories: [] as Array<{
    memoryId: string;
    taskClass: string;
    summary: string;
    toolSequence: string[];
    outcome: "success" | "failure" | "rejected" | "undone";
    sourceNodeIds: string[];
    pinned: boolean;
  }>,
});

async function proposalTransition(body: Record<string, unknown>) {
  const response = await getAuthFetch()("/api/query/proposal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Proposal transition failed (${response.status})`);
  return data;
}

function setProposalUrl(proposalId: string | null) {
  const url = new URL(window.location.href);
  if (proposalId) url.searchParams.set("proposalId", proposalId);
  else url.searchParams.delete("proposalId");
  window.history.replaceState({}, "", url);
}

const NodeAgentInterface = observer(function NodeAgentInterface() {
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const embedded = useContext(NodeAgentEmbeddingContext);

  useEffect(() => {
    const proposalId = new URLSearchParams(window.location.search).get("proposalId")?.trim();
    if (!proposalId) return;
    let cancelled = false;
    state.isLoading = true;
    state.error = "";
    void getAuthFetch()(`/api/query/proposal?proposalId=${encodeURIComponent(proposalId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { proposal?: DurableAgentProposal; error?: string };
        if (!response.ok || !data.proposal) throw new Error(data.error || `Proposal load failed (${response.status})`);
        if (cancelled) return;
        const proposal = data.proposal;
        action(() => {
          state.query = proposal.understanding;
          state.content = proposal.summary;
          state.understanding = proposal.understanding;
          state.plan = proposal.plan;
          state.operations = proposal.operations;
          state.steps = proposal.steps;
          state.receipt = proposal.receipt;
          state.proposal = { id: proposal.id, digest: proposal.digest, status: proposal.status };
          state.inverseUpdates = proposal.inverseUpdates;
          state.mode = proposal.mode;
          state.executionMode = proposal.executionMode;
          state.riskReasons = proposal.riskReasons;
        })();
      })
      .catch((error) => {
        if (!cancelled) action(() => { state.error = error instanceof Error ? error.message : "Proposal load failed"; })();
      })
      .finally(() => {
        if (!cancelled) action(() => { state.isLoading = false; })();
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleInvocation = (event: Event) => {
      const { query, currentNodeId } = (event as CustomEvent<NodeAgentInvocation>).detail;
      action(() => {
        state.query = query;
        state.mode = "agent";
        state.executionMode = "auto";
        state.rootNodeId = currentNodeId;
        state.error = "";
      })();
    };
    window.addEventListener(NODE_AGENT_INVOKE_EVENT, handleInvocation);
    return () => window.removeEventListener(NODE_AGENT_INVOKE_EVENT, handleInvocation);
  }, []);

  const applyDurableProposal = action(async (proposal: { id: string; digest: string; status: string }) => {
    state.isTransitioning = true;
    state.error = "";
    try {
      const receipt = await runCheckpointExecutionLifecycle({
        accept: () => proposalTransition({
          action: "accept",
          proposalId: proposal.id,
          proposalDigest: proposal.digest,
        }),
        apply: (operations) => applyAgentOperations(graphStore, operations),
        markApplied: (appliedReceipt) => proposalTransition({
          action: "applied",
          proposalId: proposal.id,
          proposalDigest: proposal.digest,
          ...appliedReceipt,
        }).then(() => undefined),
        markFailed: (message) => proposalTransition({
          action: "failed",
          proposalId: proposal.id,
          proposalDigest: proposal.digest,
          error: message,
        }).then(() => undefined),
      });
      state.inverseUpdates = receipt.inverseUpdates;
      if (state.proposal?.id === proposal.id) state.proposal.status = "applied";
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Apply failed";
      throw error;
    } finally {
      state.isTransitioning = false;
    }
  });

  const executeQuery = action(async () => {
    if (!state.consent) {
      state.error = "Approve the provider preflight before continuing.";
      return;
    }
    state.isLoading = true;
    state.error = "";
    state.content = "";
    state.proposal = null;
    state.operations = [];
    try {
      const response = await getAuthFetch()("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: state.query,
          consent: true,
          mode: state.mode,
          executionMode: state.executionMode,
          webResearch: state.webResearch,
          rootNodeId: state.mode === "ask" ? undefined : state.rootNodeId ?? graphStore.userRoot.id,
        }),
      });
      const data = (await response.json()) as AgentQueryResponse;
      if ("error" in data || !response.ok) throw new Error("error" in data ? data.error : `Run failed (${response.status})`);
      state.content = data.content;
      state.understanding = data.understanding;
      state.plan = data.plan;
      state.operations = data.operations;
      state.steps = data.steps;
      state.receipt = data.receipt;
      state.proposal = data.proposal;
      state.riskReasons = data.execution.risk.reasons;
      state.memories = data.memory.memories;
      setProposalUrl(data.proposal?.id ?? null);
      if (data.proposal && data.execution.disposition === "auto_apply") {
        await applyDurableProposal(data.proposal);
      }
    } catch (error) {
      captureException(error, { extra: { query: state.query, message: "NodeBook agent request failed" } });
      state.error = error instanceof Error ? error.message : "The agent run failed. No graph changes were made.";
    } finally {
      state.isLoading = false;
    }
  });

  const reject = action(async () => {
    if (!state.proposal) return;
    state.isTransitioning = true;
    try {
      await proposalTransition({ action: "reject", proposalId: state.proposal.id, proposalDigest: state.proposal.digest });
      state.proposal.status = "rejected";
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Reject failed";
    } finally {
      state.isTransitioning = false;
    }
  });

  const acceptAndApply = action(async () => {
    if (!state.proposal) return;
    try { await applyDurableProposal(state.proposal); } catch { /* Error is already exposed in state. */ }
  });

  const undo = action(async () => {
    if (!state.proposal || !state.inverseUpdates) return;
    state.isTransitioning = true;
    try {
      await undoAgentOperations(graphStore, state.inverseUpdates as never[]);
      await proposalTransition({ action: "undo", proposalId: state.proposal.id, proposalDigest: state.proposal.digest });
      state.proposal.status = "undone";
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Undo failed";
    } finally {
      state.isTransitioning = false;
    }
  });

  const updateMemory = action(async (memoryId: string, memoryAction: "pin" | "unpin" | "forget") => {
    state.isTransitioning = true;
    try {
      const response = await getAuthFetch()("/api/query/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId, action: memoryAction }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Memory action failed");
      if (memoryAction === "forget") state.memories = state.memories.filter((memory) => memory.memoryId !== memoryId);
      else state.memories = state.memories.map((memory) => memory.memoryId === memoryId
        ? { ...memory, pinned: memoryAction === "pin" }
        : memory);
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Memory action failed";
    } finally {
      state.isTransitioning = false;
    }
  });

  const projectMemoryToGraph = action(async (summary: string) => {
    state.isTransitioning = true;
    try {
      await graphStore.addChildNode({
        parentId: state.rootNodeId ?? graphStore.userRoot.id,
        nodeProps: { content: `🧠 NodeAgent Memory\n${summary}` },
      });
    } catch (error) {
      state.error = error instanceof Error ? error.message : "Memory projection failed";
    } finally {
      state.isTransitioning = false;
    }
  });

  return (
    <div
      className={cn(appStyles.ViewContainer, !embedded && appStyles.ViewContainerFull, styles.agentView, embedded && styles.agentEmbedded)}
      data-testid="nodebook-agent"
    >
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void executeQuery(); }}>
        <div className={styles.searchContainer}>
          {state.isLoading ? <Loader2 className={styles.loadingIcon} size={14} /> : <Search size={14} />}
          <input aria-label="Ask NodeBook" className={styles.searchInput} disabled={state.isLoading}
            placeholder="Ask NodeBook or run work on your graph…" type="search" value={state.query}
            onChange={action((event) => { state.query = event.target.value; })} />
          {state.query && <Button aria-label="Clear query" className={styles.clearButton} type="button" variant="ghost"
            onClick={action(() => { state.query = ""; state.content = ""; state.proposal = null; state.rootNodeId = null; setProposalUrl(null); })}><X size={14} /></Button>}
        </div>
        <div className={styles.modeTabs} aria-label="Agent mode">
          {(["ask", "agent", "organize"] as AgentMode[]).map((mode) => (
            <button className={state.mode === mode ? styles.modeActive : styles.mode} key={mode} type="button"
              onClick={action(() => { state.mode = mode; })}>{mode === "ask" ? "Ask" : mode === "agent" ? "Agent" : "Organization"}</button>
          ))}
        </div>
        {state.mode !== "ask" && <div className={styles.modeTabs} aria-label="Execution mode">
          {(["auto", "plan"] as AgentExecutionMode[]).map((mode) => (
            <button className={state.executionMode === mode ? styles.modeActive : styles.mode} key={mode} type="button"
              onClick={action(() => { state.executionMode = mode; })}>{mode === "auto" ? "Auto" : "Plan"}</button>
          ))}
        </div>}
        <div className={styles.preflight} data-testid="agent-preflight">
          <strong>{state.mode === "ask" ? "Read-only run" : state.executionMode === "auto" ? "Checkpointed Auto run" : "Preview-only Plan"}</strong>
          <span>{state.mode === "ask"
            ? "OpenAI receives the query and bounded matching NodeBook context. No graph writes are allowed."
            : state.executionMode === "auto"
              ? "Safe reversible graph changes run automatically after a durable checkpoint. Destructive or high-impact work pauses for approval."
              : "NodeAgent prepares exact graph changes without applying them."}</span>
          <label className={styles.consent}><input type="checkbox" checked={state.webResearch}
            onChange={action((event) => { state.webResearch = event.target.checked; })} />Allow web research for this run</label>
          <label className={styles.consent}><input type="checkbox" checked={state.consent}
            onChange={action((event) => { state.consent = event.target.checked; })} />I approve this one-time context egress to OpenAI.</label>
          <Button disabled={state.isLoading || !state.query.trim() || !state.consent} type="submit">
            {state.isLoading ? "Running…" : state.mode === "ask" ? "Ask NodeBook" : state.executionMode === "auto" ? "Run NodeAgent" : "Generate plan"}
          </Button>
        </div>
      </form>

      {!state.query && !state.error && <div className={styles.searchResults}><div>Examples</div>{EXAMPLES.map((query) => (
        <button className={styles.exampleQuery} key={query} type="button" onClick={action(() => { state.query = query; })}>
          <Search size={14} /><span>{query}</span>
        </button>))}</div>}
      {state.error && <div className={styles.error} role="alert"><strong>Not completed</strong><p>{state.error}</p></div>}
      {state.content && <article className={styles.response} data-testid="agent-response">
        <p className={styles.responseText}>{state.content}</p>
        {state.plan.length > 0 && <section><h3>Plan</h3><ol>{state.plan.map((item) => <li key={item}>{item}</li>)}</ol></section>}
        {state.steps.length > 0 && <section data-testid="agent-steps"><h3>Tool trace</h3>{state.steps.map((step) => (
          <div className={styles.step} key={`${step.sequence}-${step.tool}`}><Check size={14} /><strong>{step.tool}</strong><span>{step.summary}</span></div>
        ))}</section>}
        {state.operations.length > 0 && <section data-testid="agent-checkpoint"><h3>{state.executionMode === "plan" ? "Planned changes" : "Checkpointed graph changes"}</h3>{state.operations.map((operation, index) => (
          <div className={styles.operation} key={`${operation.kind}-${index}`}><strong>{operation.kind.replaceAll("_", " ")}</strong><span>{operation.reason}</span></div>
        ))}
          {state.proposal?.status === "pending" && <div className={styles.actions}>
            {state.riskReasons.length > 0 && <p data-testid="agent-risk-boundary">Approval required: {state.riskReasons.join(" ")}</p>}
            <Button disabled={state.isTransitioning} variant="ghost" onClick={() => void reject()}>Reject</Button>
            <Button disabled={state.isTransitioning} onClick={() => void acceptAndApply()}>{state.executionMode === "plan" ? "Apply plan" : "Approve and run"}</Button>
          </div>}
          {state.proposal?.status === "applied" && <Button disabled={state.isTransitioning} variant="ghost" onClick={() => void undo()}>
            <RotateCcw size={14} /> Undo this run
          </Button>}
          {state.proposal && <p data-testid="checkpoint-status">Checkpoint: {state.proposal.status}</p>}
        </section>}
        {state.memories.length > 0 && <section data-testid="nodeagent-memory"><h3><Brain size={14} /> Recalled memory</h3>
          {state.memories.map((memory) => <div className={styles.memory} key={memory.memoryId}>
            <div><strong>{memory.taskClass}</strong><span>{memory.summary}</span></div>
            <small>{memory.outcome} · {memory.toolSequence.join(" → ") || "no tools"}</small>
            <div className={styles.actions}>
              <Button size="sm" variant="ghost" disabled={state.isTransitioning}
                onClick={() => void updateMemory(memory.memoryId, memory.pinned ? "unpin" : "pin")}>
                <Pin size={12} /> {memory.pinned ? "Unpin" : "Pin"}
              </Button>
              <Button size="sm" variant="ghost" disabled={state.isTransitioning}
                onClick={() => void projectMemoryToGraph(memory.summary)}>Add to graph</Button>
              <Button aria-label="Forget memory" size="sm" variant="ghost" disabled={state.isTransitioning}
                onClick={() => void updateMemory(memory.memoryId, "forget")}><Trash2 size={12} /></Button>
            </div>
          </div>)}
        </section>}
        {state.receipt && <dl className={styles.receipt} data-testid="agent-receipt">
          <div><dt>Run</dt><dd>{state.receipt.runId}</dd></div>
          <div><dt>Status</dt><dd>{state.proposal?.status ?? state.receipt.status}</dd></div>
          <div><dt>Evidence</dt><dd>{state.receipt.sourceNodeIds.length} nodes · {state.receipt.sourceUrls.length} web sources</dd></div>
          <div><dt>Receipt</dt><dd>{state.receipt.persisted ? "durable" : "not persisted"}</dd></div>
        </dl>}
        {(state.receipt?.sourceBindings?.length ?? 0) > 0 && <section data-testid="agent-citations">
          <h3>Notebook citations</h3>
          <div className={styles.citationList}>{state.receipt?.sourceBindings?.map((binding) => {
            const node = graphStore.nodesById.get(binding.sourceId);
            return <button className={styles.citationLink} key={`${binding.sourceId}:${binding.version}`} type="button"
              title={`Open node ${binding.sourceId} at reviewed version ${binding.version}`}
              onClick={() => { if (node) setRoot(node); }} disabled={!node}>
              <span>{node?.text || binding.sourceId}</span><small>v{binding.version}</small>
            </button>;
          })}</div>
        </section>}
        {(state.receipt?.sourceUrls?.length ?? 0) > 0 && <section data-testid="agent-web-sources">
          <h3>Web sources</h3>
          <div className={styles.citationList}>{state.receipt?.sourceUrls?.map((url) => <a className={styles.citationLink}
            href={url} key={url} rel="noreferrer" target="_blank">{new URL(url).hostname}</a>)}</div>
        </section>}
      </article>}
    </div>
  );
});

export default NodeAgentInterface;
