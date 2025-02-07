import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { graphNodeTable } from "@/db/schema";
import { getDb } from "@/db";
import GraphPage from "@/app/g/[[...path]]/page";
async function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const db = getDb();
  const node = await db.query.graphNodeTable.findFirst({
    columns: {
      id: true,
    },
    where: eq(graphNodeTable.slug, slug),
  });

  if (!node) {
    return notFound();
  }

  return (
    <GraphPage
      params={{
        path: [node.id],
      }}
    ></GraphPage>
  );
}

export default Page;
