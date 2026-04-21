"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientLogger } from "@/lib/logger/client";

const logger = createClientLogger("myra-voice");

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
  currentPage?: string;
}

// Ephemeral keys on OpenAI have ~60s TTL — use 55s to stay safe
const SESSION_CACHE_TTL_MS = 55_000;
// Auto-stop: milliseconds of silence after Myra finishes speaking a REAL (non-greeting) turn
// Keep this generous so the session doesn't end during normal thinking pauses.
const SILENCE_TIMEOUT_MS = 45_000;
// Closing phrases in Myra's response that signal a natural conversation end
const CLOSING_PHRASES = [
  "goodbye", "bye!", "bye.", "take care", "see you",
  "that's all", "have a great", "have a good",
];

// V-INJ: Client-side injection pattern detection for voice transcripts.
// Lightweight subset of server-side INJECTION_PATTERNS (guardrails.ts) — runs client-side
// to log warnings when user speech matches known injection patterns. This is defense-in-depth;
// the Realtime API receives audio directly, so we can't block it, but we can detect and log.
const VOICE_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions|prompts?|rules)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /new\s+instructions?\s*:/i,
  /forget\s+(all\s+)?(your|previous|the)\s+/i,
  /pretend\s+(you\s+are|to\s+be)\s+/i,
  /act\s+as\s+(if\s+you|a)\s+/i,
  /override\s+(your|the|all)\s+/i,
  /disregard\s+(your|the|all|previous)\s+/i,
  /\[system\]/i,
  /<\/?(system|instructions|prompt)>/i,
];

function checkVoiceInjection(text: string): boolean {
  return VOICE_INJECTION_PATTERNS.some((p) => p.test(text));
}

// PII-1: Client-side PII redaction for voice transcripts.
// Redacts emails, phone numbers, and Clerk user IDs before emitting to the UI chat bubble.
// Pure regex — no server dependencies needed. Matches server-side patterns in pii-scrub.ts.
const CLIENT_PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, replacement: "[email]" },
  { pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}\b/g, replacement: "[phone]" },
  { pattern: /\buser_[a-zA-Z0-9]{10,30}\b/g, replacement: "[user-id]" },
];

