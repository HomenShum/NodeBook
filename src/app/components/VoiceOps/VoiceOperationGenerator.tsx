"use client";

import { observer } from "mobx-react-lite";
import { useState } from "react";

import { useGraphStore } from "@/app/contexts/GraphStoreContext";
import { TxCombinedPart } from "@/app/graph/GraphTransactionTypes";

export const VoiceOperationGenerator = observer(() => {
  const graphStore = useGraphStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [operations, setOperations] = useState<{
    simpleOperations: TxCombinedPart[];
    complexOperations: TxCombinedPart[];
  } | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Function to generate tree text representation of the graph
  const generateTreeText = (node: any, depth: number = 0, visited = new Set<string>(), maxDepth = 5): string => {
    if (visited.has(node.id) || depth > maxDepth) return "";
    visited.add(node.id);

    const indent = "  ".repeat(depth);
    const bar = depth > 0 ? "- " : "";
    let result = `${indent}${bar}${node.text || "Untitled"} (${node.id})\n`;
    const maxHorizRelations = 30;
    if (depth < maxDepth) {
      const childRelations = node.relations.filter((r: any) => r.from.id === node.id);
      for (const relation of childRelations.slice(0, maxHorizRelations)) {
        const childNode = relation.to;
        if (childNode && typeof childNode === "object") {
          result += generateTreeText(childNode, depth + 1, visited, maxDepth);
        }
      }
    }

    return result;
  };

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
      setTranscript(null);
      setOperations(null);
      setAudioChunks([]);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setError("Failed to start recording. Please make sure you have granted microphone permissions.");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorder) return;

    mediaRecorder.onstop = async () => {
      try {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

        // First, get the transcription
        const formData = new FormData();
        formData.append("audio", audioBlob, "audio.webm");

        const transcriptionResponse = await fetch("/api/transcription/audio-only", {
          method: "POST",
          body: formData,
        });

        if (!transcriptionResponse.ok) {
          throw new Error("Transcription failed");
        }

        const { transcript } = await transcriptionResponse.json();
        setTranscript(transcript);

        // Then, generate operations from the transcript
        const treeText = generateTreeText(graphStore.userRoot);
        const operationsResponse = await fetch("/api/operation-generator", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: transcript,
            treeText,
          }),
        });

        if (!operationsResponse.ok) {
          const data = await operationsResponse.json();
          throw new Error(data.details || data.error || "Failed to generate operations");
        }

        const operations = await operationsResponse.json();
        setOperations(operations);
      } catch (error) {
        console.error("Processing error:", error);
        setError(error instanceof Error ? error.message : "Failed to process audio");
      } finally {
        setIsProcessing(false);
      }
    };

    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    setMediaRecorder(null);
  };

  const handleApplyOperations = () => {
    if (!operations) return;

    try {
      // Combine simple and complex operations
      const allOperations = [...operations.simpleOperations, ...operations.complexOperations];
      graphStore.applyCombinedTransaction(allOperations);

      // Clear the state
      setTranscript(null);
      setOperations(null);
    } catch (err) {
      console.error("Failed to apply operations:", err);
      setError(err instanceof Error ? err.message : "Failed to apply operations");
    }
  };

  const renderOperation = (op: TxCombinedPart) => {
    const descriptions: Record<string, string> = {
      addNode: "Create new node",
      addChildNode: "Create new child node",
      updateNode: "Update node",
      removeNode: "Delete node",
      addRelationType: "Create new relation type",
      addRelation: "Create new relation",
      updateRelation: "Update relation",
      removeRelation: "Delete relation",
      replaceRelationLink: "Replace relation link",
      setIsPublic: "Change visibility",
      pinRelation: "Pin relation",
      updateRelationPositionsList: "Reorder relations",
      addRelationToList: "Add to relation list",
      removeRelationFromList: "Remove from relation list",
    };

    const getParentNodeInfo = (parentId: string) => {
      const node = graphStore.getNode(parentId);
      if (!node) return null;
      return {
        title: node.text || "Untitled",
        id: node.id,
      };
    };

    return (
      <div className="operation-item border-b border-gray-200 py-2">
        <div className="font-medium">{descriptions[op.type] || op.type}</div>
        {op.type === "addChildNode" && (
          <div className="text-sm text-gray-500 mt-1">
            {(() => {
              const parentInfo = getParentNodeInfo(op.transaction.parentId);
              return parentInfo ? (
                <span>
                  Under parent node: {parentInfo.title} ({parentInfo.id})
                </span>
              ) : (
                <span>Parent node not found</span>
              );
            })()}
          </div>
        )}
        <pre className="text-sm text-gray-600 overflow-x-auto mt-2">{JSON.stringify(op.transaction, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`px-4 py-2 rounded-full ${
            isRecording ? "bg-red-500 hover:bg-red-600" : isProcessing ? "bg-gray-300" : "bg-blue-500 hover:bg-blue-600"
          } text-white`}
        >
          {isRecording ? "Stop Recording" : isProcessing ? "Processing..." : "Start Recording"}
        </button>

        {isRecording && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">Recording...</span>
          </div>
        )}
      </div>

      {error && <div className="text-red-500 p-2 border border-red-300 rounded bg-red-50">{error}</div>}

      {transcript && (
        <div className="space-y-2">
          <h3 className="font-semibold">Transcription:</h3>
          <div className="p-3 bg-gray-50 rounded border">{transcript}</div>
        </div>
      )}

      {operations && (
        <div className="space-y-4">
          <div className="border rounded-md p-4">
            <h3 className="font-semibold mb-2">Simple Operations:</h3>
            <div className="space-y-2">
              {operations.simpleOperations.map((op, i) => (
                <div key={i}>{renderOperation(op)}</div>
              ))}
            </div>
          </div>

          {operations.complexOperations.length > 0 && (
            <div className="border rounded-md p-4">
              <h3 className="font-semibold mb-2">Complex Operations:</h3>
              <div className="space-y-2">
                {operations.complexOperations.map((op, i) => (
                  <div key={i}>{renderOperation(op)}</div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleApplyOperations}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Apply Operations
          </button>
        </div>
      )}
    </div>
  );
});
