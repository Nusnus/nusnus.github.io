# Grok Models Research - March 2026

## Executive Summary

Research completed on the latest xAI Grok models. The codebase is **already up-to-date** with the latest Grok 4.1 Fast models and reasoning variants.

## Latest Grok Models (March 2026)

### Grok 4.1 Fast (Released: January 21, 2026)

- **Model ID**: `grok-4-1-fast`
- **Status**: Latest flagship model, generally available
- **Features**:
  - 2M token context window
  - Built-in reasoning capabilities
  - Native tool calling (web_search, x_search, code_execution)
  - Structured outputs support
  - Vision capabilities
  - Audio support
- **Pricing**: $0.20 input / $0.50 output per 1M tokens

### Grok 4.1 Fast Reasoning

- **Model ID**: `grok-4-1-fast-reasoning`
- **Status**: Available (announced Feb 2, 2026)
- **Features**: Explicit reasoning mode with enhanced analytical thinking
- **Use Case**: Complex problem-solving, step-by-step analysis

### Grok 4.1 Fast Non-Reasoning

- **Model ID**: `grok-4-1-fast-non-reasoning`
- **Status**: Available
- **Features**: Faster responses without reasoning overhead
- **Use Case**: Quick responses, simple queries

### Grok Code Fast 1

- **Model ID**: `grok-code-fast` or `grok-code-fast-1`
- **Status**: Available (released Aug 26, 2025)
- **Features**: Code-specialized with reasoning
- **Use Case**: Code editors, technical explanations, programming

## Previous Generation

### Grok 4 (Released: July 9, 2025)

- **Model ID**: `grok-4`
- **Status**: Available but superseded by Grok 4.1 Fast
- **Pricing**: $3.00 input / $15.00 output per 1M tokens (more expensive)

## Current Configuration Status

### ✅ Worker Allowlist (worker/src/index.ts)

```typescript
const ALLOWED_MODELS: ReadonlySet<string> = new Set([
  'grok-4-1-fast', // ✅ Latest default
  'grok-4-1-fast-reasoning', // ✅ Reasoning variant
  'grok-4-1-fast-non-reasoning', // ✅ Non-reasoning variant
  'grok-code-fast', // ✅ Code-specialized
  'grok-code-fast-1', // ✅ Code-specialized (alt ID)
]);
```

### ✅ Frontend Config (src/lib/ai/config.ts)

```typescript
export const CLOUD_MODELS: CloudModelInfo[] = [
  {
    id: 'grok-4-1-fast', // ✅ Latest model
    name: 'Grok 4.1 Fast',
    description:
      'The strongest available model. Latest Grok 4.1 with reasoning, 2M context window.',
    recommended: true,
  },
  {
    id: 'grok-code-fast', // ✅ Code-specialized
    name: 'Grok Code Fast',
    description: 'Code-specialized with reasoning.',
  },
];

export const DEFAULT_CLOUD_MODEL_ID = 'grok-4-1-fast'; // ✅ Correct default
```

## API Capabilities

### Responses API (Generally Available)

- Stateful conversation management
- Server-side tool execution
- Event-driven streaming (SSE)
- Built-in web search
- Native function calling

### Supported Tools

- `web_search` - Real-time web search
- `x_search` - X/Twitter search
- `code_execution` - Execute code
- `collections_search` - RAG over uploaded files
- Remote MCP tools

### Additional Features

- **Batch API** (Jan 28, 2026) - Efficient batch processing
- **Voice Agent API** (Dec 16, 2025) - Voice interactions
- **Video Generation** (Jan 28, 2026) - New capability
- **Image Generation** - Enhanced model
- **Files API** - Upload and chat with files
- **Structured Outputs** - JSON schema enforcement

## Reasoning Mode

The `grok-4-1-fast` model includes reasoning by default. For explicit control:

- Use `grok-4-1-fast-reasoning` to force reasoning mode
- Use `grok-4-1-fast-non-reasoning` to disable reasoning

Reasoning mode provides:

- Step-by-step analytical thinking
- Enhanced problem-solving
- Transparent reasoning process
- Better accuracy on complex tasks

## Recommendations

### ✅ No Changes Needed

The codebase is already configured correctly:

1. Worker allowlist includes all latest models
2. Frontend uses `grok-4-1-fast` as default
3. All reasoning variants are available
4. Model descriptions are accurate

### Optional Enhancements

If desired, could add:

1. Expose reasoning/non-reasoning variants in UI
2. Add model selection for reasoning vs. speed preference
3. Update knowledge base to mention Grok 4.1 Fast features

## Sources

- xAI Release Notes: https://docs.x.ai/developers/release-notes
- xAI API Documentation: https://docs.x.ai/
- Azure Foundry Models: https://learn.microsoft.com/en-us/azure/foundry/
- Oracle Cloud Documentation: https://docs.oracle.com/en-us/iaas/
- LiteLLM Documentation: https://docs.litellm.ai/docs/providers/xai

## Conclusion

**Status**: ✅ **COMPLETE - No action required**

The codebase is already using the latest Grok 4.1 Fast models with proper configuration. All reasoning variants are in the allowlist. The default model (`grok-4-1-fast`) is the newest and most capable model from xAI.