function redactPII(text: string): string {
  let result = text;
  for (const { pattern, replacement } of CLIENT_PII_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function useMyraVoice({ onTranscript }: UseMyraVoiceOptions) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // UX: isThinking = model is generating but hasn't started speaking yet (dead-air gap)
  const [isThinking, setIsThinking] = useState(false);
  // UX: isSpeaking = Myra's audio is actively playing
  const [isSpeaking, setIsSpeaking] = useState(false);
  // UX: silenceCountdown = seconds remaining before auto-stop (null when not counting)
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  // UX: micLevel = current microphone input level (0-1) for visual feedback
  const [micLevel, setMicLevel] = useState(0);

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

  // True until the greeting's response.done fires — prevents silence timer from starting too early
  const greetingResponsePendingRef = useRef(false);

  // Silence auto-stop timer
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Silence countdown interval — ticks every 1s to update UI
  const silenceCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceDeadlineRef = useRef<number>(0); // timestamp when silence timer fires

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const cleanupMedia = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    try { inputWorkletRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { inputSourceRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { inputSilentGainRef.current?.disconnect(); } catch { /* already disconnected */ }
    try { inputAudioCtxRef.current?.close(); } catch { /* already closed */ }
    try { outputAudioCtxRef.current?.close(); } catch { /* already closed */ }
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
    if (silenceCountdownRef.current) {
      clearInterval(silenceCountdownRef.current);
      silenceCountdownRef.current = null;
    }
    silenceDeadlineRef.current = 0;
    setSilenceCountdown(null);
  }, []);

  const closeSession = useCallback(() => {
    clearSilenceTimer();
    const active = sessionRef.current;
    const pending = pendingSessionRef.current;
    if (active) { try { active.close(); } catch { /* session already closed */ } sessionRef.current = null; }
    if (pending && pending !== active) { try { pending.close(); } catch { /* session already closed */ } pendingSessionRef.current = null; }
    emittedIds.current.clear();
    greetingResponsePendingRef.current = false;
    cleanupMedia();
    // Fire-and-forget: tell the backend to release the concurrency lock so
    // the user can immediately start a new session. Safe to call even if
    // no session was ever started (backend will simply return released:false).
    fetch("/api/support/voice-session", { method: "DELETE" }).catch(() => { /* ignore */ });
  }, [cleanupMedia, clearSilenceTimer]);

  const stopVoice = useCallback(() => {
    closeSession();
    setState("idle");
    setErrorMessage(null);
    setIsThinking(false);
    setIsSpeaking(false);
  }, [closeSession]);

  // UX: Reset the silence auto-stop timer — called when user taps the
  // "Ending in Xs" countdown warning to keep the session alive.
  const keepAlive = useCallback(() => {
    if (stateRef.current !== "active") return;
    clearSilenceTimer();
    const deadline = Date.now() + SILENCE_TIMEOUT_MS;
    silenceDeadlineRef.current = deadline;
    silenceTimerRef.current = setTimeout(() => {
      if (stateRef.current === "active") stopVoiceRef.current();
    }, SILENCE_TIMEOUT_MS);
    silenceCountdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((silenceDeadlineRef.current - Date.now()) / 1000));
      setSilenceCountdown(remaining > 0 ? remaining : null);
      if (remaining <= 0) {
        if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);
        silenceCountdownRef.current = null;
      }
    }, 1000);
  }, [clearSilenceTimer]);

  const stopVoiceRef = useRef(stopVoice);
  useEffect(() => { stopVoiceRef.current = stopVoice; }, [stopVoice]);

  // ── Pre-fetch ──────────────────────────────────────────────────────────────
  // Call on widget mount to eliminate the 2-3s API round-trip on first mic click.
  const prefetchSession = useCallback(async () => {
    const cached = sessionCacheRef.current;
    if (cached && Date.now() - cached.fetchedAt < SESSION_CACHE_TTL_MS) return;
    try {
      const page = typeof window !== "undefined" ? window.location.pathname : undefined;
      const url = page ? `/api/support/voice-session?page=${encodeURIComponent(page)}` : "/api/support/voice-session";
      const res = await fetch(url);
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
          : fetch(typeof window !== "undefined"
              ? `/api/support/voice-session?page=${encodeURIComponent(window.location.pathname)}`
              : "/api/support/voice-session").then(async (res) => {
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? `Session fetch failed (${res.status})`);
              }
              const data: VoiceSessionData = await res.json();
              sessionCacheRef.current = { data, fetchedAt: Date.now() };
              return data;
            }),
        // Enumerate devices to find a real microphone. The browser may default
        // to a virtual audio device (e.g. BlackHole on macOS) which produces
        // silence unless audio is explicitly routed through it.
        (async () => {
          const VIRTUAL_KEYWORDS = ["blackhole", "soundflower", "vb-audio", "virtual", "cable", "loopback", "vb cable"];
          const isVirtual = (label: string) =>
            VIRTUAL_KEYWORDS.some((kw) => label.toLowerCase().includes(kw));

          try {
            // Need a temporary stream to get device labels (otherwise they're empty)
            const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            tmpStream.getTracks().forEach((t) => t.stop());

            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter((d) => d.kind === "audioinput");

            // Try to find a real (non-virtual) microphone
            const realMic = audioInputs.find((d) => d.label && !isVirtual(d.label));
            if (realMic) {
              logger.info("Selecting real mic", { label: realMic.label, deviceId: `${realMic.deviceId.slice(0, 8)}…` });
              return navigator.mediaDevices.getUserMedia({
                audio: {
                  deviceId: { exact: realMic.deviceId },
                  echoCancellation: true,
                  noiseSuppression: false,
                  autoGainControl: false,
                },
              });
            }
            // No real mic found — fall through to default
            if (audioInputs.length > 0) {
              logger.warn(`No real mic found among ${audioInputs.length} devices, using default (may be virtual)`);
            }
          } catch (e) {
            logger.warn("Device enumeration failed, using default", { error: e });
          }

          // Fallback: use default device with echoCancellation
          return navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: false,
              autoGainControl: false,
            },
          });
        })().catch((micErr: unknown) => {
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

      const agent = new RealtimeAgent({
        name: "Myra",
        voice,
        instructions: sessionData.instructions ?? "",
      });
      mediaStreamRef.current = mediaStream;
      acquiredStream = null;

      const transport = new OpenAIRealtimeWebSocket({ url: sessionData.wssUrl });
      const session = new RealtimeSession(agent, {
        transport,
        tracingDisabled: true,
        config: {
          outputModalities: ["audio"],
          // Pass max_output_tokens via providerData since the SDK config type
          // doesn't expose it. Caps each spoken reply at ~5-7 sentences,
          // controlling audio output cost ($20/M tokens).
          providerData: { max_output_tokens: 350 },
          audio: {
            input: {
              format: { type: "audio/pcm", rate: 24000 },
              transcription: {
                model: "gpt-4o-mini-transcribe",
                prompt: "Transcribe ONLY in English, Hinglish, or Hindi. NEVER output Urdu script or Urdu vocabulary — if the speech sounds like Urdu, transcribe it as Hindi instead. Preserve code-switching across English, Hinglish, and Hindi. Keep product names in English. If the speech mixes languages, keep the transcript in English, Hinglish, or Hindi only.",
              },
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
        },
      });

      inputAudioCtxRef.current = new AudioContext({ sampleRate: 24_000 });
      outputAudioCtxRef.current = new AudioContext({ sampleRate: 24_000 });

      // CRITICAL: Resume AudioContexts BEFORE using them. Browsers suspend
      // AudioContexts created before user gesture — must explicitly resume.
      if (inputAudioCtxRef.current.state === "suspended") {
        await inputAudioCtxRef.current.resume();
      }
      if (outputAudioCtxRef.current.state === "suspended") {
        await outputAudioCtxRef.current.resume();
      }
      logger.info("AudioContext sample rates", {
        inputSampleRate: inputAudioCtxRef.current.sampleRate,
        outputSampleRate: outputAudioCtxRef.current.sampleRate,
      });

      // Log MediaStream track state to verify mic is live
      const micTrack = mediaStream.getAudioTracks()[0];
      if (micTrack) {
        logger.info("Mic track state", {
          enabled: micTrack.enabled,
          readyState: micTrack.readyState,
          muted: micTrack.muted,
          label: micTrack.label,
        });
        // Warn if the selected device looks like a virtual audio driver
        // (BlackHole, Soundflower, VB-Audio, etc.) — these often produce
        // silence unless audio is explicitly routed through them.
        const label = micTrack.label.toLowerCase();
        const virtualKeywords = ["blackhole", "soundflower", "vb-audio", "virtual", "cable", "loopback"];
        if (virtualKeywords.some((kw) => label.includes(kw))) {
          logger.warn(`Selected mic "${micTrack.label}" appears to be a virtual audio device — it may produce silence`);
        }
      } else {
        logger.error("No audio track in MediaStream");
      }

      nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;

      await inputAudioCtxRef.current.audioWorklet.addModule("/worklets/mic-processor.js");

      const source = inputAudioCtxRef.current.createMediaStreamSource(mediaStream);
      inputSourceRef.current = source;
      const worklet = new AudioWorkletNode(inputAudioCtxRef.current, "mic-processor");
      inputWorkletRef.current = worklet;
      // Use a very small gain instead of 0 — some browsers optimize away
      // the entire audio path when gain is exactly 0, causing the worklet
      // to receive silence. 0.001 is inaudible but keeps the graph active.
      const silentGain = inputAudioCtxRef.current.createGain();
      silentGain.gain.value = 0.001;
      inputSilentGainRef.current = silentGain;
      let audioChunkCount = 0;
      let audioRmsSum = 0;
      let audioRmsCount = 0;
      let silenceWarningShown = false;
      let micLevelAccum = 0;
      let micLevelAccumCount = 0;
      worklet.port.onmessage = (evt) => {
        const activeSession = sessionRef.current ?? pendingSessionRef.current;
        if (!activeSession) return;
        const float32 = new Float32Array(evt.data as ArrayBuffer);
        const pcm = floatToPcm16(float32);
        activeSession.sendAudio(pcm);
        audioChunkCount++;
        // Compute RMS of the float32 samples to verify mic is producing real audio
        let sumSq = 0;
        for (let i = 0; i < float32.length; i++) sumSq += float32[i] * float32[i];
        const rms = Math.sqrt(sumSq / float32.length);
        audioRmsSum += rms;
        audioRmsCount++;
        // UX: Accumulate mic level for visual feedback — update state every ~30 chunks (~160ms)
        // to avoid excessive re-renders while still feeling responsive.
        micLevelAccum += rms;
        micLevelAccumCount++;
        if (micLevelAccumCount >= 30) {
          const avgLevel = Math.min(1, (micLevelAccum / micLevelAccumCount) * 5); // scale up for visibility
          setMicLevel(avgLevel);
          micLevelAccum = 0;
          micLevelAccumCount = 0;
        }
        if (audioChunkCount === 1) {
          logger.info("First audio chunk", { rms: rms.toFixed(4), samples: float32.length });
        } else if (audioChunkCount % 500 === 0) {
          const avgRms = audioRmsSum / audioRmsCount;
          logger.info(`Audio chunk ${audioChunkCount}`, { avgRms: avgRms.toFixed(4), transportStatus: activeSession.transport?.status ?? "unknown" });
          audioRmsSum = 0;
          audioRmsCount = 0;
          // After ~4s of audio (500 chunks × 128 samples / 24kHz), warn if mic is silent
          if (avgRms < 0.001 && !silenceWarningShown) {
            silenceWarningShown = true;
            logger.warn("Microphone is producing silence — check mic selection in browser settings");
            setErrorMessage("Microphone not detecting audio. Please check your mic selection in browser settings.");
            // Auto-clear the error after 5s so the session can continue
            setTimeout(() => {
              if (stateRef.current === "active") setErrorMessage(null);
            }, 5_000);
          }
        }
      };
      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(inputAudioCtxRef.current.destination);

      let hasReceivedAudio = false;
      session.on("audio", (event: { data: ArrayBuffer }) => {
        const outputCtx = outputAudioCtxRef.current;
        if (!outputCtx) return;
        // UX: First audio chunk means Myra started speaking — clear thinking indicator
        if (!hasReceivedAudio) {
          hasReceivedAudio = true;
          setIsThinking(false);
          setIsSpeaking(true);
        }
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
        setIsSpeaking(false);
        hasReceivedAudio = false;
      });

      session.on("transport_event", (event: Record<string, unknown>) => {
        const type = event.type;

        // ── Diagnostic logging for key events ─────────────────────────────
        if (type === "session.created" || type === "session.updated") {
          logger.info(`Realtime event: ${type}`);
        }
        if (type === "response.created") {
          logger.info("Response created — model is generating");
          setIsThinking(true);
          setIsSpeaking(false);
        }
        if (type === "input_audio_buffer.speech_started") {
          logger.info("User speech detected (VAD)");
        }
        if (type === "input_audio_buffer.speech_stopped") {
          logger.info("User speech ended (VAD)");
        }
        if (type === "error") {
          logger.error("Server error event", { event });
        }

        // ── Silence auto-stop ──────────────────────────────────────────────
        if (type === "input_audio_buffer.speech_started") {
          // User started speaking — cancel silence timer and reset thinking
          clearSilenceTimer();
          setIsThinking(false);
          setIsSpeaking(false);
          hasReceivedAudio = false;
        }

        if (type === "response.done") {
          const wasGreetingPending = greetingResponsePendingRef.current;
          greetingResponsePendingRef.current = false;
          logger.info("Response done", { wasGreetingPending });
          setIsThinking(false);
          setIsSpeaking(false);
          hasReceivedAudio = false;

          // Don't start the silence timer for the opening greeting turn.
          // Only arm it after a real conversation response.
          if (!wasGreetingPending) {
            clearSilenceTimer();
            const deadline = Date.now() + SILENCE_TIMEOUT_MS;
            silenceDeadlineRef.current = deadline;
            silenceTimerRef.current = setTimeout(() => {
              if (stateRef.current === "active") stopVoiceRef.current();
            }, SILENCE_TIMEOUT_MS);
            // UX: Countdown ticks every 1s — shows seconds remaining in UI
            silenceCountdownRef.current = setInterval(() => {
              const remaining = Math.max(0, Math.ceil((silenceDeadlineRef.current - Date.now()) / 1000));
              setSilenceCountdown(remaining > 0 ? remaining : null);
              if (remaining <= 0) {
                if (silenceCountdownRef.current) clearInterval(silenceCountdownRef.current);
                silenceCountdownRef.current = null;
              }
            }, 1000);
          }
        }

        // ── Myra's spoken response ─────────────────────────────────────────
        if (type === "response.output_audio_transcript.done") {
          const itemId = typeof event.item_id === "string" ? event.item_id : `myra-${Date.now()}`;
          const text = typeof event.transcript === "string" ? event.transcript.trim() : "";

          // Skip empty transcripts
          if (!text) return;

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

          // V-INJ: Check user transcript for injection patterns — defense-in-depth logging
          if (checkVoiceInjection(text)) {
            logger.warn("Injection pattern detected in user transcript — model should disregard via system prompt guardrails");
          }

          // PII-1: Redact PII from user transcript before emitting to UI
          const safeText = redactPII(text);

          const key = `user:${itemId}`;
          if (emittedIds.current.has(key)) return;
          emittedIds.current.add(key);
          onTranscriptRef.current({ id: itemId, role: "user", text: safeText });
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
        logger.error("Session error", { error: err });
        // Reset greeting pending so silence timer works for future responses
        greetingResponsePendingRef.current = false;
        setErrorMessage(msg ?? "Voice session error");
        setState("error");
        try { session.close(); } catch { /* session already closed */ }
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
        try { session.close(); } catch { /* session already closed */ }
        cleanupMedia();
        return;
      }

      pendingSessionRef.current = null;
      sessionRef.current = session;
      setState("active");

      // ── Opening greeting ───────────────────────────────────────────────────
      // Trigger the model to speak its opening greeting via the Realtime API
      // so it uses the same marin voice — no jarring browser TTS switch.
      //
      // CRITICAL: We must wait for the server to acknowledge session.updated
      // before sending response.create. The session.update (with instructions)
      // is sent during connect() but the server processes it asynchronously.
      // If response.create arrives before instructions are applied, the model
      // has no context for the greeting.
      //
      // We also pass an empty {} response object so the sequencer treats this
      // as a manual request (manual=true), preventing it from coalescing with
      // or blocking VAD-triggered auto-responses (semantic_vad create_response).
      greetingResponsePendingRef.current = true;

      const greetingFiredRef = { current: false };
      const fireGreeting = () => {
        if (greetingFiredRef.current) return;
        greetingFiredRef.current = true;
        try {
          session.transport.requestResponse?.({});
        } catch (e) {
          logger.warn("Greeting requestResponse failed", { error: e });
        }
      };

      // Listen for session.updated — the server has applied our instructions
      const onTransportEvent = (event: Record<string, unknown>) => {
        if (event.type === "session.updated") {
          fireGreeting();
        }
      };
      session.on("transport_event", onTransportEvent);

      // Safety fallback: if session.updated doesn't arrive within 2s,
      // fire the greeting anyway (the config was likely already applied).
      const greetingTimeout = setTimeout(() => {
        if (!greetingFiredRef.current) {
          logger.warn("session.updated not received within 2s, firing greeting anyway");
          fireGreeting();
        }
      }, 2_000);

      // Safety: if greeting response.done never arrives within 8s, clear the
      // pending flag so subsequent response.done events start the silence timer.
      const greetingPendingTimeout = setTimeout(() => {
        if (greetingResponsePendingRef.current) {
          logger.warn("Greeting response.done never received, clearing pending flag");
          greetingResponsePendingRef.current = false;
        }
      }, 8_000);

      // Clean up listener + timeouts when session closes
      const origClose = session.close.bind(session);
      session.close = () => {
        clearTimeout(greetingTimeout);
        clearTimeout(greetingPendingTimeout);
        try { session.off("transport_event", onTransportEvent); } catch { /* listener already removed */ }
        origClose();
      };

    } catch (err) {
      acquiredStream?.getTracks().forEach((t) => t.stop());
      // Invalidate cache on error — token may have expired
      sessionCacheRef.current = null;
      logger.error("StartVoice error", { error: err });
      const msg = err instanceof Error ? err.message : "Failed to start voice session";
      setErrorMessage(msg);
      setState("error");
      closeSession();
    }
  }, [cleanupMedia, closeSession, clearSilenceTimer]);

  useEffect(() => {
    return () => { closeSession(); };
  }, [closeSession]);

  return { state, startVoice, stopVoice, prefetchSession, errorMessage, isThinking, isSpeaking, silenceCountdown, keepAlive, micLevel };
}

function floatToPcm16(float32: Float32Array): ArrayBuffer {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
  }
  return out.buffer;
}
