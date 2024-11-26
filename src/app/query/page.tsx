"use client";

import { LinkIcon, Loader2, Search, X } from "lucide-react";
import { action, observable, toJS } from "mobx";
import { observer } from "mobx-react-lite";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useToast } from "@/app/hooks/useToast";
import { useSetRoot } from "@/app/tree/utils";
import appLogger from "@/lib/logger";

import styles from "./page.module.css";

const logger = appLogger.child({
  service: "query",
});

// Example queries from the original code
const EXAMPLE_QUERIES = [
  "founders of companies in Boston in biology",
  "Tell me about the dietary requirements of Ridhi's dinner party on Dec 24",
  "Connections from Josh Langsam to tier one vcs",
  "founders of a series a company interested in sustainability",
];

// Types for our API responses
type QueryResponse = {
  response: string;
  error?: string;
};

type ResponseLine =
  | { type: "text"; content: string }
  | { type: "citation"; nodeId: string }
  | { type: "link"; nodeId: string; content: string };
type ParsedResponse = ResponseLine[][];

const processResponse = (text: string): ParsedResponse => {
  const lines = text.split("\n");

  const result: ParsedResponse = [];

  for (const line of lines) {
    const parts: ResponseLine[] = [];
    let lastIndex = 0;
    const matches = line.matchAll(/\[\[([^\]]+)\]\]/g);

    for (const match of matches) {
      // Add text before the match
      if (match.index! > lastIndex) {
        parts.push({
          type: "text",
          content: line.slice(lastIndex, match.index),
        });
      }

      // Add the link
      if (match[1].includes("|")) {
        const [nodeId, content] = match[1].split("|");
        parts.push({
          type: "link",
          nodeId,
          content,
        });
      } else {
        parts.push({
          type: "citation",
          nodeId: match[1],
        });
      }

      lastIndex = match.index! + match[0].length;
    }

    // Add remaining text after last match
    if (lastIndex < line.length) {
      parts.push({
        type: "text",
        content: line.slice(lastIndex),
      });
    }

    result.push(parts);
  }

  return result;
};

const state = observable<{
  query: string;
  response: ParsedResponse | null;
  error: string;
  isLoading: boolean;
}>({
  query: "",
  response: null,
  error: "",
  isLoading: false,
});

// Main component
const MewQueryInterface = observer(function MewQueryInterface() {
  const user = useUser();
  // Split into two functions - one for the form submit, one for the actual query
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeQuery(state.query);
  };

  const executeQuery = action(async (query: string) => {
    state.isLoading = true;
    state.error = "";

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, userId: user.id }),
      });

      const data: QueryResponse = await response.json();

      if (data.error) {
        state.error = data.error;
      } else {
        state.response = processResponse(data.response);
        logger.info("query response", {
          query,
          response: data.response,
          parsed: toJS(state.response),
        });
      }
    } catch (err) {
      state.error = "Failed to process query. Please try again.";
    } finally {
      state.isLoading = false;
    }
  });

  console.log(EXAMPLE_QUERIES);
  return (
    <div className={styles.container}>
      <form onSubmit={handleFormSubmit} className={styles.form}>
        {/* Search bar */}
        <div className={styles.searchContainer}>
          <div className={styles.searchIconWrapper}>
            {state.isLoading ? (
              <Loader2 className={styles.loadingIcon} size={14} strokeWidth={1.5} />
            ) : (
              <Search className={styles.searchIcon} size={14} strokeWidth={1.5} />
            )}
          </div>
          <input
            type="search"
            className={styles.searchInput}
            value={state.query}
            onChange={action((e) => {
              state.query = e.target.value;
              if (state.query.length === 0) {
                state.response = null;
              }
            })}
            placeholder="Ask your graph..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleFormSubmit(e);
              }
            }}
          />
          {state.query && (
            <Button
              variant="ghost"
              className={styles.clearButton}
              onClick={action(() => {
                state.query = "";
                state.response = null;
              })}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </form>
      <div className={styles.searchResults}>
        {/* Example queries - only show when no query */}
        {!state.query && (
          <div className={styles.examplesSection}>
            <div>Example queries</div>
            {EXAMPLE_QUERIES.map((q) => (
              <div
                key={q}
                className={styles.exampleQuery}
                onClick={action(() => {
                  state.query = q;
                  executeQuery(q);
                })}
              >
                <Search className={styles.exampleIcon} size={14} strokeWidth={1.5} />
                <span>{q}</span>
              </div>
            ))}
          </div>
        )}
        {state.error && (
          <div className={styles.error}>
            <div className={styles.errorHeader}>
              <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12" y2="16" />
              </svg>
              <h4 className={styles.errorTitle}>Error</h4>
            </div>
            <p className={styles.errorMessage}>{state.error}</p>
          </div>
        )}

        {/* Response */}
        {state.response && !state.isLoading && <Response response={state.response} />}
      </div>
    </div>
  );
});

function Response({ response }: { response: ParsedResponse }) {
  const graphStore = useGraphStore();
  const setRoot = useSetRoot();
  const { addToast } = useToast();

  function goToNode(id: string) {
    const node = graphStore.getNode(id);
    if (!node) {
      addToast({ title: "Error", description: "Node not found" });
      return;
    }
    setRoot(node);
  }
  return (
    <div className={styles.response}>
      {response.map((line, i) => (
        <div key={i} className={styles.responseLine}>
          {line.map((part, i) =>
            part.type === "text" ? (
              <span key={i} className={styles.responseText}>
                {part.content}
              </span>
            ) : part.type === "citation" ? (
              <span key={i} data-node-id={part.nodeId} onClick={() => goToNode(part.nodeId)}>
                <LinkIcon className={styles.responseLinkIcon} size={14} strokeWidth={1.5} />
              </span>
            ) : part.type === "link" ? (
              <span
                key={i}
                data-node-id={part.nodeId}
                style={{ cursor: "pointer", color: "blue" }}
                onClick={() => goToNode(part.nodeId)}
              >
                {part.content}
              </span>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}

export default MewQueryInterface;
