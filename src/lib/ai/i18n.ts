/**
 * Internationalization (i18n) — UI translations for EN/ES/HE.
 *
 * All user-facing strings in the chat interface are translated here.
 * Hebrew (HE) uses RTL layout, handled via the `dir` attribute.
 */

import type { Language } from './config';

export interface UITranslations {
  // Header
  back: string;
  cybernus: string;

  // Chat
  askPlaceholder: string;
  sendMessage: string;
  stopGenerating: string;
  newChat: string;
  history: string;
  chatHistory: string;
  clearAll: string;
  closeHistory: string;
  noChatHistory: string;
  messages: string;
  messageLimitReached: string;
  startNewChat: string;
  searchingWeb: string;
  foundResults: string;
  poweredBy: string;

  // Personality
  personalityLabel: string;

  // Voice
  startRecording: string;
  stopRecording: string;
  recording: string;
  voiceNotSupported: string;
  connecting: string;
  transcribing: string;
  micPermissionDenied: string;

  // Suggested questions
  suggestedQuestions: readonly string[];

  // Welcome
  welcomeMessage: string;
}

const EN: UITranslations = {
  back: 'Back',
  cybernus: 'Cybernus',
  askPlaceholder: 'Ask me anything…',
  sendMessage: 'Send message',
  stopGenerating: 'Stop generating',
  newChat: 'New',
  history: 'History',
  chatHistory: 'Chat History',
  clearAll: 'Clear All',
  closeHistory: 'Close history',
  noChatHistory: 'No chat history yet.',
  messages: 'messages',
  messageLimitReached: "You've reached the message limit for this chat.",
  startNewChat: 'Start New Chat',
  searchingWeb: 'Searching the web',
  foundResults: 'Found results, synthesizing',
  poweredBy: "Powered by xAI Grok · Cybernus — Tomer's digital self",
  personalityLabel: 'Personality',
  startRecording: 'Start voice recording',
  stopRecording: 'Stop recording',
  recording: 'Listening…',
  voiceNotSupported: 'Voice not supported in this browser',
  connecting: 'Connecting…',
  transcribing: 'Transcribing…',
  micPermissionDenied: 'Microphone permission denied',
  suggestedQuestions: [
    "What's your role in Celery?",
    'Tell me about pytest-celery',
    "What's your tech stack?",
    'Roast yourself 🔥',
  ],
  welcomeMessage:
    "Hey — I'm **Cybernus**, Tomer's digital self. Open source, Celery, distributed systems, my tech philosophy — or just want me to roast myself — ask away.",
};

const ES: UITranslations = {
  back: 'Volver',
  cybernus: 'Cybernus',
  askPlaceholder: 'Pregúntame lo que quieras…',
  sendMessage: 'Enviar mensaje',
  stopGenerating: 'Detener',
  newChat: 'Nuevo',
  history: 'Historial',
  chatHistory: 'Historial de Chat',
  clearAll: 'Borrar Todo',
  closeHistory: 'Cerrar historial',
  noChatHistory: 'No hay historial de chat.',
  messages: 'mensajes',
  messageLimitReached: 'Alcanzaste el límite de mensajes para este chat.',
  startNewChat: 'Iniciar Nuevo Chat',
  searchingWeb: 'Buscando en la web',
  foundResults: 'Resultados encontrados, sintetizando',
  poweredBy: 'Impulsado por xAI Grok · Cybernus — el yo digital de Tomer',
  personalityLabel: 'Personalidad',
  startRecording: 'Iniciar grabación de voz',
  stopRecording: 'Detener grabación',
  recording: 'Escuchando…',
  voiceNotSupported: 'Voz no soportada en este navegador',
  connecting: 'Conectando…',
  transcribing: 'Transcribiendo…',
  micPermissionDenied: 'Permiso de micrófono denegado',
  suggestedQuestions: [
    '¿Cuál es tu rol en Celery?',
    'Cuéntame sobre pytest-celery',
    '¿Cuál es tu stack tecnológico?',
    'Hazte un roast 🔥',
  ],
  welcomeMessage:
    'Hey — soy **Cybernus**, el yo digital de Tomer. Open source, Celery, sistemas distribuidos, mi filosofía tech — o si quieres que me haga un roast — pregunta lo que sea.',
};

const HE: UITranslations = {
  back: 'חזרה',
  cybernus: 'סייברנוס',
  askPlaceholder: '…שאל אותי כל דבר',
  sendMessage: 'שלח הודעה',
  stopGenerating: 'עצור',
  newChat: 'חדש',
  history: 'היסטוריה',
  chatHistory: "היסטוריית צ'אט",
  clearAll: 'מחק הכל',
  closeHistory: 'סגור היסטוריה',
  noChatHistory: ".אין היסטוריית צ'אט עדיין",
  messages: 'הודעות',
  messageLimitReached: ".הגעת למגבלת ההודעות לצ'אט הזה",
  startNewChat: "התחל צ'אט חדש",
  searchingWeb: 'מחפש באינטרנט',
  foundResults: 'נמצאו תוצאות, מסנתז',
  poweredBy: 'מופעל על ידי xAI Grok · סייברנוס — העצמי הדיגיטלי של תומר',
  personalityLabel: 'אישיות',
  startRecording: 'התחל הקלטת קול',
  stopRecording: 'עצור הקלטה',
  recording: '…מקשיב',
  voiceNotSupported: 'קול לא נתמך בדפדפן זה',
  connecting: '…מתחבר',
  transcribing: '…מתמלל',
  micPermissionDenied: 'הרשאת מיקרופון נדחתה',
  suggestedQuestions: [
    '?מה התפקיד שלך ב-Celery',
    'ספר לי על pytest-celery',
    '?מה הסטאק הטכנולוגי שלך',
    '🔥 תעשה לעצמך רוסט',
  ],
  welcomeMessage:
    'היי — אני **סייברנוס**, העצמי הדיגיטלי של תומר. קוד פתוח, Celery, מערכות מבוזרות, הפילוסופיה הטכנולוגית שלי — או שאתה רוצה שאעשה לעצמי רוסט — שאל מה שבא לך.',
};

const TRANSLATIONS: Record<Language, UITranslations> = { en: EN, es: ES, he: HE };

/** Get UI translations for the given language. */
export function getTranslations(lang: Language): UITranslations {
  return TRANSLATIONS[lang];
}
