import { redirect } from "next/navigation";

import { ViewType } from "@/app/view/ViewType";

export default function Page() {
  redirect(ViewType.GRAPH + "/home");
}
