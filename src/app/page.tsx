import { redirect } from "next/navigation";

import { createRouteUrl, ViewType } from "@/app/view/ViewType";

export default function Page() {
  redirect(createRouteUrl(ViewType.GRAPH, "home"));
}
