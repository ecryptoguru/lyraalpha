"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "connecting" | "active" | "error";

export type VoiceTranscript = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

interface UseMyraVoiceOptions {
  onTranscript: (t: VoiceTranscript) => void;
}

interface VoiceSessionData {
  mode: "ephemeral";
  ephemeralKey?: string;
  wssUrl: string;
  model: string;
  voice?: string;
  instructions?: string;
}

// Ephemeral keys on OpenAI have ~60s TTL — use 55s to stay safe
const SESSION_CACHE_TTL_MS = 55_000;
// Auto-stop: seconds of silence after Myra finishes speaking a REAL (non-greeting) turn
// Keep this generous so the session doesn't end during normal thinking pauses.
const SILENCE_TIMEOUT_MS = 45_000;
// Closing phrases in Myra's response that signal a natural conversation end
const CLOSING_PHRASES = [
  "goodbye", "bye!", "bye.", "take care", "see you",
  "that's all", "have a great", "have a good",
];

export function useMyraVoice({ onTranscript }: UseMyraVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stateRef = useRef<VoiceState>("idle");
  const sessionRef = useRef<import("@openai/agents/realtime").RealtimeSession | null>(null);
  const pendingSessionRef = useRef<import("@openai/agents/realtime").RealtimeSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const inputWorkletRef = useRef<AudioWorkletNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const inputSilentGainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Pre-fetched session token cache — populated by prefetchSession() on widget mount
  const sessionCacheRef = useRef<{ data: VoiceSessionData; fetchedAt: number } | null>(null);

  // Deduplication — tracks ids we've already emitted as bubbles
  const emittedIds = useRef<Set<string>>(new Set());

  // Greeting suppression
  const greetingSeedId = useRef<string | null>(null);
  // True during the greeting turn — suppresses its transcript bubble.
  // IMPORTANT: must be cleared in response.output_audio_transcript.done BEFORE the !text check,
  // otherwise an empty transcript event leaves it stuck true and suppresses all future bubbles.
  const greetingActiveRef = useRef(false);
  // True until the greeting's response.done fires — prevents silence timer from starting too early
  const greetingResponsePendingRef = useRef(false);

  // Silence auto-stop timer
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const cleanupMedia = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
    try { inputWorkletRef.current?.disconnect(); } catch {}
    try { inputSourceRef.current?.disconnect(); } catch {}
    try { inputSilentGainRef.current?.disconnect(); } catch {}
    try { inputAudioCtxRef.current?.close(); } catch {}
    try { outputAudioCtxRef.current?.close(); } catch {}
    inputWorkletRef.current = null;
    inputSourceRef.current = null;
    inputSilentGainRef.current = null;
    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const closeSession = useCallback(() => {
    clearSilenceTimer();
    const active = sessionRef.current;
    const pending = pendingSessionRef.current;
    if (active) { try { active.close(); } catch {} sessionRef.current = null; }
    if (pending && pending !== active) { try { pending.close(); } catch {} pendingSessionRef.current = null; }
    emittedIds.current.clear();
    greetingSeedId.current = null;
    greetingActiveRef.current = false;
    greetingResponsePendingRef.current = false;
    cleanupMedia();
  }, [cleanupMedia, clearSilenceTimer]);

  const stopVoice = useCallback(() => {
    closeSession();
    setState("idle");
    setErrorMessage(null);
  }, [closeSession]);

  const stopVoiceRef = useRef(stopVoice);
  useEffect(() => { stopVoiceRef.current = stopVoice; }, [stopVoice]);

  // ── Pre-fetch ──────────────────────────────────────────────────────────────
  // Call on widget mount to eliminate the 2-3s API round-trip on first mic click.
  const prefetchSession = useCallback(async () => {
    const cached = sessionCacheRef.current;
    if (cached && Date.now() - cached.fetchedAt < SESSION_CACHE_TTL_MS) return;
    try {
      const res = await fetch("/api/support/voice-session");
      if (!res.ok) return;
      const data: VoiceSessionData = await res.json();
      sessionCacheRef.current = { data, fetchedAt: Date.now() };
    } catch {
      // Silently swallow — startVoice will fetch fresh on mic click
    }
  }, []);

  const startVoice = useCallback(async () => {
    if (stateRef.current !== "idle" && stateRef.current !== "error") return;
    setState("connecting");
    setErrorMessage(null);
    closeSession();

    let acquiredStream: MediaStream | null = null;

    try {
      const cached = sessionCacheRef.current;
      const isCacheFresh = cached !== null && Date.now() - cached.fetchedAt < SESSION_CACHE_TTL_MS;

      const [sessionData, mediaStream] = await Promise.all([
        isCacheFresh
          ? Promise.resolve(cached!.data)
          : fetch("/api/support/voice-session").then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? `Session fetch failed (${res.status})`);
              }
              const data: VoiceSessionData = await res.json();
              sessionCacheRef.current = { data, fetchedAt: Date.now() };
              return data;
            }),
        navigator.mediaDevices.getUserMedia({ audio: true }).catch((micErr: unknown) => {
          const name = micErr instanceof Error ? (micErr as { name?: string }).name : "";
          if (name === "NotAllowedError" || name === "PermissionDeniedError")
            throw new Error("Microphone access denied — please allow microphone in your browser settings and try again");
          if (name === "NotFoundError" || name === "DevicesNotFoundError")
            throw new Error("No microphone found — please connect a microphone and try again");
          if (name === "NotReadableError" || name === "TrackStartError")
            throw new Error("Microphone is in use by another app — please close it and try again");
          throw micErr;
        }),
      ]);

      acquiredStream = mediaStream;

      const { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebSocket } = await import("@openai/agents/realtime");
      const voice = sessionData.voice ?? "marin";

      const agent = new RealtimeAgent({ name: "Myra", voice });
      mediaStreamRef.current = mediaStream;
      acquiredStream = null;

      const transport = new OpenAIRealtimeWebSocket({ url: sessionData.wssUrl });
      const session = new RealtimeSession(agent, {
        transport,
        tracingDisabled: true,
        config: {
          outputModalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              transcription: { model: "gpt-4o-mini-transcribe" },
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: {
              format: { type: "audio/pcm", rate: 24000 },
              voice,
            },
          },
          voice,
          instructions: sessionData.instructions ?? "",
        },
      });

      inputAudioCtxRef.current = new AudioContext({ sampleRate: 24_000 });
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24_000 });
      if (inputAudioCtxRef.current.state === "suspended") {
        await inputAudioCtxRef.current.resume().catch(() => undefined);
      }
      if (outputAudioCtxRef.current.state === "suspended") {
        await outputAudioCtxRef.current.resume().catch(() => undefined);
      }
      nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;

      await inputAudioCtxRef.current.audioWorklet.addModule("/worklets/mic-processor.js");

      const source = inputAudioCtxRef.current.createMediaStreamSource(mediaStream);
      inputSourceRef.current = source;
      const worklet = new AudioWorkletNode(inputAudioCtxRef.current, "mic-processor");
      inputWorkletRef.current = worklet;
      const silentGain = inputAudioCtxRef.current.createGain();
      silentGain.gain.value = 0;
      inputSilentGainRef.current = silentGain;
      worklet.port.onmessage = (evt) => {
        if (!sessionRef.current && !pendingSessionRef.current) return;
        const pcm = floatToPcm16(new Float32Array(evt.data as ArrayBuffer));
        session.sendAudio(pcm);
      };
      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(inputAudioCtxRef.current.destination);

      session.on("audio", (event: { data: ArrayBuffer }) => {
        const outputCtx = outputAudioCtxRef.current;
        if (!outputCtx) return;
        const pcm = new Int16Array(event.data);
        const buffer = outputCtx.createBuffer(1, pcm.length, 24_000);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768;
        const src = outputCtx.createBufferSource();
        src.buffer = buffer;
        src.connect(outputCtx.destination);
        const when = Math.max(nextPlayTimeRef.current, outputCtx.currentTime);
        src.start(when);
        nextPlayTimeRef.current = when + buffer.duration;
      });

      session.on("audio_interrupted", () => {
        if (outputAudioCtxRef.current) nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
      });

      session.on("transport_event", (event: Record<string, unknown>) => {
        const type = event.type;

        // ── Silence auto-stop ──────────────────────────────────────────────
        if (type === "input_audio_buffer.speech_started") {
          // User started speaking — cancel silence timer
          clearSilenceTimer();
        }

        if (type === "response.done") {
          // Safety: always clear greetingActiveRef here in case
          // response.output_audio_transcript.done never fired (e.g. empty transcript)
          const wasGreetingPending = greetingResponsePendingRef.current;
          greetingActiveRef.current = false;
          greetingResponsePendingRef.current = false;

          // Don't start the silence timer for the opening greeting turn.
          // Only arm it after a real conversation response.
          if (!wasGreetingPending) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              if (stateRef.current === "active") stopVoiceRef.current();
            }, SILENCE_TIMEOUT_MS);
          }
        }

        // ── Myra's spoken response ─────────────────────────────────────────
        if (type === "response.output_audio_transcript.done") {
          // CRITICAL: clear greetingActiveRef BEFORE checking text.
          // If text is empty and we return early first, the flag stays true
          // forever and suppresses all future Myra bubbles.
          const wasGreeting = greetingActiveRef.current;
          greetingActiveRef.current = false;

          const itemId = typeof event.item_id === "string" ? event.item_id : `myra-${Date.now()}`;
          const text = typeof event.transcript === "string" ? event.transcript.trim() : "";

          // Suppress the greeting bubble or empty transcript
          if (wasGreeting || !text) return;

          const key = `assistant:${itemId}`;
          if (emittedIds.current.has(key)) return;
          emittedIds.current.add(key);
          onTranscriptRef.current({ id: `myra-${itemId}`, role: "assistant", text });

          // Auto-stop on natural closing phrases
          const lower = text.toLowerCase();
          if (CLOSING_PHRASES.some((p) => lower.includes(p))) {
            setTimeout(() => { if (stateRef.current === "active") stopVoiceRef.current(); }, 2_500);
          }
          return;
        }

        // ── User speech transcription ──────────────────────────────────────
        // OpenAI Realtime emits this when input transcription is enabled in session config.
        if (type === "conversation.item.input_audio_transcription.completed") {
          const itemId = typeof event.item_id === "string" ? event.item_id : "";
          const text =
            typeof event.transcript === "string" ? event.transcript.trim() : "";

          if (!text || !itemId) return;
          if (itemId === greetingSeedId.current) return;

          const key = `user:${itemId}`;
          if (emittedIds.current.has(key)) return;
          emittedIds.current.add(key);
          onTranscriptRef.current({ id: itemId, role: "user", text });
          return;
        }

        // ── User speech indicator fallback ─────────────────────────────────
        // If transcription.completed never fires (short utterance / network),
        // show a mic indicator after a 1.5s delay (time for .completed to arrive).
        if (type === "input_audio_buffer.speech_stopped") {
          const approxId = `speech-${Date.now()}`;
          setTimeout(() => {
            const recentUserBubble = [...emittedIds.current].some(
              (k) => k.startsWith("user:") && !k.startsWith("user:speech-")
            );
            const key = `user:${approxId}`;
            if (!recentUserBubble && !emittedIds.current.has(key)) {
              emittedIds.current.add(key);
              onTranscriptRef.current({ id: approxId, role: "user", text: "🎤" });
            }
          }, 1_500);
        }
      });

      session.on("error", (err: { type: string; error: unknown; message?: string }) => {
        const rawErr = err.error ?? err;
        const msg =
          rawErr instanceof Error ? rawErr.message
            : typeof (rawErr as { message?: string }).message === "string"
            ? (rawErr as { message?: string }).message!
            : typeof rawErr === "string" ? rawErr
            : JSON.stringify(rawErr).slice(0, 200);
        console.error("[Myra voice] session error:", err);
        setErrorMessage(msg ?? "Voice session error");
        setState("error");
        if (sessionRef.current === session) sessionRef.current = null;
        if (pendingSessionRef.current === session) pendingSessionRef.current = null;
        cleanupMedia();
      });

      pendingSessionRef.current = session;

      await session.connect({
        apiKey: sessionData.ephemeralKey ?? "",
        url: sessionData.wssUrl,
        model: sessionData.model,
      });

      if (pendingSessionRef.current !== session) {
        try { session.close(); } catch {}
        cleanupMedia();
        return;
      }

      pendingSessionRef.current = null;
      sessionRef.current = session;
      setState("active");

      // ── Opening greeting ───────────────────────────────────────────────────
      // Speak the exact opening line client-side so it is deterministic and
      // does not depend on model phrasing.
      const GREETING_ITEM_ID = "__myra_greeting_seed__";
      greetingSeedId.current = GREETING_ITEM_ID;
      greetingActiveRef.current = true;
      greetingResponsePendingRef.current = true;
      const openingStatement = "Hi, I am Myra. How can I help you today?";
      onTranscriptRef.current({ id: GREETING_ITEM_ID, role: "assistant", text: openingStatement });
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(openingStatement);
          utterance.lang = "en-IN";
          utterance.rate = 0.98;
          utterance.pitch = 1;
          utterance.volume = 1;
          window.speechSynthesis.speak(utterance);
        }
      } catch (speechErr) {
        console.warn("[Myra voice] opening greeting speech synthesis failed:", speechErr);
      }

    } catch (err) {
      acquiredStream?.getTracks().forEach((t) => t.stop());
      // Invalidate cache on error — token may have expired
      sessionCacheRef.current = null;
      console.error("[Myra voice] startVoice error:", err);
      const msg = err instanceof Error ? err.message : "Failed to start voice session";
      setErrorMessage(msg);
      setState("error");
      closeSession();
    }
  }, [cleanupMedia, closeSession, clearSilenceTimer]);

  useEffect(() => {
    return () => { closeSession(); };
  }, [closeSession]);

  return { state, startVoice, stopVoice, prefetchSession, errorMessage };
}

function floatToPcm16(float32: Float32Array): ArrayBuffer {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
  }
  return out.buffer;
}
