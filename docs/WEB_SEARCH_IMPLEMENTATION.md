# Web Search Implementation

## Overview

The Grok AI agent on this site has **web search capabilities enabled** via xAI's built-in `web_search` tool. This allows the AI to search the web in real-time when it needs information not available in its context.

## Architecture

The web search feature is implemented across three layers:

### 1. Client Layer (`src/lib/ai/`)

**Tool Definition** (`src/lib/ai/tools.ts`):

```typescript
export const CLOUD_TOOLS: ToolDefinition[] = [
  { type: 'web_search' }, // xAI's built-in web search
  ...FUNCTION_TOOLS, // Custom UI action tools (open_link, navigate)
];
```

**Request Building** (`src/lib/ai/cloud.ts`):

```typescript
function buildRequestBody(messages, modelId, stream, options) {
  return {
    model: modelId,
    input: messages,
    stream,
    ...CLOUD_GENERATION_CONFIG,
    ...(options?.tools && { tools: options.tools }), // ← Tools passed here
    ...(options?.tool_choice && { tool_choice: options.tool_choice }),
  };
}
```

**Usage** (`src/components/widgets/AiChat.tsx`):

```typescript
const result = await cloudChatStream(
  messages,
  selectedCloudModelId,
  onToken,
  signal,
  {
    tools: CLOUD_TOOLS,           // ← Includes web_search
    tool_choice: 'auto',          // ← Let model decide when to search
    onWebSearch: () => { ... },   // ← UI callback when search starts
    onWebSearchFound: () => { ... }, // ← UI callback when search completes
  }
);
```

### 2. Worker Layer (`worker/src/index.ts`)

The Cloudflare Worker acts as a secure proxy that:

1. Validates the request (CORS, rate limiting, payload validation)
2. **Passes through the entire request body** including `tools` and `tool_choice`
3. Forwards to xAI's Responses API with the API key

**Key Implementation**:

```typescript
interface ResponsesAPIRequest {
  model?: string;
  input?: InputMessage[];
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  /** Tools — includes built-in tools (web_search) and function definitions. */
  tools?: unknown[];
  /** Tool choice strategy — passed through to xAI. */
  tool_choice?: unknown;
  [key: string]: unknown;
}

// ... validation logic ...

// Forward to xAI Responses API
const xaiResponse = await fetch(XAI_RESPONSES_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.XAI_API_KEY}`,
  },
  body: JSON.stringify(body), // ← Entire body including tools
});
```

### 3. xAI API Layer

The xAI Responses API:

1. Receives the request with `tools: [{ type: 'web_search' }, ...]`
2. Decides when to use web search based on `tool_choice: 'auto'`
3. Executes web searches server-side when needed
4. Returns results via streaming events:
   - `response.output_item.added` with `type: 'web_search_call'` (search started)
   - `response.output_item.done` with `type: 'web_search_call'` (search completed)
   - `response.output_text.delta` (synthesized response using search results)

## Event Flow

```
User asks question
    ↓
Client sends request with tools: [{ type: 'web_search' }, ...]
    ↓
Worker validates and forwards to xAI
    ↓
xAI decides to use web_search (if needed)
    ↓
xAI emits: response.output_item.added (type: web_search_call)
    ↓
Client shows "Searching the web..." indicator
    ↓
xAI searches the web server-side
    ↓
xAI emits: response.output_item.done (type: web_search_call)
    ↓
Client shows "Found results" indicator
    ↓
xAI streams synthesized response with search results
    ↓
Client displays response to user
```

## Testing

### Automated Tests

Run the test suite to verify tool configuration:

```bash
make test
```

The test file `src/lib/ai/__tests__/tools.test.ts` verifies:

- ✅ `CLOUD_TOOLS` includes `web_search` as the first tool
- ✅ Function tools (open_link, navigate) are properly configured
- ✅ Tool call mapping works correctly

### Manual Testing

To test web search in the live chat:

1. Start the dev server: `make dev`
2. Navigate to `/chat`
3. Select a cloud model (Grok 4.1 Fast or Grok Code Fast)
4. Ask a question that requires current information:
   - "What's the weather in San Francisco today?"
   - "What are the latest news about Celery project?"
   - "Search for Tomer Nosrati on LinkedIn"

You should see:

- 🔍 "Searching the web..." indicator appears
- ✅ "Found results" indicator appears
- 📝 AI response includes information from the web

## Configuration

The web search feature is **always enabled** for cloud models. No configuration needed.

To disable web search (not recommended):

```typescript
// In src/lib/ai/tools.ts
export const CLOUD_TOOLS: ToolDefinition[] = [
  // { type: 'web_search' },  // ← Comment out to disable
  ...FUNCTION_TOOLS,
];
```

## References

- xAI Responses API: https://docs.x.ai/api/endpoints#responses-api
- Built-in tools: https://docs.x.ai/docs/guides/function-calling#built-in-tools
- Research notes: `GROK_MODELS_RESEARCH.md`
