/**
 * Internationalization — trilingual support for Cybernus chat.
 *
 * Supports English (default), Spanish (Colombian casual), and Hebrew (RTL).
 * Language preference is persisted in localStorage.
 */

export type Language = 'en' | 'es' | 'he';

export interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
  nativeName: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', dir: 'ltr', nativeName: 'English' },
  { code: 'es', label: 'Spanish', flag: '🇨🇴', dir: 'ltr', nativeName: 'Español' },
  { code: 'he', label: 'Hebrew', flag: '🇮🇱', dir: 'rtl', nativeName: 'עברית' },
];

const STORAGE_KEY = 'cybernus-language';

/** Get the persisted language preference, defaulting to English. */
export function getLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es' || stored === 'he') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'en';
}

/** Persist language preference. */
export function setLanguage(lang: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Silently ignore
  }
}

/** Get language option by code. */
export function getLanguageOption(code: Language): LanguageOption {
  const found = LANGUAGES.find((l) => l.code === code);
  if (found) return found;
  return LANGUAGES[0] as LanguageOption;
}

/* ── UI Translations ── */

interface UIStrings {
  welcome: string;
  placeholder: string;
  poweredBy: string;
  newChat: string;
  history: string;
  clearAll: string;
  noHistory: string;
  messages: string;
  startNewChat: string;
  messageLimitReached: string;
  searchingWeb: string;
  foundResults: string;
  voiceStart: string;
  voiceStop: string;
  voiceError: string;
  personality: string;
  personalityLevel: string;
  language: string;
  send: string;
  stop: string;
  diagnostics: string;
  connecting: string;
  connected: string;
  disconnected: string;
  recording: string;
  transcribing: string;
  micPermissionDenied: string;
  title: string;
  subtitle: string;
  recommended: string;
  noDownload: string;
  instantStart: string;
  continueChat: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
  agents: string;
  agentsDescription: string;
  toolActive: string;
  toolInactive: string;
  readAloud: string;
  stopReading: string;
  usingTool: string;
  toolComplete: string;
  searchingX: string;
  executingCode: string;
  queryingMcp: string;
}

