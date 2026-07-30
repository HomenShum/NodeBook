"use client";

import { captureException } from "@sentry/nextjs";
import { Loader2, Search, X } from "lucide-react";
import { action, observable } from "mobx";
import { observer } from "mobx-react-lite";
import React from "react";

import appStyles from "@/app/app.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { getAuthFetch } from "@/app/util";
import { cn } from "@/lib/utils";

import { AgentQueryResponse, AgentReceipt } from "./types";

import styles from "./page.module.css";

const EXAMPLE_QUERIES = [
  "What themes recur across my recent notes?",
  "Which ideas mention customer interviews?",
  "What evidence do I have for my current product hypothesis?",
];

const state = observable({
  query: "",
  content: "",
  receipt: null as AgentReceipt | null,
  error: "",
  isLoading: false,
  consent: false,
});

const executeQuery = action(async () => {
  if (!state.consent) {
    state.error = "Confirm the read-only AI run before continuing.";
    return;
  }
  state.isLoading = true;
  state.error = "";
  state.content = "";
  state.receipt = null;
  try {
    const response = await getAuthFetch()("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: state.query, consent: true }),
    });
    const data = (await response.json()) as AgentQueryResponse;
    if ("error" in data) {
      state.error = data.error;
      return;
    }
    if (!response.ok) {
      state.error = `Agent run failed (${response.status})`;
      return;
    }
    state.content = data.content;
    state.receipt = data.receipt;
  } catch (error) {
    captureException(error, { extra: { query: state.query, message: "NodeBook agent request failed" } });
    state.error = "The agent could not complete this run. No graph changes were made.";
  } finally {
    state.isLoading = false;
  }
});

const NodeBookQueryInterface = observer(function NodeBookQueryInterface() {
  return (
    <div className={cn(appStyles.ViewContainer, appStyles.ViewContainerFull)} data-testid="nodebook-agent">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void executeQuery();
        }}
      >
        <div className={styles.searchContainer}>
          {state.isLoading ? <Loader2 className={styles.loadingIcon} size={14} /> : <Search size={14} />}
          <input
            aria-label="Ask NodeBook"
            className={styles.searchInput}
            disabled={state.isLoading}
            placeholder="Ask your NodeBook graph..."
            type="search"
            value={state.query}
            onChange={action((event) => {
              state.query = event.target.value;
            })}
          />
          {state.query && (
            <Button
              aria-label="Clear query"
              className={styles.clearButton}
              type="button"
              variant="ghost"
              onClick={action(() => {
                state.query = "";
                state.content = "";
                state.receipt = null;
              })}
            >
              <X size={14} />
            </Button>
          )}
        </div>
        <div className={styles.preflight} data-testid="agent-preflight">
          <strong>Read-only agent preflight</strong>
          <span>Provider: OpenAI · Model: gpt-5-mini · Context: matching nodes · Graph writes: none</span>
          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={state.consent}
              onChange={action((event) => {
                state.consent = event.target.checked;
              })}
            />
            I approve sending this query and matching NodeBook context to OpenAI for this run.
          </label>
          <Button disabled={state.isLoading || !state.query.trim() || !state.consent} type="submit">
            {state.isLoading ? "Running…" : "Run read-only agent"}
          </Button>
        </div>
      </form>

      {!state.query && !state.error && (
        <div className={styles.searchResults}>
          <div>Example queries</div>
          {EXAMPLE_QUERIES.map((query) => (
            <button
              className={styles.exampleQuery}
              key={query}
              type="button"
              onClick={action(() => {
                state.query = query;
              })}
            >
              <Search size={14} />
              <span>{query}</span>
            </button>
          ))}
        </div>
      )}
      {state.error && (
        <div className={styles.error} role="alert">
          <strong>Run not completed</strong>
          <p>{state.error}</p>
        </div>
      )}
      {state.content && (
        <article className={styles.response} data-testid="agent-response">
          <p className={styles.responseText}>{state.content}</p>
          {state.receipt && (
            <dl className={styles.receipt} data-testid="agent-receipt">
              <div>
                <dt>Run</dt>
                <dd>{state.receipt.runId}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{state.receipt.status}</dd>
              </div>
              <div>
                <dt>Evidence nodes</dt>
                <dd>{state.receipt.sourceNodeIds.length}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{state.receipt.usage.totalTokens ?? "unreported"}</dd>
              </div>
              <div>
                <dt>Receipt stored</dt>
                <dd>{state.receipt.persisted ? "yes" : "no — response is not durably receipted"}</dd>
              </div>
            </dl>
          )}
        </article>
      )}
    </div>
  );
});

export default NodeBookQueryInterface;
