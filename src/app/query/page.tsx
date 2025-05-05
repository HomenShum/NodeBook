"use client";

import { captureException } from "@sentry/nextjs";
import { LinkIcon, Loader2, Search, X } from "lucide-react";
import { action, observable, runInAction, toJS } from "mobx";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";

import appStyles from "@/app/app.module.css";
import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useUser } from "@/app/contexts/UserContext";
import { useToast } from "@/app/hooks/useToast";
import { useSetMainRoot } from "@/app/tree/utils";
import { useViewStore } from "@/app/view/useViewStore";
import appLogger from "@/lib/logger";
import { cn } from "@/lib/utils";
import { UNLOGGED_USER } from "@/app/auth/MewUser";
import { getAuthFetch } from "@/app/util";

import { QueryMode, ReadParsedResponse, ReadQueryResponse } from "./types";

import styles from "./page.module.css";

const logger = appLogger.child({
  service: "query",
});

const EXAMPLE_QUERIES = [
  "founders of companies in Boston in biology",
  "companies that would be impacted by copper shortage",
  "Connections from Josh Langsam to tier one vcs",
  "founders of a series a company interested in sustainability",
];

const state = observable<{
  query: string;
  response: ReadParsedResponse | null;
  error: string;
  isLoading: boolean;
  mode: QueryMode;
  userId: string;
}>({
  query: "",
  response: null,
  error: "",
  isLoading: false,
  mode: QueryMode.READ,
  userId: UNLOGGED_USER.id,
});

const toggleMode = action(() => {
  state.mode = state.mode === QueryMode.READ ? QueryMode.CREATE : QueryMode.READ;
  state.response = null;
  state.isLoading = false;
  state.error = "";
});

const executeReadQuery = action(async () => {
  const { query, userId } = state;

  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, userId }),
    });

    const data: ReadQueryResponse = await response.json();

    if (data.error) {
      state.error = data.error;
    } else {
      state.response = JSON.parse(data.response).content;
      logger.info("query response", {
        query,
        response: data.response,
        parsed: toJS(state.response),
      });
    }
  } catch (err) {
    captureException(err, { user: { id: userId }, extra: { query, message: "Error processing AI query" } });
    state.error = "Failed to process query. Please try again.";
  }
});

const executeCreateQuery = action(async () => {
  const { query, userId } = state;
  const authedFetch = getAuthFetch();
  try {
    const response = await fetch("/api/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, userId }),
    });

    const data: ReadQueryResponse = await response.json();

    if (data.error) {
      state.error = data.error;
    } else {
      state.response = JSON.parse(data.response).content;
      logger.info("query response", {
        query,
        response: data.response,
        parsed: toJS(state.response),
      });
    }
  } catch (err) {
    captureException(err, { user: { id: userId }, extra: { query, message: "Error processing AI query" } });
    state.error = "Failed to process query. Please try again.";
  }
});

const executeQuery = async () => {
  state.isLoading = true;
  state.error = "";

  switch (state.mode) {
    case QueryMode.READ:
      await executeReadQuery();
      break;
    case QueryMode.CREATE:
      await executeCreateQuery();
      break;
    default:
      throw new Error("Invalid query mode");
  }

  state.isLoading = false;
};

const MewQueryInterface = observer(function MewQueryInterface() {
  const user = useUser();
  const viewStore = useViewStore();

  useEffect(() => {
    runInAction(() => {
      state.userId = user.id;
    });
  }, [user]);

  return (
    <div className={cn(appStyles.ViewContainer, { [appStyles.ViewContainerFull]: !viewStore.leftSidebarOpen })}>
      <SearchBar />
      <SearchResult />
    </div>
  );
});

const SearchBar = observer(function SearchBar() {
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeQuery();
  };
  return (
    <form onSubmit={handleFormSubmit} className={styles.form}>
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
      <input type="checkbox" />
    </form>
  );
});
const SearchResult = observer(function SearchResult() {
  const showExample = !state.query && !state.error;
  const showError = state.error;

  if (showExample) {
    return (
      <div className={styles.searchResults}>
        <div className={styles.examplesSection}>
          <div>Example queries</div>
          {EXAMPLE_QUERIES.map((q) => (
            <div
              key={q}
              className={styles.exampleQuery}
              onClick={action(() => {
                state.query = q;
                executeQuery();
              })}
            >
              <Search className={styles.exampleIcon} size={14} strokeWidth={1.5} />
              <span>{q}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showError) {
    return (
      <div className={styles.searchResults}>
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
      </div>
    );
  }

  return (
    <div className={styles.searchResults}>
      <Response />
    </div>
  );
});
// parse basic markdown (bold/italics)
function parseMarkdown(text: string): JSX.Element {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          // bold text
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        } else if (part.startsWith("*") && part.endsWith("*")) {
          // italic text
          return <em key={i}>{part.slice(1, -1)}</em>;
        } else {
          // regular text (preserve whitespace)
          return <span key={i}>{part}</span>;
        }
      })}
    </>
  );
}

const Response = observer(function Response() {
  const response = state.response;
  const graphStore = useGraphStore();
  const setRoot = useSetMainRoot();
  const { addToast } = useToast();

  function goToNode(id: string) {
    const node = graphStore.getNode(id);
    if (!node) {
      addToast({ title: "Error", description: "Node not found" });
      return;
    }
    setRoot(node);
  }

  if (response === null) return <></>;

  return (
    <div className={styles.response}>
      {response.map((line, lineIndex) => {
        const elements: JSX.Element[] = [];

        line.forEach((part, partIndex) => {
          if (part.type === "text") {
            elements.push(
              <span key={`text-${partIndex}`} className={styles.responseText}>
                {parseMarkdown(part.content)}
              </span>,
            );
          } else if (part.type === "citation") {
            const node = graphStore.getNode(part.nodeId);
            if (node) {
              elements.push(
                <span
                  key={`citation-${partIndex}`}
                  data-node-id={part.nodeId}
                  onClick={() => goToNode(part.nodeId)}
                  className={styles.citationLink}
                >
                  <LinkIcon className={styles.responseLinkIcon} size={14} strokeWidth={1.5} />
                </span>,
              );
            }
          } else if (part.type === "link") {
            elements.push(
              <a
                key={`link-${partIndex}`}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkText}
              >
                {part.content}
              </a>,
            );
          }
        });

        return (
          <div key={lineIndex} className={styles.responseLine}>
            {elements}
          </div>
        );
      })}
    </div>
  );
});

export default MewQueryInterface;
