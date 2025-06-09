import { NextResponse } from "next/server";

export function middleware(request: Request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("mew-url", request.url);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}
