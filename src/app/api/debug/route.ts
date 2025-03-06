import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");

  if (secret !== "8164") {
    return NextResponse.json({}, { status: 401 });
  }

  const timer = new Date().getTime();
  const socket = new WebSocket("wss://ep-misty-star-a44qvqht-pooler.us-east-1.aws.neon.tech/v2");

  const p = new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve(1);
    });

    socket.addEventListener("error", () => {
      reject(1);
    });
  });

  let message = "";

  try {
    await p;
    socket.close();
    message = "Connected to Neon";
  } catch (e) {
    message = "Failed to connect to Neon";
  }
  return NextResponse.json({
    message,
    debug: {
      version: process.version,
      time: Math.abs(timer - new Date().getTime()) / 1000 + "s",
    },
  });
}
