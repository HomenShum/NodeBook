"use client";

import { createContext, ReactNode, useContext, useState } from "react";

type VoiceInputContextType = {
  isVoiceInputMode: boolean;
  setVoiceInputMode: (isActive: boolean) => void;
  transcript: string | null;
  setTranscript: (text: string | null) => void;
};

const VoiceInputContext = createContext<VoiceInputContextType | undefined>(undefined);

export function VoiceInputProvider({ children }: { children: ReactNode }) {
  const [isVoiceInputMode, setVoiceInputMode] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);

  return (
    <VoiceInputContext.Provider value={{ isVoiceInputMode, setVoiceInputMode, transcript, setTranscript }}>
      {children}
    </VoiceInputContext.Provider>
  );
}

export function useVoiceInput() {
  const context = useContext(VoiceInputContext);
  if (context === undefined) {
    throw new Error("useVoiceInput must be used within a VoiceInputProvider");
  }
  return context;
}
