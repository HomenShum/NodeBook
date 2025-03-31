"use client";

import dynamic from "next/dynamic";

const VoiceOperationsList = dynamic(() => import("@/app/components/VoiceOps/VoiceOperationsList"), { ssr: false });

export default function VoiceOperationsPage() {
  return (
    <div className="w-full h-full overflow-auto">
      <VoiceOperationsList />
    </div>
  );
}
