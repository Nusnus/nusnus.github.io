export type Language = 'en' | 'es';

export interface Translations {
  // Chat header
  aiInterface: string;
  neuralNetworkActive: string;

  // Status bar
  cloud: string;

  // Chat input
  enterYourQuery: string;
  stopGenerating: string;
  sendMessage: string;
  neuralInterface: string;
  queries: string;
  responsesInaccurate: string;
  sessionLimitReached: string;
  maxMessagesPerSession: string;
  initializeNewSession: string;

  // Session history
  chatHistory: string;
  clearAll: string;
  closeHistory: string;
  noChatHistory: string;
  messages: string;
  deleteSession: string;

  // Center card
  failedToLoad: string;
  tryAgain: string;

  // Model picker
  selectModel: string;

  // Common
  toggleChatHistory: string;
}

const en: Translations = {
  // Chat header
  aiInterface: 'AI INTERFACE',
  neuralNetworkActive: 'Neural Network Active',

  // Status bar
  cloud: 'Cloud',

  // Chat input
  enterYourQuery: 'Enter your query...',
  stopGenerating: 'Stop generating',
  sendMessage: 'Send message',
  neuralInterface: 'Neural Interface',
  queries: 'queries',
  responsesInaccurate: 'Responses may be inaccurate',
  sessionLimitReached: 'SESSION LIMIT REACHED',
  maxMessagesPerSession: 'Maximum {count} messages per session',
  initializeNewSession: 'INITIALIZE NEW SESSION',

  // Session history
  chatHistory: 'Chat History',
  clearAll: 'Clear All',
  closeHistory: 'Close history',
  noChatHistory: 'No chat history yet.',
  messages: 'messages',
  deleteSession: 'Delete session',

  // Center card
  failedToLoad: 'Failed to Load',
  tryAgain: 'Try Again',

  // Model picker
  selectModel: 'Select Model',

  // Common
  toggleChatHistory: 'Toggle chat history',
};

const es: Translations = {
  // Chat header
  aiInterface: 'INTERFAZ IA',
  neuralNetworkActive: 'Red Neuronal Activa',

  // Status bar
  cloud: 'Nube',

  // Chat input
  enterYourQuery: 'Ingresa tu consulta...',
  stopGenerating: 'Detener generación',
  sendMessage: 'Enviar mensaje',
  neuralInterface: 'Interfaz Neural',
  queries: 'consultas',
  responsesInaccurate: 'Las respuestas pueden ser inexactas',
  sessionLimitReached: 'LÍMITE DE SESIÓN ALCANZADO',
  maxMessagesPerSession: 'Máximo {count} mensajes por sesión',
  initializeNewSession: 'INICIALIZAR NUEVA SESIÓN',

  // Session history
  chatHistory: 'Historial de Chat',
  clearAll: 'Borrar Todo',
  closeHistory: 'Cerrar historial',
  noChatHistory: 'Aún no hay historial de chat.',
  messages: 'mensajes',
  deleteSession: 'Eliminar sesión',

  // Center card
  failedToLoad: 'Error al Cargar',
  tryAgain: 'Intentar de Nuevo',

  // Model picker
  selectModel: 'Seleccionar Modelo',

  // Common
  toggleChatHistory: 'Alternar historial de chat',
};

export const translations: Record<Language, Translations> = {
  en,
  es,
};

export function getTranslation(
  lang: Language,
  key: keyof Translations,
  params?: Record<string, string | number>,
): string {
  let text = translations[lang][key];

  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(`{${param}}`, String(value));
    });
  }

  return text;
}
