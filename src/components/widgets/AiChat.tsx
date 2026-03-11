/**
 * Cybernus AI Chat — cloud-only orchestrator.
 *
 * Manages: cloud streaming via xAI Grok, session memory, personality,
 * language, voice, MCP agents, search, TTS, Matrix theme, and the chat UI.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@lib/utils/cn';
import type { ChatMessage, AgentActivityItem, ChatForm, ChatFormOption } from '@lib/ai/types';
import {
  CLOUD_MODELS,
  DEFAULT_CLOUD_MODEL_ID,
  MAX_USER_MESSAGES,
  trimHistory,
} from '@lib/ai/config';
import { getToolsForModel, mapToolCallsToActions } from '@lib/ai/tools';
import {
  saveMessages,
  loadMessages,
  loadSessions,
  getActiveSessionId,
  setActiveSessionId,
  clearMessages,
  deleteSession,
  clearAllSessions,
} from '@lib/ai/memory';
import type { ChatSession } from '@lib/ai/memory';
import { createAgentActivity, completeAgentActivity } from '@lib/cybernus/services/AgentService';
import { ChatMessages } from '@components/ai/ChatMessages';
import { ChatInput } from '@components/ai/ChatInput';
import { ModelPicker } from '@components/ai/ModelPicker';
import { SessionHistory } from '@components/ai/SessionHistory';
import { ThoughtsPanel } from '@components/ai/ThoughtsPanel';
import { DebugPanel, createLogEntry } from '@components/ai/DebugPanel';
import type { DebugLogEntry, DebugState } from '@components/ai/DebugPanel';
import { SearchOverlay } from '@components/ai/SearchOverlay';
import { AgentPanel } from '@components/ai/AgentPanel';
import { MatrixRain } from '@components/ai/MatrixRain';
import { getPersonalityLevel, setPersonalityLevel, PERSONALITY_LEVELS } from '@lib/ai/personality';
import type { PersonalityLevel } from '@lib/ai/personality';
import { getLanguage, setLanguage as setStoredLanguage, LANGUAGES, t } from '@lib/ai/i18n';
import type { Language } from '@lib/ai/i18n';
import { VoiceSession, isVoiceSupported } from '@lib/ai/voice';
import type { VoiceState } from '@lib/ai/voice';
import { VideoChatView } from '@components/ai/VideoChatView';
import { VIDEO_CHAT_SYSTEM_PROMPT } from '@lib/ai/cloud-context';

interface AiChatProps {
  systemPrompt: string;
}

type EngineState = 'idle' | 'ready';

/** Config for the unified media generation loop (image & video). */
interface MediaGeneratorConfig {
  /** Tool call name from the API (e.g. 'generate_image'). */
  toolName: string;
  /** Agent activity type for inline display (e.g. 'image_generation'). */
  activityType: string;
  /** Async function that takes a prompt and returns markdown content. */
  generate: (prompt: string) => Promise<string>;
  /** Fallback text when generation fails. */
  failureText: string;
}

/** Maximum number of debug log entries to retain. */
const MAX_DEBUG_LOGS = 200;

/** Shared SVG path for the hamburger menu icon. */
const HAMBURGER_MENU_PATH = 'M3 12h18M3 6h18M3 18h18';

/** Check if a message is any translated welcome message. */
function isWelcomeMessage(content: string): boolean {
  return LANGUAGES.some((l) => t(l.code).welcome === content);
}

