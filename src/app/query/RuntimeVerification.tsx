"use client";

import { AlertTriangle, Check, ChevronRight, Loader2, Play, RotateCcw, Square } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { getAuthFetch } from "@/app/util";

import RuntimeSynapseMap from "./RuntimeSynapseMap";
import {
  latestSuiteReceipts,
  runRuntimeEvalCases,
  runtimeEvalSummary,
  runtimeCaseStatus,
  selectFailedCases,
  selectRemainingCases,
  RuntimeEvalCase,
  RuntimeEvalHistory,
  RuntimeEvalReceipt,
} from "./runtimeVerificationState";

import styles from "./page.module.css";

function receiptMap(receipts: RuntimeEvalReceipt[]) {
  return new Map(receipts.map((receipt) => [receipt.caseId, receipt]));
}

export default function RuntimeVerification() {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<RuntimeEvalHistory | null>(null);
  const [suiteId, setSuiteId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<RuntimeEvalReceipt[]>([]);
  const [currentCase, setCurrentCase] = useState<RuntimeEvalCase | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState("");
  const stopAfterCurrent = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getAuthFetch()("/api/query/evals")
      .then(async (response) => {
        const data = (await response.json()) as RuntimeEvalHistory & { error?: string };
        if (!response.ok || data.error) throw new Error(data.error || `Evaluation history failed (${response.status})`);
        if (cancelled) return;
        const latest = latestSuiteReceipts(data.evaluations);
        setHistory(data);
        setSuiteId(latest.suiteId);
        setReceipts(latest.receipts);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Evaluation history is unavailable");
      });
    return () => { cancelled = true; };
  }, []);

  const summary = runtimeEvalSummary(receipts, history?.cases.length ?? 6);
  const byCase = useMemo(() => receiptMap(receipts), [receipts]);
  const models = [...new Set(receipts.map((receipt) => `${receipt.provider} · ${receipt.model}`))];
  const statusForCase = useCallback((caseId: string) => runtimeCaseStatus(caseId, receipts, currentCase?.caseId ?? null), [currentCase?.caseId, receipts]);

  const fetchCase = async (caseId: string, activeSuiteId: string) => {
    const response = await getAuthFetch()("/api/query/evals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, suiteId: activeSuiteId, consent: true }),
    });
    const data = (await response.json()) as { receipt?: RuntimeEvalReceipt; error?: string };
    if (data.receipt) return data.receipt;
    throw new Error(data.error || `Evaluation failed before a receipt (${response.status})`);
  };

  const runCases = async (cases: RuntimeEvalCase[], reuseSuite = false) => {
    if (!history || isRunning || cases.length === 0) return;
    const activeSuiteId = reuseSuite && suiteId ? suiteId : crypto.randomUUID();
    if (!reuseSuite) setReceipts([]);
    setSuiteId(activeSuiteId);
    setIsRunning(true);
    setStopped(false);
    setError("");
    stopAfterCurrent.current = false;
    try {
      const outcome = await runRuntimeEvalCases({
        cases,
        suiteId: activeSuiteId,
        fetchCase,
        shouldStop: () => stopAfterCurrent.current,
        onCaseStart: (testCase) => setCurrentCase(testCase),
        onReceipt: (receipt) => setReceipts((current) => [receipt, ...current.filter((item) => item.caseId !== receipt.caseId)]),
      });
      setStopped(outcome.stopped);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evaluation stopped before a durable receipt");
    } finally {
      setCurrentCase(null);
      setIsRunning(false);
    }
  };

  const runAll = () => void runCases(history?.cases ?? []);
  const runRemaining = () => void runCases(selectRemainingCases(history?.cases ?? [], receipts), true);
  const retryFailed = () => void runCases(selectFailedCases(history?.cases ?? [], receipts), true);

  const label = isRunning
    ? `Running ${summary.completed + 1} of ${history?.cases.length ?? 6}`
    : receipts.length === 0
      ? history ? "Not run" : error ? "Unavailable" : "Loading"
      : `${summary.passed}/${history?.cases.length ?? 6} passed`;

  return <details className={styles.runtimeVerification} data-testid="nodeagent-runtime-verification" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
    <summary><span><ChevronRight size={14} /> Runtime verification</span><strong>{label}</strong></summary>
    <div className={styles.runtimeVerificationBody} aria-live="polite">
      <p>Six locked legacy-parity cases run through the production NodeAgent engine using synthetic fixtures. They never apply graph changes.</p>
      {history && isOpen && <>
        <RuntimeSynapseMap cases={history.cases} statusForCase={statusForCase} />
        <dl className={styles.runtimeMetrics} aria-label="Runtime verification summary">
          <div><dt>Passed</dt><dd>{summary.passed}</dd></div>
          <div><dt>Failed</dt><dd>{summary.failed}</dd></div>
          <div><dt>Remaining</dt><dd>{summary.remaining}</dd></div>
        </dl>
      </>}
      {history && <dl className={styles.runtimePreflight} data-testid="runtime-eval-preflight">
        <div><dt>Expected route</dt><dd>{history.preflight.provider} / {history.preflight.model}</dd></div>
        <div><dt>Egress</dt><dd>Fixed synthetic fixtures only</dd></div>
        <div><dt>Writes</dt><dd>Evaluation receipts only / no graph mutation</dd></div>
      </dl>}
      {error && <div className={styles.runtimeError} role="alert"><AlertTriangle size={14} /><div><strong>Verification stopped</strong><p>{error}</p></div></div>}
      {isRunning && currentCase && <div className={styles.runtimeCurrent} data-testid="runtime-eval-running">
        <Loader2 className={styles.loadingIcon} size={14} /><span><strong>{summary.completed + 1} of {history?.cases.length}</strong>{currentCase.title}</span>
      </div>}
      {history && <div className={styles.runtimeCases} data-testid="runtime-eval-cases">
        {history.cases.map((testCase) => {
          const receipt = byCase.get(testCase.caseId);
          return <div className={styles.runtimeCase} key={testCase.caseId}>
            <span>{receipt ? receipt.passed ? <Check size={13} /> : <AlertTriangle size={13} /> : <span className={styles.runtimeCaseEmpty} />}{testCase.title}</span>
            <strong>{receipt ? receipt.passed ? "PASS" : "FAIL" : "Not run"}</strong>
            {receipt && <small>{receipt.disposition} / {receipt.latencyMs.toLocaleString()} ms / {receipt.evalId}<br />{receipt.reasons.join(" ") || "All locked assertions passed."}</small>}
          </div>;
        })}
      </div>}
      {receipts.length > 0 && <dl className={styles.runtimeReceipt} data-testid="runtime-eval-receipt">
        <div><dt>Suite</dt><dd>{suiteId}</dd></div>
        <div><dt>Version</dt><dd>{receipts[0].benchmarkVersion}</dd></div>
        <div><dt>Model</dt><dd>{models.join("; ")}</dd></div>
        <div><dt>Usage</dt><dd>{summary.totalTokens === null ? "not reported" : `${summary.totalTokens.toLocaleString()} tokens`} / {summary.latencyMs.toLocaleString()} ms</dd></div>
        <div><dt>Receipt</dt><dd>{receipts.every((receipt) => receipt.persisted) ? "durable" : "incomplete"} / graph unchanged</dd></div>
      </dl>}
      <div className={styles.runtimeActions}>
        {!isRunning && receipts.length === 0 && <Button disabled={!history} onClick={runAll}><Play size={13} /> Run six cases</Button>}
        {isRunning && <Button variant="ghost" onClick={() => { stopAfterCurrent.current = true; }}><Square size={12} /> Stop after current case</Button>}
        {!isRunning && summary.remaining > 0 && receipts.length > 0 && <Button onClick={runRemaining}><Play size={13} /> Run remaining</Button>}
        {!isRunning && summary.failed > 0 && <Button variant="ghost" onClick={retryFailed}><RotateCcw size={13} /> Retry failed</Button>}
        {!isRunning && summary.remaining === 0 && receipts.length > 0 && <Button variant="ghost" onClick={runAll}><RotateCcw size={13} /> Run again</Button>}
      </div>
      {stopped && <small>Stopped after the current case. Completed receipts were preserved.</small>}
    </div>
  </details>;
}
