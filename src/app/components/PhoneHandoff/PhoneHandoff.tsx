"use client";

import { Check, Copy, QrCode, Smartphone } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import styles from "./PhoneHandoff.module.css";

const PRODUCTION_PHONE_URL = "https://nodebook-rho.vercel.app/g";

type Props = {
  variant?: "floating" | "inline";
};

const resolvePhoneUrl = () => {
  if (typeof window === "undefined") return PRODUCTION_PHONE_URL;

  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? PRODUCTION_PHONE_URL : `${window.location.origin}/g`;
};

export default function PhoneHandoff({ variant = "floating" }: Props) {
  const [phoneUrl, setPhoneUrl] = useState(PRODUCTION_PHONE_URL);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [qrFailed, setQrFailed] = useState(false);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    setPhoneUrl(resolvePhoneUrl());
    return () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const qrImageUrl = useMemo(
    () => `https://quickchart.io/qr?size=320&margin=2&text=${encodeURIComponent(phoneUrl)}`,
    [phoneUrl],
  );

  const copyLink = async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(phoneUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }

    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyStatus("idle"), 1800);
  };

  return (
    <details
      className={cn(styles.handoff, variant === "floating" ? styles.floating : styles.inline)}
      data-testid="nodebook-phone-handoff"
    >
      <summary aria-label="Open NodeBook on your phone" className={styles.summary}>
        <Smartphone aria-hidden="true" size={16} />
        <span>Open on phone</span>
      </summary>
      <section aria-label="NodeBook phone QR code" className={styles.panel}>
        <div>
          <strong>Scan to open NodeBook</strong>
          <p>Use your phone camera, then sign in with the same account.</p>
        </div>
        {qrFailed ? (
          <p className={styles.fallback} role="status">
            QR image unavailable. Use the link below.
          </p>
        ) : (
          <img
            alt="QR code for the NodeBook phone app"
            className={styles.qr}
            height={160}
            loading="lazy"
            onError={() => setQrFailed(true)}
            referrerPolicy="no-referrer"
            src={qrImageUrl}
            width={160}
          />
        )}
        <div className={styles.actions}>
          <a href={phoneUrl} rel="noreferrer" target="_blank">
            <QrCode aria-hidden="true" size={14} />
            Open link
          </a>
          <button aria-label="Copy NodeBook phone link" onClick={() => void copyLink()} type="button">
            {copyStatus === "copied" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <Copy aria-hidden="true" size={14} />
            )}
            {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy link"}
          </button>
        </div>
        <small>The QR contains only the public NodeBook address, never your current note.</small>
      </section>
    </details>
  );
}
