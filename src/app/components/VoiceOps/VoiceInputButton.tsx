"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/app/components/UIPrimitives/Button";
import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { useVoiceInput } from "@/app/contexts/VoiceInputContext";
import { useToast } from "@/app/hooks/useToast";
import { cn } from "@/lib/utils";

export function VoiceInputButton() {
  const { isVoiceInputMode, setVoiceInputMode, transcript, setTranscript } = useVoiceInput();
  const { addToast } = useToast();
  const graphStore = useGraphStore();
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Handle cleanup when voice mode is turned off
  useEffect(() => {
    if (!isVoiceInputMode && mediaRecorder) {
      stopRecording();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isVoiceInputMode, mediaRecorder, timeoutId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        setAudioChunks((current) => [...current, event.data]);
      };

      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError(null);

      // Set 60-second timeout to automatically stop recording
      const timeout = setTimeout(() => {
        if (isRecording) {
          stopRecording();
          setVoiceInputMode(false);
          // Toast notification
          addToast({
            title: "Voice input timeout",
            description: "Voice input timed out after 60 seconds.",
          });
        }
      }, 60000);
      setTimeoutId(timeout);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError("Failed to start recording. Please make sure you have granted microphone permissions.");
      setVoiceInputMode(false);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorder) return;

    // Clear the timeout if it exists
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }

    mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

        // Send to our backend for transcription
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        const response = await fetch("/api/transcription/audio-only", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Transcription failed");
        }

        const { transcript: transcriptText } = await response.json();
        setTranscript(transcriptText);

        // Add the transcribed text to My Stream with voice input tag
        if (transcriptText && transcriptText.trim()) {
          const timestamp = new Date().toISOString();
          const taggedText = `${transcriptText.trim()} #voice-input ${timestamp}`;

          await graphStore.addChildNode({
            parentId: graphStore.myStreamNodeId,
            nodeProps: {
              content: [{ type: "text", value: taggedText }],
            },
          });
        }
      } catch (error) {
        console.error("Transcription error:", error);
        setError("Failed to transcribe audio. Please try again.");
      }
    };

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    setMediaRecorder(null);
    setAudioChunks([]);
  };

  const toggleVoiceMode = () => {
    // If turning off voice mode, stop any active recording
    if (isVoiceInputMode && isRecording) {
      stopRecording();
    }
    // Update the mode state
    setVoiceInputMode(!isVoiceInputMode);
  };

  // When voice mode is activated, start recording
  useEffect(() => {
    if (isVoiceInputMode && !isRecording) {
      startRecording();
    }
  }, [isVoiceInputMode]);

  return (
    <Button
      size="sm"
      variant={isVoiceInputMode ? "active" : "default"}
      onClick={toggleVoiceMode}
      className={cn("show-tooltip bottom-align")}
      data-tooltip={isVoiceInputMode ? "Turn off voice input" : "Turn on voice input"}
    >
      {isVoiceInputMode ? <Mic className="text-red-500" size={14} /> : <MicOff size={14} />}
      <span>{isVoiceInputMode ? "Voice On" : "Voice Off"}</span>
    </Button>
  );
}
