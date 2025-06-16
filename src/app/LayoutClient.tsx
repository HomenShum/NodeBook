import { eq } from "drizzle-orm";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import React from "react";

import { AuthProvider } from "@/app/auth/AuthProvider";
import { FilteredNodesProvider } from "@/app/components/RelatedObject/contexts/FilteredNodesContext";
import { ToastContextProvider } from "@/app/hooks/useToast";
import { getDb } from "@/db";
import { graphNodeTable } from "@/db/schema";

import { StoresProvider } from "./StoresProvider";

const App = dynamic(() => import("./App"), {
  ssr: false,
});

/**
 * Get the object ID from the request headers.
 *
 * Background:
 * We use a middleware to set the mew-url header by intercepting the request.
 * Even thought NextJs is run on both server and client, we have to use a middlware to read the URL
 * because apparatnly NextJS does not expose the request URL to server components.
 *
 * Source: https://github.com/vercel/next.js/issues/43704#issuecomment-2090798307
 * This feels like an overengineering on NextJs's part and solving for problems that
 * don't really exist but it is what it is.
 *
 * @returns The object ID or null if it is not present.
 */
const getRequestedObjectId = async (): Promise<string | null> => {
  const headersList = await headers();
  const requestedURL = headersList.get("mew-url");

  if (!requestedURL) return null;

  let path = new URL(requestedURL).pathname;
  if (path.endsWith("/") && path !== "/") {
    path = path.slice(0, -1);
  }

  const parts = path.split("/").filter(Boolean);

  if (path.startsWith("/g/")) {
    const objectId = parts.pop();
    return objectId || null;
  }

  if (path.startsWith("/") && parts.length == 1) {
    const slug = parts.pop();
    if (!slug || slug === "g") return null;
    const db = getDb();
    const node = await db.query.graphNodeTable.findFirst({
      columns: {
        id: true,
      },
      where: eq(graphNodeTable.slug, slug),
    });
    return node ? node.id : null;
  }

  return null;
};

export default async function LayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const objectId = await getRequestedObjectId();

  return (
    <ToastContextProvider>
      <AuthProvider>
        <StoresProvider initialObjectId={objectId}>
          <FilteredNodesProvider>
            <App>{children}</App>
          </FilteredNodesProvider>
        </StoresProvider>
      </AuthProvider>
    </ToastContextProvider>
  );
}
