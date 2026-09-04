"use client";

import { useEffect, useRef, useCallback } from "react";

type MessageHandler = (data: any) => void;

// Simple polling-based real-time (SSE-compatible alternative to Socket.io for Next.js 16)
export function useRealtimeMessages(onNewMessage: MessageHandler, onNewComment: MessageHandler) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Use SSE (Server-Sent Events) as a lightweight real-time mechanism
    const es = new EventSource("/api/realtime");
    eventSourceRef.current = es;

    es.addEventListener("new_message", (e) => {
      try { onNewMessage(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener("new_comment", (e) => {
      try { onNewComment(JSON.parse(e.data)); } catch {}
    });

    es.onerror = () => {
      console.warn("[SSE] Connection error, will retry automatically");
    };

    return () => {
      es.close();
    };
  }, [onNewMessage, onNewComment]);
}
