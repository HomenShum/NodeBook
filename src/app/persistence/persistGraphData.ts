import { env } from "@/app/envFrontend";

export function persistGraphData(dataString: string) {
  if (env.persistTo === "local") {
    localStorage.setItem("data", dataString);
  } else if (env.persistTo === "server") {
    fetch("/api/persist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: dataString }),
    });
  } else {
    return env.persistTo satisfies never;
  }
}