const TRANSLATIONS: Record<Language, UIStrings> = {
  en: {
    welcome:
      "Welcome to the Matrix. I'm **Cybernus** — Tomer Nosrati's digital self. You're not talking to an assistant — you're talking to Tomer, rendered in code. Ask me anything about my work, projects, or the Celery empire. Or just dare me to roast myself.",
    placeholder: 'Ask Cybernus anything...',
    poweredBy: 'Powered by xAI Grok · Cybernus v1.0',
    newChat: 'New',
    history: 'History',
    clearAll: 'Clear All',
    noHistory: 'No chat history yet.',
    messages: 'messages',
    startNewChat: 'Start New Chat',
    messageLimitReached: "You've reached the message limit for this chat.",
    searchingWeb: 'Searching the web',
    foundResults: 'Found results, synthesizing',
    voiceStart: 'Start voice input',
    voiceStop: 'Stop recording',
    voiceError: 'Voice input error',
    personality: 'Personality',
    personalityLevel: 'Personality Level',
    language: 'Language',
    send: 'Send message',
    stop: 'Stop generating',
    diagnostics: 'Diagnostics',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    recording: 'Recording...',
    transcribing: 'Transcribing...',
    micPermissionDenied: 'Microphone permission denied. Please allow microphone access.',
    title: 'Enter the Matrix',
    subtitle: "Tomer Nosrati's digital self, rendered in code",
    recommended: 'Recommended',
    noDownload: 'No download',
    instantStart: 'Instant start',
    continueChat: 'Continue Chat',
    search: 'Search',
    searchPlaceholder: 'Search chat history...',
    noResults: 'No results found.',
    agents: 'Agents',
    agentsDescription: 'MCP tools and capabilities',
    toolActive: 'Active',
    toolInactive: 'Inactive',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    usingTool: 'Using tool',
    toolComplete: 'Tool complete',
    searchingX: 'Searching X',
    executingCode: 'Executing code',
    queryingMcp: 'Querying agent',
  },
  es: {
    welcome:
      'Bienvenido a la Matrix. Soy **Cybernus** — el yo digital de Tomer Nosrati. No estas hablando con un asistente — estas hablando con Tomer, renderizado en codigo. Preguntame lo que quieras sobre mi trabajo, proyectos o el imperio Celery. O atrevete a pedirme que me rostice a mi mismo.',
    placeholder: 'Preguntale a Cybernus...',
    poweredBy: 'Impulsado por xAI Grok · Cybernus v1.0',
    newChat: 'Nuevo',
    history: 'Historial',
    clearAll: 'Borrar Todo',
    noHistory: 'No hay historial de chat.',
    messages: 'mensajes',
    startNewChat: 'Nuevo Chat',
    messageLimitReached: 'Alcanzaste el limite de mensajes para este chat.',
    searchingWeb: 'Buscando en la web',
    foundResults: 'Resultados encontrados, sintetizando',
    voiceStart: 'Iniciar entrada de voz',
    voiceStop: 'Detener grabacion',
    voiceError: 'Error de entrada de voz',
    personality: 'Personalidad',
    personalityLevel: 'Nivel de personalidad',
    language: 'Idioma',
    send: 'Enviar mensaje',
    stop: 'Detener generacion',
    diagnostics: 'Diagnosticos',
    connecting: 'Conectando...',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    recording: 'Grabando...',
    transcribing: 'Transcribiendo...',
    micPermissionDenied: 'Permiso de microfono denegado. Permite el acceso al microfono.',
    title: 'Entra a la Matrix',
    subtitle: 'El yo digital de Tomer Nosrati, renderizado en codigo',
    recommended: 'Recomendado',
    noDownload: 'Sin descarga',
    instantStart: 'Inicio instantaneo',
    continueChat: 'Continuar Chat',
    search: 'Buscar',
    searchPlaceholder: 'Buscar en el historial...',
    noResults: 'Sin resultados.',
    agents: 'Agentes',
    agentsDescription: 'Herramientas MCP y capacidades',
    toolActive: 'Activo',
    toolInactive: 'Inactivo',
    readAloud: 'Leer en voz alta',
    stopReading: 'Dejar de leer',
    usingTool: 'Usando herramienta',
    toolComplete: 'Herramienta completada',
    searchingX: 'Buscando en X',
    executingCode: 'Ejecutando codigo',
    queryingMcp: 'Consultando agente',
  },
  he: {
    welcome:
      'ברוכים הבאים למטריקס. אני **סייברנוס** — העצמי הדיגיטלי של תומר נוסרתי. אתם לא מדברים עם עוזר — אתם מדברים עם תומר, מרונדר בקוד. שאלו אותי כל דבר על העבודה שלי, הפרויקטים או אימפריית Celery. או תעזו לבקש ממני לצלות את עצמי.',
    placeholder: '...שאלו את סייברנוס',
    poweredBy: 'מופעל על ידי xAI Grok · Cybernus v1.0',
    newChat: 'חדש',
    history: 'היסטוריה',
    clearAll: 'מחק הכל',
    noHistory: '.אין היסטוריית צ׳אט עדיין',
    messages: 'הודעות',
    startNewChat: 'צ׳אט חדש',
    messageLimitReached: '.הגעת למגבלת ההודעות לצ׳אט זה',
    searchingWeb: 'מחפש באינטרנט',
    foundResults: 'נמצאו תוצאות, מסנתז',
    voiceStart: 'התחל קלט קולי',
    voiceStop: 'עצור הקלטה',
    voiceError: 'שגיאת קלט קולי',
    personality: 'אישיות',
    personalityLevel: 'רמת אישיות',
    language: 'שפה',
    send: 'שלח הודעה',
    stop: 'עצור יצירה',
    diagnostics: 'אבחון',
    connecting: '...מתחבר',
    connected: 'מחובר',
    disconnected: 'מנותק',
    recording: '...מקליט',
    transcribing: '...מתמלל',
    micPermissionDenied: '.הרשאת מיקרופון נדחתה. אנא אפשר גישה למיקרופון',
    title: 'היכנסו למטריקס',
    subtitle: 'העצמי הדיגיטלי של תומר נוסרתי, מרונדר בקוד',
    recommended: 'מומלץ',
    noDownload: 'ללא הורדה',
    instantStart: 'התחלה מיידית',
    continueChat: 'המשך צ׳אט',
    search: 'חיפוש',
    searchPlaceholder: '...חיפוש בהיסטוריית הצ׳אט',
    noResults: '.לא נמצאו תוצאות',
    agents: 'סוכנים',
    agentsDescription: 'כלי MCP ויכולות',
    toolActive: 'פעיל',
    toolInactive: 'לא פעיל',
    readAloud: 'הקראה בקול',
    stopReading: 'הפסק הקראה',
    usingTool: 'משתמש בכלי',
    toolComplete: 'כלי הושלם',
    searchingX: 'X מחפש ב',
    executingCode: 'מריץ קוד',
    queryingMcp: 'שולח שאילתה לסוכן',
  },
};

/** Get all UI strings for the given language. */
export function t(lang: Language): UIStrings {
  return TRANSLATIONS[lang];
}

/** Build the language instruction for the AI system prompt. */
export function getLanguageInstruction(lang: Language): string {
  switch (lang) {
    case 'es':
      return '\n\n## LANGUAGE\nRespond ENTIRELY in Spanish (Colombian casual). Use tuteo, colloquial expressions, and a relaxed Colombian tone. All formatting, headings, explanations in Spanish.';
    case 'he':
      return '\n\n## LANGUAGE\nRespond ENTIRELY in Hebrew (עברית). Use modern conversational Hebrew. All formatting, headings, explanations in Hebrew. Remember the text direction is RTL.';
    default:
      return '';
  }
}