/** Main Cybernus chat component — cloud-only architecture with professional UI. */
export default function AiChat({ systemPrompt }: AiChatProps) {
  /* ─── Core state ─── */
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  /* ─── Cloud model ─── */
  const [selectedCloudModelId, setSelectedCloudModelId] = useState(DEFAULT_CLOUD_MODEL_ID);

  /* ─── Personality & Language ─── */
  const [personality, setPersonality] = useState<PersonalityLevel>(getPersonalityLevel);
  const [language, setLang] = useState<Language>(getLanguage);

  /* ─── Session history ─── */
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSession] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  /* ─── Search & Agent panel ─── */
  const [showSearch, setShowSearch] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<string[]>([]);

  /* ─── Video Chat mode ─── */
  const [isVideoChatMode, setIsVideoChatMode] = useState(false);

  /* ─── Voice state ─── */
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const voiceSessionRef = useRef<VoiceSession | null>(null);
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const handleVoiceToggleRef = useRef<(() => void) | null>(null);
  const sendMessageRef = useRef<
    ((text: string, options?: { displayText?: string; hidden?: boolean }) => void) | null
  >(null);
  const transcriptPreviewRef = useRef(transcriptPreview);
  transcriptPreviewRef.current = transcriptPreview;
  const inputRef_value = useRef(input);
  inputRef_value.current = input;

  /* ─── Debug state ─── */
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null);
  const [streamEndTime, setStreamEndTime] = useState<number | null>(null);
  const [apiRequestCount, setApiRequestCount] = useState(0);
  const [lastApiLatency, setLastApiLatency] = useState<number | null>(null);

  /* ─── Refs ─── */
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;
  /** Incremented on every session-changing operation (clear, switch, delete, clearAll)
   *  so the sendMessage abort handler can detect stale contexts even when
   *  activeSessionId is null on both sides (null === null). */
  const sessionGenRef = useRef(0);

  /** Pending form update from handleFormSubmit, applied atomically in sendMessage. */
  const pendingFormUpdateRef = useRef<{
    messageId: string;
    selectedId: string;
    customValue?: string;
  } | null>(null);

  /* ─── Debug logging helper ─── */
  const addLog = useCallback(
    (
      level: DebugLogEntry['level'],
      category: DebugLogEntry['category'],
      message: string,
      data?: Record<string, unknown>,
    ) => {
      setDebugLogs((prev) => {
        const entry = createLogEntry(level, category, message, data);
        const updated = [...prev, entry];
        // Keep last MAX_DEBUG_LOGS logs
        return updated.length > MAX_DEBUG_LOGS ? updated.slice(-MAX_DEBUG_LOGS) : updated;
      });
    },
    [],
  );

  /* ─── Debug state object (memoized) ─── */
  const debugState: DebugState = useMemo(
    () => ({
      logs: debugLogs,
      streamTokenCount,
      streamStartTime,
      streamEndTime,
      apiRequestCount,
      lastApiLatency,
      activeSessionId,
      messageCount: messages.length,
      personalityLevel: personality,
      language,
      isGenerating,
      engineState,
    }),
    [
      debugLogs,
      streamTokenCount,
      streamStartTime,
      streamEndTime,
      apiRequestCount,
      lastApiLatency,
      activeSessionId,
      messages.length,
      personality,
      language,
      isGenerating,
      engineState,
    ],
  );

  /* ─── Scroll to bottom on new messages ─── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ─── Voice session setup ─── */
  useEffect(() => {
    return () => {
      voiceSessionRef.current?.destroy();
    };
  }, []);

  /* ─── Global keyboard shortcuts ─── */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+K / Cmd+K — open search overlay
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        return;
      }

      // Don't intercept when modifier keys are held (let browser native shortcuts work)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // If the expanded (zoomed) overlay is open, let its own handler close it first.
      // This applies to all Escape handling below (voice, generation, sidebar).
      if (e.key === 'Escape') {
        const expandedOverlay = document.querySelector('.fixed.inset-0.z-50');
        if (expandedOverlay) return; // defer to ExpandedMarkdownView / DiagramViewer
      }

      // During voice recording: Esc cancels, Enter accepts + sends
      if (voiceStateRef.current !== 'idle' && voiceStateRef.current !== 'error') {
        if (e.key === 'Escape' || e.key === 'Enter') {
          e.preventDefault();
          e.stopImmediatePropagation();

          const isAccept = e.key === 'Enter';
          // Capture interim transcript before stopping (stop() aborts recognition
          // and discards pending results)
          const interim = transcriptPreviewRef.current;
          const existingInput = inputRef_value.current;

          voiceSessionRef.current?.stop();
          voiceSessionRef.current = null;
          setVoiceState('idle');
          setAudioLevel(0);
          setTranscriptPreview('');

          if (isAccept && interim) {
            // Combine any already-finalized text with the interim transcript
            const fullText = existingInput ? `${existingInput} ${interim}`.trim() : interim.trim();
            if (fullText) {
              setInput('');
              sendMessageRef.current?.(fullText);
            }
          } else if (isAccept && existingInput?.trim()) {
            // No interim but there is finalized text — send it
            setInput('');
            sendMessageRef.current?.(existingInput.trim());
          }

          // Focus the chat input for next interaction
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
      }

      // Shift+Enter — start voice recording (when not already recording)
      if (e.key === 'Enter' && e.shiftKey && voiceStateRef.current === 'idle') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handleVoiceToggleRef.current?.();
        return;
      }

      // Escape priority: stop generation → close sidebar → focus input
      if (e.key === 'Escape') {
        if (isGenerating) {
          e.stopImmediatePropagation();
          abortRef.current?.abort();
          setIsGenerating(false);
          requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
        if (showSidebar) {
          e.stopImmediatePropagation();
          setShowSidebar(false);
          return;
        }
        // Focus the chat input as fallback
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      // Skip shortcuts when user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      // "/" — focus the chat input
      if (e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGenerating, showSidebar]);

  /* ─── Check for roast widget handoff ─── */
  useEffect(() => {
    try {
      const handoff = sessionStorage.getItem('grok-roast-handoff');
      if (handoff) {
        sessionStorage.removeItem('grok-roast-handoff');
        const parsed = JSON.parse(handoff) as { messages?: ChatMessage[] } | ChatMessage[];
        const msgs = Array.isArray(parsed) ? parsed : parsed.messages;
        if (Array.isArray(msgs) && msgs.length > 0) {
          setMessages(msgs);
          setEngineState('ready');
          addLog('info', 'session', 'Roast handoff loaded', { messageCount: msgs.length });
          return;
        }
      }
    } catch {
      // Ignore invalid handoff data
    }

    // Load sessions for sidebar history — but always start on idle (model picker)
    const allSessions = loadSessions();
    setSessions(allSessions);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Init engine (start new/continue chat) ─── */
  const initEngine = useCallback(
    (resumeExisting: boolean) => {
      if (resumeExisting) {
        const activeId = getActiveSessionId();
        const restored = loadMessages();
        if (restored.length > 0) {
          setMessages(restored);
          if (activeId) setActiveSession(activeId);
          setEngineState('ready');
          addLog('info', 'session', 'Resumed existing chat', { messages: restored.length });
          inputRef.current?.focus();
          return;
        }
      }

      // Start new session with translated welcome
      const welcomeMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: t(language).welcome,
      };
      setMessages([welcomeMsg]);
      setActiveSession(null);
      setActiveSessionId(null);
      setEngineState('ready');
      addLog('info', 'session', 'New chat started');

      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [addLog, language],
  );

  /* ─── Send message ─── */
  const sendMessage = useCallback(
    async (text: string, options?: { displayText?: string; hidden?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || isGenerating) return;

      const userMessageCount = messages.filter((m) => m.role === 'user' && !m.hidden).length;
      if (userMessageCount >= MAX_USER_MESSAGES) return;

      // Capture generation counter so we can detect session-changing operations
      // during streaming (handles the null === null edge case for new sessions)
      const genAtStart = sessionGenRef.current;

      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      addLog('info', 'ui', 'User message sent', { length: trimmed.length });

      // Track streaming progress in outer scope so catch block can access them
      let tokenCount = 0;
      let lastAccumulated = '';
      // Track accumulated agent activity so it survives into the final message
      let accumulatedAgentActivity: AgentActivityItem[] = [];

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        ...(options?.displayText !== undefined && { displayContent: options.displayText }),
        ...(options?.hidden && { hidden: true }),
      };
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
      };

      const updated = [...messages, userMsg, assistantMsg];

      // Apply any pending form update (from handleFormSubmit) atomically
      // so the selectedId isn't lost when setMessages overwrites state.
      const formUpdate = pendingFormUpdateRef.current;
      if (formUpdate) {
        for (let i = 0; i < updated.length; i++) {
          const m = updated[i];
          if (m && m.id === formUpdate.messageId && m.form) {
            updated[i] = {
              ...m,
              form: {
                ...m.form,
                selectedId: formUpdate.selectedId,
                ...(formUpdate.customValue !== undefined && {
                  customValue: formUpdate.customValue,
                }),
              },
            };
            break;
          }
        }
        pendingFormUpdateRef.current = null;
      }

      setMessages(updated);
      setIsGenerating(true);
      setStreamTokenCount(0);
      setStreamStartTime(Date.now());
      setStreamEndTime(null);

      const controller = new AbortController();
      abortRef.current = controller;
      const requestStart = Date.now();

      try {
        // Lazy-load cloud modules
        const [{ cloudChatStream }, { buildCloudContext, buildVisualReferenceMessage }] =
          await Promise.all([import('@lib/ai/cloud'), import('@lib/ai/cloud-context')]);

        addLog('debug', 'api', 'Cloud modules loaded');
        setApiRequestCount((c) => c + 1);

        // Build chat history for the API
        const chatHistory = trimHistory(
          updated
            .filter((m) => m.content.length > 0 && !isWelcomeMessage(m.content))
            .map((m) => ({ role: m.role, content: m.content })),
        );

        // Build full context with personality & language
        const context = await buildCloudContext(undefined, personality, language);
        addLog('debug', 'api', 'Context built', {
          historyMessages: chatHistory.length,
          contextLength: context.length,
        });

        const fullHistory = [
          {
            role: 'system' as const,
            content: systemPrompt + context + (isVideoChatMode ? VIDEO_CHAT_SYSTEM_PROMPT : ''),
          },
          ...(await buildVisualReferenceMessage().then((m) => (m ? [m] : []))),
          ...chatHistory,
        ];

        // Stream response
        const result = await cloudChatStream(
          fullHistory,
          selectedCloudModelId,
          (_token, accumulated) => {
            tokenCount++;
            lastAccumulated = accumulated;
            setStreamTokenCount(tokenCount);
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                const patched = { ...last, content: accumulated };
                delete patched.searchStatus;
                copy[copy.length - 1] = patched;
              }
              return copy;
            });
          },
          controller.signal,
          {
            tools: (() => {
              const allTools = getToolsForModel(selectedCloudModelId);
              // If the previous assistant message had a form (ask_user), strip
              // ask_user from available tools so the AI cannot re-ask.
              // Exception: in video chat mode, every turn needs ask_user for options.
              const prevAssistant = messages[messages.length - 1];
              if (!isVideoChatMode && prevAssistant?.role === 'assistant' && prevAssistant.form) {
                return allTools.filter((t) => !('name' in t && t.name === 'ask_user'));
              }
              return allTools;
            })(),
            tool_choice: 'auto',
            onWebSearch: () => {
              addLog('info', 'api', 'Web search triggered');
              setActiveToolCalls((prev) => [...prev, 'web_search']);
              if (!accumulatedAgentActivity.some((a) => a.toolType === 'web_search')) {
                accumulatedAgentActivity = [
                  ...accumulatedAgentActivity,
                  createAgentActivity('web_search'),
                ];
              }
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    searchStatus: 'searching',
                    agentActivity: accumulatedAgentActivity,
                  };
                }
                return copy;
              });
            },
            onWebSearchFound: () => {
              addLog('info', 'api', 'Web search results found');
              setActiveToolCalls((prev) => prev.filter((t) => t !== 'web_search'));
              accumulatedAgentActivity = accumulatedAgentActivity.map((a) =>
                a.toolType === 'web_search' ? completeAgentActivity(a) : a,
              );
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    searchStatus: 'found',
                    agentActivity: accumulatedAgentActivity,
                  };
                }
                return copy;
              });
            },
            onToolUse: (toolType: string) => {
              addLog('info', 'api', `Tool invoked: ${toolType}`);
              setActiveToolCalls((prev) => [...prev, toolType]);
              if (!accumulatedAgentActivity.some((a) => a.toolType === toolType)) {
                accumulatedAgentActivity = [
                  ...accumulatedAgentActivity,
                  createAgentActivity(toolType),
                ];
              }
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    agentActivity: accumulatedAgentActivity,
                  };
                }
                return copy;
              });
            },
            onToolDone: (toolType: string) => {
              addLog('info', 'api', `Tool completed: ${toolType}`);
              setActiveToolCalls((prev) => prev.filter((t) => t !== toolType));
              accumulatedAgentActivity = accumulatedAgentActivity.map((a) =>
                a.toolType === toolType ? completeAgentActivity(a) : a,
              );
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, agentActivity: accumulatedAgentActivity };
                }
                return copy;
              });
            },
          },
        );

        const latency = Date.now() - requestStart;
        setLastApiLatency(latency);
        setStreamEndTime(Date.now());
        addLog('info', 'stream', 'Stream completed', {
          tokens: tokenCount,
          latencyMs: latency,
          toolCalls: result.toolCalls.length,
        });

        // Map tool calls to actions (exclude generate_image, generate_video, ask_user — handled separately)
        const actions = mapToolCallsToActions(
          result.toolCalls.filter(
            (tc) =>
              tc.name !== 'generate_image' &&
              tc.name !== 'generate_video' &&
              tc.name !== 'ask_user',
          ),
        );

        // Handle media generation tool calls (image + video)
        // Both follow the same pattern: filter → activate agent → generate → mark done
        // In Video Chat mode, video URLs are captured separately (not embedded in markdown).
        let videoChatVideoUrl: string | undefined;

        // Video Chat mode: start TTS generation in PARALLEL with video generation.
        // We have the text content already from the AI stream — no need to wait for video.
        let ttsPromise: Promise<string | undefined> | undefined;
        if (isVideoChatMode && result.content.trim()) {
          ttsPromise = (async () => {
            try {
              addLog('info', 'api', 'Generating TTS for video chat voiceover (parallel)');
              const { textToSpeech } = await import('@lib/cybernus/services/VoiceService');
              const audioElement = await textToSpeech(result.content.trim(), controller.signal);
              addLog('info', 'api', 'TTS voiceover generated for video chat');
              return audioElement.src;
            } catch (ttsErr) {
              addLog('warn', 'api', 'TTS generation failed for video chat', {
                error: ttsErr instanceof Error ? ttsErr.message : 'Unknown',
              });
              return undefined;
            }
          })();

          // Update message with spoken text immediately so the UI shows the loader
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = {
                ...last,
                videoChatSpokenText: result.content.trim(),
              };
            }
            return copy;
          });
        }

        const mediaGenerators: MediaGeneratorConfig[] = [
          {
            toolName: 'generate_image',
            activityType: 'image_generation',
            generate: async (prompt) => {
              const { generateImage } = await import('@lib/ai/cloud');
              const url = await generateImage(prompt);
              const safeAlt = prompt.replace(/[[\]()]/g, '');
              return `\n\n![${safeAlt}](${url})`;
            },
            failureText: '\n\n*Image generation failed.*',
          },
          {
            toolName: 'generate_video',
            activityType: 'video_generation',
            generate: async (prompt) => {
              const { generateVideo } = await import('@lib/ai/cloud');
              const url = await generateVideo(prompt, controller.signal);
              // In video chat mode, capture URL for the VideoChatPlayer
              if (isVideoChatMode) {
                videoChatVideoUrl = url;
                return ''; // Don't embed in markdown
              }
              const safeAlt = prompt.replace(/[[\]()]/g, '');
              return `\n\n<video>${url}|${safeAlt}</video>`;
            },
            failureText: isVideoChatMode ? '' : '\n\n*Video generation failed.*',
          },
        ];

        let mediaMarkdown = '';
        for (const gen of mediaGenerators) {
          const calls = result.toolCalls.filter((tc) => tc.name === gen.toolName);
          if (calls.length === 0) continue;

          setActiveToolCalls((prev) => [...prev, gen.activityType]);
          addLog('info', 'api', `Generating ${calls.length} ${gen.activityType}(s)`);

          // Add inline agent activity
          if (!accumulatedAgentActivity.some((a) => a.toolType === gen.activityType)) {
            accumulatedAgentActivity = [
              ...accumulatedAgentActivity,
              createAgentActivity(gen.activityType),
            ];
          }
          setMessages((prev) => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, agentActivity: accumulatedAgentActivity };
            }
            return copy;
          });

          try {
            const results = await Promise.all(
              calls.map(async (tc) => {
                try {
                  const args = JSON.parse(tc.arguments) as { prompt?: string };
                  if (!args.prompt) return '';
                  return await gen.generate(args.prompt);
                } catch (err) {
                  addLog('error', 'api', `${gen.activityType} failed`, {
                    error: err instanceof Error ? err.message : 'Unknown',
                  });
                  return gen.failureText;
                }
              }),
            );
            mediaMarkdown += results.join('');
          } finally {
            setActiveToolCalls((prev) => prev.filter((t) => t !== gen.activityType));
            accumulatedAgentActivity = accumulatedAgentActivity.map((a) =>
              a.toolType === gen.activityType ? completeAgentActivity(a) : a,
            );
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, agentActivity: accumulatedAgentActivity };
              }
              return copy;
            });
          }

          // Bail out if the user aborted during generation
          if (controller.signal.aborted) throw new Error('aborted');
        }

        // Build final assistant message
        // If the API returned only tool calls with no text, use a fallback so
        // the empty content doesn't trigger a permanent TypingIndicator.
        const textContent = result.content + mediaMarkdown;

        // Parse ask_user tool calls → attach form to assistant message
        let formData: ChatForm | undefined;
        const askUserCall = result.toolCalls.find((tc) => tc.name === 'ask_user');
        if (askUserCall) {
          try {
            const args = JSON.parse(askUserCall.arguments) as {
              question?: string;
              options?: { id?: string; label?: string; description?: string; value?: string }[];
              allow_other?: boolean;
            };
            if (args.question && Array.isArray(args.options) && args.options.length > 0) {
              const options: ChatFormOption[] = args.options
                .filter(
                  (o): o is { id: string; label: string; value: string; description?: string } =>
                    typeof o.id === 'string' &&
                    typeof o.label === 'string' &&
                    typeof o.value === 'string' &&
                    o.value.trim().length > 0,
                )
                .map((o) => ({
                  id: o.id,
                  label: o.label,
                  ...(o.description !== undefined && { description: o.description }),
                  value: o.value,
                }));
              if (options.length > 0) {
                formData = {
                  question: args.question,
                  options,
                  allowOther: args.allow_other !== false,
                  selectedId: null,
                };
                addLog('info', 'api', 'ask_user form parsed', {
                  question: args.question,
                  optionCount: options.length,
                });
              }
            }
          } catch {
            addLog('warn', 'api', 'Failed to parse ask_user arguments');
          }
        }

        const finalAssistant: ChatMessage = {
          ...assistantMsg,
          content:
            textContent ||
            (formData ? '' : result.toolCalls.length > 0 ? '*(used tools only)*' : ''),
          // Preserve agent activity accumulated during streaming
          ...(accumulatedAgentActivity.length > 0 && {
            agentActivity: accumulatedAgentActivity,
          }),
          // Attach form if ask_user was called
          ...(formData && { form: formData }),
          // Video Chat mode fields
          ...(isVideoChatMode && videoChatVideoUrl && { videoChatUrl: videoChatVideoUrl }),
          ...(isVideoChatMode &&
            result.content.trim() && { videoChatSpokenText: result.content.trim() }),
        };
        if (actions.length > 0) finalAssistant.actions = actions;

        // Compute final messages directly (don't rely on React state updater
        // timing — in React 18 batched updates, the updater runs during render,
        // not synchronously when setState is called)
        let finalMessages = [...updated.slice(0, -1), finalAssistant];

        // Update UI state (show video + form immediately)
        setMessages(finalMessages);

        // Video Chat mode: await the TTS promise that was started in parallel with video generation
        if (isVideoChatMode && ttsPromise) {
          const ttsAudioUrl = await ttsPromise;
          if (ttsAudioUrl) {
            const updatedAssistant: ChatMessage = {
              ...finalAssistant,
              videoChatAudioUrl: ttsAudioUrl,
            };
            finalMessages = [...updated.slice(0, -1), updatedAssistant];
            setMessages(finalMessages);
          }
        }

        // Persist to localStorage
        // Skip save if a session-changing operation occurred during streaming
        if (sessionGenRef.current === genAtStart) {
          const sid = saveMessages(finalMessages, activeSessionIdRef.current ?? undefined);
          setActiveSession(sid);
          setSessions(loadSessions());
        }
      } catch (err) {
        if (controller.signal.aborted) {
          addLog('warn', 'stream', 'Stream aborted by user');
          // Build abort messages directly (same React 18 batching concern)
          // If no tokens were streamed, remove the empty assistant placeholder;
          // otherwise keep the partial response so it survives page refresh.
          const abortMessages =
            tokenCount === 0
              ? updated.slice(0, -1) // Remove empty assistant placeholder
              : [...updated.slice(0, -1), { ...assistantMsg, content: lastAccumulated }];

          // Only update messages/save if no session-changing operation occurred
          if (sessionGenRef.current === genAtStart) {
            setMessages(abortMessages);

            if (tokenCount > 0 && lastAccumulated) {
              const sid = saveMessages(abortMessages, activeSessionIdRef.current ?? undefined);
              setActiveSession(sid);
              setSessions(loadSessions());
            }
          }
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';

        addLog('error', 'api', 'Request failed', { error: errorMessage });

        const friendlyMsg =
          errorMessage.includes('429') || errorMessage.includes('rate')
            ? "I'm getting too many requests right now. Please wait a moment and try again."
            : errorMessage.includes('500') || errorMessage.includes('502')
              ? "The AI service is temporarily unavailable. Let's try again in a moment."
              : `I ran into an issue: ${errorMessage}`;

        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === 'assistant') {
            const errMsg = { ...last, content: friendlyMsg };
            delete errMsg.searchStatus;
            copy[copy.length - 1] = errMsg;
          }
          return copy;
        });
      } finally {
        setIsGenerating(false);
        setStreamEndTime(Date.now());
        setActiveToolCalls([]);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      messages,
      isGenerating,
      systemPrompt,
      selectedCloudModelId,
      personality,
      language,
      addLog,
      isVideoChatMode,
    ],
  );

  /* ─── Session management ─── */
  const clearChat = useCallback(() => {
    setIsVideoChatMode(false);
    // Save current messages before clearing so the session persists in history
    if (messages.length > 0 && messages.some((m) => m.role === 'user')) {
      saveMessages(messages, activeSessionId ?? undefined);
    }
    // Increment generation counter so any in-flight sendMessage abort handler
    // detects the session change and skips its re-save logic.
    sessionGenRef.current++;
    activeSessionIdRef.current = null;
    abortRef.current?.abort();
    setIsGenerating(false);
    clearMessages();
    setMessages([]);
    setActiveSession(null);
    setSessions(loadSessions());
    setEngineState('idle');
    addLog('info', 'session', 'Chat cleared');
  }, [addLog, messages, activeSessionId]);

  const switchSession = useCallback(
    (session: ChatSession) => {
      setIsVideoChatMode(false);
      // Increment generation counter and update ref before aborting
      sessionGenRef.current++;
      activeSessionIdRef.current = session.id;
      abortRef.current?.abort();
      setIsGenerating(false);
      setActiveSessionId(session.id);
      setActiveSession(session.id);
      setMessages(session.messages);
      setShowSidebar(false);
      setEngineState('ready');
      addLog('info', 'session', 'Switched session', { id: session.id });
    },
    [addLog],
  );

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteSession(sessionId);
      setSessions(loadSessions());
      if (activeSessionId === sessionId) {
        setIsVideoChatMode(false);
        sessionGenRef.current++;
        activeSessionIdRef.current = null;
        abortRef.current?.abort();
        setIsGenerating(false);
        clearMessages();
        setMessages([]);
        setActiveSession(null);
        setEngineState('idle');
      }
      addLog('info', 'session', 'Session deleted', { id: sessionId });
    },
    [activeSessionId, addLog],
  );

  const handleClearAll = useCallback(() => {
    setIsVideoChatMode(false);
    sessionGenRef.current++;
    activeSessionIdRef.current = null;
    abortRef.current?.abort();
    setIsGenerating(false);
    clearAllSessions();
    setMessages([]);
    setActiveSession(null);
    setSessions([]);
    setShowSidebar(false);
    setEngineState('idle');
    addLog('info', 'session', 'All sessions cleared');
  }, [addLog]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    addLog('info', 'stream', 'Generation stopped by user');
  }, [addLog]);

  /* ─── Personality & Language handlers ─── */
  const handlePersonalityChange = useCallback(
    (level: PersonalityLevel) => {
      setPersonality(level);
      setPersonalityLevel(level);
      addLog('info', 'ui', 'Personality changed', { level });
    },
    [addLog],
  );

  const handleLanguageChange = useCallback(
    (lang: Language) => {
      setLang(lang);
      setStoredLanguage(lang);
      addLog('info', 'ui', 'Language changed', { language: lang });
    },
    [addLog],
  );

  /* ─── Voice handlers ─── */
  const voiceSupported = isVoiceSupported();

  const handleVoiceToggle = useCallback(() => {
    if (voiceState === 'idle' || voiceState === 'error') {
      // Start recording
      const session = new VoiceSession(
        {
          onStateChange: (state) => {
            setVoiceState(state);
            addLog('info', 'voice', `Voice state: ${state}`);
          },
          onTranscript: (text, isFinal) => {
            setTranscriptPreview(text);
            if (isFinal) {
              setInput((prev) => (prev ? `${prev} ${text}` : text));
              setTranscriptPreview('');
              addLog('info', 'voice', 'Transcript received', { text, isFinal });
            }
          },
          onDiagnosticsUpdate: (diag) => {
            addLog(
              'debug',
              'voice',
              'Diagnostics update',
              diag as unknown as Record<string, unknown>,
            );
          },
          onError: (error) => {
            addLog('error', 'voice', error);
          },
          onAudioLevel: (level) => {
            setAudioLevel(level);
          },
        },
        language,
      );
      voiceSessionRef.current = session;
      session.start().catch(() => {
        /* handled via onError callback */
      });
    } else {
      // Stop recording
      voiceSessionRef.current?.stop();
      voiceSessionRef.current = null;
      setVoiceState('idle');
      setAudioLevel(0);
      setTranscriptPreview('');
    }
  }, [voiceState, addLog, language]);
  handleVoiceToggleRef.current = handleVoiceToggle;
  sendMessageRef.current = sendMessage;

  /* ─── Form submission handler (ask_user tool) ─── */
  const handleFormSubmit = useCallback(
    (messageId: string, selectedId: string, value: string, customValue?: string) => {
      // Store form update in ref — sendMessage will apply it atomically
      // when building the updated messages array, preventing the stale
      // closure from overwriting the selectedId.
      pendingFormUpdateRef.current = {
        messageId,
        selectedId,
        ...(customValue !== undefined && { customValue }),
      };

      // Find the form's question and option label to give the AI clear context
      // that this is a definitive selection, not a new question.
      const formMsg = messages.find((m) => m.id === messageId);
      const option = formMsg?.form?.options.find((o) => o.id === selectedId);
      const label = option?.label ?? customValue ?? value;
      const contextMessage = `I chose: ${label}. Proceed with this choice — do not ask again.`;

      // Send as hidden user message (the form selection is the visible interaction).
      sendMessage(contextMessage, { hidden: true });
    },
    [sendMessage, messages],
  );

  /* ─── Video Chat mode handlers ─── */
  const videoChatPendingStartRef = useRef(false);

  const startVideoChat = useCallback(() => {
    // Set up video chat mode
    setIsVideoChatMode(true);
    setEngineState('ready');
    setMessages([]);
    videoChatPendingStartRef.current = true;

    addLog('info', 'session', 'Video Chat mode started');
  }, [addLog]);

  // Send the initial trigger message once React has re-rendered with isVideoChatMode=true,
  // guaranteeing the sendMessage closure includes VIDEO_CHAT_SYSTEM_PROMPT.
  useEffect(() => {
    if (isVideoChatMode && videoChatPendingStartRef.current) {
      videoChatPendingStartRef.current = false;
      sendMessageRef.current?.(
        'Start the video chat. Introduce yourself as Cybernus with a compelling cinematic opening.',
        { hidden: true },
      );
    }
  }, [isVideoChatMode]);

  const exitVideoChat = useCallback(() => {
    setIsVideoChatMode(false);
    sessionGenRef.current++;
    activeSessionIdRef.current = null;
    abortRef.current?.abort();
    setIsGenerating(false);
    clearMessages();
    setMessages([]);
    setActiveSession(null);
    setSessions(loadSessions());
    setEngineState('idle');
    addLog('info', 'session', 'Video Chat mode exited');
  }, [addLog]);

  /* ─── Listen for "Make it a video" and other programmatic send-message events ─── */
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<{ text: string }>).detail?.text;
      if (text) sendMessageRef.current?.(text);
    };
    window.addEventListener('cybernus:send-message', handler);
    return () => window.removeEventListener('cybernus:send-message', handler);
  }, []);

  /* ─── Search result handler ─── */
  const handleSearchSelect = useCallback(
    (sessionId: string) => {
      const allSessions = loadSessions();
      const session = allSessions.find((s) => s.id === sessionId);
      if (session) {
        switchSession(session);
      }
    },
    [switchSession],
  );

  /* ─── Derived values (memoized) ─── */
  const activeCloudModel = useMemo(
    () => CLOUD_MODELS.find((m) => m.id === selectedCloudModelId),
    [selectedCloudModelId],
  );
  const userMsgCount = useMemo(
    () => messages.filter((m) => m.role === 'user' && !m.hidden).length,
    [messages],
  );
  const isAtLimit = userMsgCount >= MAX_USER_MESSAGES;
  const currentPersonality = PERSONALITY_LEVELS[personality];
  const strings = t(language);
  const isRecording =
    voiceState === 'requesting-mic' ||
    voiceState === 'recording' ||
    voiceState === 'connecting' ||
    voiceState === 'transcribing';

  /* ─── Sidebar content (shared between desktop persistent & mobile overlay) ─── */
  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div className="border-accent/30 flex shrink-0 items-center gap-3 border-b px-5 py-5">
        <div className="bg-accent-muted ring-accent/20 relative flex h-8 w-8 items-center justify-center rounded-lg ring-1">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: currentPersonality?.color ?? 'var(--color-accent)',
              boxShadow: `0 0 10px ${currentPersonality?.glowColor ?? 'var(--color-accent)'}`,
            }}
          />
        </div>
        <span className="text-text-primary text-sm font-bold tracking-[0.15em]">CYBERNUS</span>
      </div>

      {/* Home button */}
      <div className="shrink-0 px-4 pt-4 pb-1">
        <a
          href="/"
          className="border-border bg-bg-surface text-text-secondary hover:border-accent/40 hover:bg-accent-muted hover:text-text-primary flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all hover:-translate-y-0.5"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Home
        </a>
      </div>

      {/* New Chat button */}
      <div className="shrink-0 px-4 pt-1 pb-1">
        <button
          onClick={clearChat}
          className="border-accent/30 bg-accent/5 text-text-primary hover:border-accent/50 hover:bg-accent/10 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all hover:-translate-y-0.5"
        >
          <span className="text-accent relative flex h-4 w-4 items-center justify-center">
            <span className="bg-accent/20 absolute inset-0 animate-ping rounded-full opacity-40" />
            <svg
              className="relative h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          {strings.newChat}
        </button>
      </div>

      {/* Search button */}
      <div className="shrink-0 px-4 pt-1 pb-1">
        <button
          onClick={() => setShowSearch(true)}
          className="border-border bg-bg-surface text-text-secondary hover:border-accent/40 hover:bg-accent-muted hover:text-text-primary flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all hover:-translate-y-0.5"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {strings.search}
          <kbd className="text-text-muted ml-auto rounded border border-white/10 px-1 py-0.5 text-[9px]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Session list */}
      <div className="min-h-0 flex-1">
        <SessionHistory
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSwitchSession={switchSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          onClose={() => setShowSidebar(false)}
          language={language}
        />
      </div>

      {/* Settings section */}
      <div className="border-border shrink-0 space-y-4 border-t px-5 py-5">
        {/* Language toggle */}
        <div>
          <p className="text-text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
            {strings.language}
          </p>
          <div className="bg-bg-elevated flex items-center gap-0.5 rounded-lg p-0.5">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code)}
                className={cn(
                  'flex-1 rounded-md px-1.5 py-1.5 text-center text-xs transition-all',
                  language === l.code
                    ? 'bg-bg-surface text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary',
                )}
                title={l.nativeName}
              >
                {l.flag}
              </button>
            ))}
          </div>
        </div>

        {/* Personality slider */}
        <div>
          <p className="text-text-muted mb-2 text-[10px] font-medium tracking-wider uppercase">
            {strings.personality}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{currentPersonality?.emoji}</span>
            <input
              type="range"
              min={0}
              max={5}
              value={personality}
              onChange={(e) => handlePersonalityChange(Number(e.target.value) as PersonalityLevel)}
              className="bg-bg-elevated accent-accent [&::-webkit-slider-thumb]:bg-accent h-1 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
              title={`${strings.personalityLevel}: ${currentPersonality?.name ?? ''}`}
            />
            <span className="text-text-muted w-16 text-[10px]">{currentPersonality?.name}</span>
          </div>
        </div>
      </div>

      {/* Back to portfolio */}
      <div className="border-accent/30 shrink-0 border-t px-5 py-4">
        <p className="text-text-muted text-center text-[10px]">{strings.poweredBy}</p>
      </div>
    </div>
  );

  return (
    <div className="bg-bg-base relative flex h-full">
      {/* Matrix rain background */}
      <MatrixRain opacity={0.03} />

      {/* Search overlay */}
      <SearchOverlay
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectResult={handleSearchSelect}
        language={language}
      />

      {/* Mobile sidebar backdrop */}
      {showSidebar && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop overlay
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] transition-opacity md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar — persistent on desktop, slide-over on mobile */}
      <aside
        className={cn(
          'border-accent/30 bg-bg-base flex h-full shrink-0 flex-col border-r transition-transform duration-200 ease-out',
          'fixed inset-y-0 left-0 z-30 w-72',
          'md:relative md:z-auto md:w-[260px] md:translate-x-0',
          showSidebar ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>

      {/* Left Neural Stream — visible on xl+ screens */}
      <ThoughtsPanel side="left" />

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {isVideoChatMode ? (
          /* ─── Video Chat mode ─── */
          <VideoChatView
            messages={messages}
            isGenerating={isGenerating}
            onFormSubmit={handleFormSubmit}
            onExit={exitVideoChat}
          />
        ) : engineState === 'idle' ? (
          /* ─── Idle screen ─── */
          <>
            {/* Mobile header for idle */}
            <div className="border-accent/30 flex items-center justify-between border-b px-4 py-3 md:hidden">
              <button
                onClick={() => setShowSidebar(true)}
                className="text-text-muted hover:bg-bg-surface rounded-lg p-1.5 transition-colors"
                aria-label="Open menu"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d={HAMBURGER_MENU_PATH} />
                </svg>
              </button>
              <span className="text-text-primary text-sm font-bold tracking-wider">CYBERNUS</span>
              <div className="w-8" />
            </div>
            <ModelPicker
              selectedCloudModelId={selectedCloudModelId}
              setSelectedCloudModelId={setSelectedCloudModelId}
              hasSavedChat={getActiveSessionId() !== null}
              onContinue={() => initEngine(true)}
              onNewChat={() => initEngine(false)}
              onStartVideoChat={startVideoChat}
              language={language}
            />
          </>
        ) : (
          /* ─── Chat UI ─── */
          <>
            {/* Minimal chat header */}
            <div className="border-accent/30 flex shrink-0 items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Mobile hamburger */}
                <button
                  onClick={() => setShowSidebar(true)}
                  className="text-text-muted hover:bg-bg-surface rounded-lg p-1.5 transition-colors md:hidden"
                  aria-label="Open menu"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d={HAMBURGER_MENU_PATH} />
                  </svg>
                </button>

                {/* Model status */}
                <div className="flex items-center gap-2">
                  <span
                    className="block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: currentPersonality?.color ?? 'var(--color-accent)',
                      boxShadow: `0 0 8px ${currentPersonality?.glowColor ?? 'var(--color-accent)'}`,
                    }}
                  />
                  <span className="text-text-secondary text-xs">
                    {activeCloudModel?.name ?? 'Cybernus'}
                  </span>
                  <span className="text-text-muted hidden text-[10px] sm:inline">
                    {currentPersonality?.emoji} {currentPersonality?.name}
                  </span>
                </div>
              </div>

              {/* Recording indicator in header */}
              {isRecording && (
                <span className="flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/[0.06] px-2.5 py-1 text-[10px] font-medium text-red-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
                  </span>
                  {strings.recording}
                </span>
              )}

              {/* Agent panel toggle */}
              <button
                onClick={() => setShowAgentPanel((prev) => !prev)}
                className={cn(
                  'rounded-lg p-1.5 transition-colors',
                  showAgentPanel
                    ? 'bg-[#00ff41]/10 text-[#00ff41]'
                    : 'text-text-muted hover:bg-bg-surface',
                )}
                aria-label={strings.agents}
                title={strings.agents}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.27a2 2 0 0 1-3.46 0H6.73a2 2 0 0 1-3.46 0H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                  <circle cx="7.5" cy="14.5" r="1" fill="currentColor" />
                  <circle cx="16.5" cy="14.5" r="1" fill="currentColor" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <ChatMessages
              messages={messages}
              isGenerating={isGenerating}
              messagesEndRef={messagesEndRef}
              onSendMessage={sendMessage}
              onFormSubmit={handleFormSubmit}
              language={language}
              onExpandClose={() => requestAnimationFrame(() => inputRef.current?.focus())}
            />

            {/* Input */}
            <ChatInput
              input={input}
              setInput={setInput}
              isGenerating={isGenerating}
              isAtLimit={isAtLimit}
              userMsgCount={userMsgCount}
              maxMessages={MAX_USER_MESSAGES}
              language={language}
              inputRef={inputRef}
              onSend={sendMessage}
              onStop={handleStop}
              onClearChat={clearChat}
              isRecording={isRecording}
              onVoiceToggle={handleVoiceToggle}
              voiceSupported={voiceSupported}
              audioLevel={audioLevel}
              transcriptPreview={transcriptPreview}
            />
          </>
        )}
      </div>

      {/* Floating thoughts panels — visible on xl+ screens */}
      <ThoughtsPanel side="right" />

      {/* Agent panel — inline sidebar on xl+, floating overlay on smaller screens */}
      {showAgentPanel && (
        <>
          {/* Backdrop for mobile/tablet overlay */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop */}
          <div
            className="fixed inset-0 z-20 bg-black/40 xl:hidden"
            onClick={() => setShowAgentPanel(false)}
          />
          <aside
            className={cn(
              'border-accent/30 bg-bg-base border-l',
              'fixed inset-y-0 right-0 z-30 w-[280px]',
              'xl:relative xl:z-auto xl:block xl:w-[240px] xl:shrink-0',
            )}
          >
            <AgentPanel
              language={language}
              activeToolCalls={activeToolCalls}
              onClose={() => setShowAgentPanel(false)}
            />
          </aside>
        </>
      )}

      {/* Debug panel — only in development */}
      {import.meta.env.DEV && (
        <DebugPanel state={debugState} onClearLogs={() => setDebugLogs([])} />
      )}
    </div>
  );
}
