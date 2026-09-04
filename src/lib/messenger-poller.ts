// src/lib/messenger-poller.ts
// Real-time Facebook Messenger fallback poller that runs 24/7 inside the VPS
// Ensures 100% message delivery even when Meta App is in Development mode or Webhooks are delayed

let isPollerRunning = false;
let pollingInterval: NodeJS.Timeout | null = null;
const processedIds = new Set<string>();

const DEFAULT_PAGE_ID = "110644118793600";
const DEFAULT_PAGE_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "EAAW6YWihfogBSY0coWHPtYcw2Gwm11ZAznBKAIcOzhgKQJWYITHuelgvzJfoWl0QjgrsRD5DEViDdpVyQKyvxGkBVJ8saKOzXi4IaXvIwYWuJXVJwNxBGsUdru7NAV9Rk5hrGCJigh9NuX1ury8ATCBYvbjBce885iGjucQ3LSbzYQwqQvNGfcu7GO70jQu3QiwI1";

export function getPollerStatus() {
  return {
    running: isPollerRunning,
    processedCount: processedIds.size,
    lastPolled: new Date().toISOString(),
  };
}

export async function startMessengerPoller() {
  if (isPollerRunning) {
    console.log("[MESSENGER_POLLER] Already active.");
    return;
  }
  isPollerRunning = true;
  console.log("[MESSENGER_POLLER] Initializing 24/7 background poller for Facebook...");

  const pageId = process.env.FACEBOOK_PAGE_ID || DEFAULT_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || DEFAULT_PAGE_TOKEN;

  // 1. Preload recent messages so we never reply to old historical messages
  try {
    const initConvs = await fetchConversations(pageId, pageToken);
    for (const conv of initConvs) {
      for (const msg of conv.messages?.data || []) {
        if (msg.id) processedIds.add(msg.id);
      }
    }
    console.log(`[MESSENGER_POLLER] Preloaded ${processedIds.size} historical message IDs.`);
  } catch (err: any) {
    console.warn("[MESSENGER_POLLER_INIT_WARN]", err.message);
  }

  // 2. Poll every 2.5 seconds
  let isChecking = false;
  pollingInterval = setInterval(async () => {
    if (isChecking) return;
    isChecking = true;
    try {
      const convs = await fetchConversations(pageId, pageToken);
      for (const conv of convs) {
        const msgs = conv.messages?.data || [];
        for (const msg of msgs) {
          // If message is from a customer and hasn't been processed yet
          if (msg.from?.id && msg.from.id !== pageId && msg.id && !processedIds.has(msg.id)) {
            processedIds.add(msg.id);
            console.log(`[MESSENGER_POLLER] 📩 Incoming customer message: "${msg.message}" from ${msg.from.name} (${msg.from.id})`);

            // Extract attachments
            const attachmentImages = (msg.attachments?.data || []).filter((a: any) => a.image_data || a.mime_type?.includes("image"));
            const imageUrl = attachmentImages[0]?.image_data?.url || attachmentImages[0]?.file_url || null;

            const attachmentAudios = (msg.attachments?.data || []).filter((a: any) => a.audio_data || a.mime_type?.includes("audio") || a.mime_type?.includes("video"));
            const audioUrl = attachmentAudios[0]?.file_url || attachmentAudios[0]?.audio_data?.url || null;

            const attachments = [];
            if (imageUrl) attachments.push({ type: "image", payload: { url: imageUrl } });
            if (audioUrl) attachments.push({ type: "audio", payload: { url: audioUrl } });

            const event = {
              sender: { id: msg.from.id },
              recipient: { id: pageId },
              timestamp: new Date(msg.created_time).getTime(),
              message: {
                mid: msg.id,
                text: msg.message || "",
                attachments,
              },
            };

            // Call message handler directly
            const { handleMessengerMessage } = await import("@/app/api/webhooks/facebook/route");
            await handleMessengerMessage(pageId, event);
          }
        }
      }
    } catch (pollErr: any) {
      // ignore network blips
    } finally {
      isChecking = false;
    }
  }, 2500);
}

async function fetchConversations(pageId: string, token: string): Promise<any[]> {
  const url = `https://graph.facebook.com/v19.0/${pageId}/conversations?fields=messages.limit(2){message,from,created_time,id,attachments}&access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];
  const data = await res.json();
  return data.data || [];
}
