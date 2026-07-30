"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getAuthFetch } from "@/app/util";

export default function SlugPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("Slug resolution timed out"), 10_000);
    getAuthFetch()(`/api/slug?slug=${encodeURIComponent(params.slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Slug resolution failed with HTTP ${response.status}`);
        const body = await response.json();
        const nodeId = body.nodes?.[0]?.id;
        router.replace(nodeId ? `/g/${encodeURIComponent(nodeId)}` : "/g");
      })
      .catch(() => router.replace("/g"))
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [params.slug, router]);
  return null;
}
