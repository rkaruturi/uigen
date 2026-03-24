# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps + Prisma generate + migrations)
npm run setup

# Development (Turbopack, port 3000)
npm run dev

# Run all tests
npm test

# Lint
npm run lint

# Production build
npm run build

# Reset database
npm run db:reset
```

There is no command to run a single test file directly; use `npm test` and Vitest's filtering (e.g., `npm test -- --reporter=verbose path/to/test`).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in natural language; Claude generates them with live preview.

### Request Flow

```
User types prompt
  → POST /api/chat (streaming, Vercel AI SDK)
  → Claude calls tools: str_replace_editor (create/edit files) + file_manager (list/delete)
  → VirtualFileSystem updates in-memory state
  → PreviewFrame (iframe) transpiles JSX via Babel in-browser and renders
  → Project saved to SQLite (if authenticated)
```

### Key Concepts

**VirtualFileSystem** (`src/lib/file-system.ts`): All generated files live entirely in memory. The VFS is serialized to JSON and stored in the `Project.data` column when saving. No files are written to disk.

**Provider** (`src/lib/provider.ts`): Returns either the real Anthropic Claude model (requires `ANTHROPIC_API_KEY` in `.env`) or a `MockLanguageModel` fallback that generates static components. The mock exists so the app is usable without an API key.

**Tool Calling** (`src/lib/tools/`): Claude uses two tools during generation — `str_replace_editor` for creating and patching files, and `file_manager` for listing and deleting files. Tool execution happens server-side in the chat route and results are applied to the VFS via React context.

**State** (`src/lib/contexts/`): Two React contexts manage global state:
- `FileSystemProvider`: VFS contents, active file, file operations
- `ChatProvider`: Message history, streaming state, project ID

### Layout

`src/app/main-content.tsx` renders three resizable panels:
- Left (35%): `ChatInterface` for prompts and message history
- Right (65%): Toggle between `PreviewFrame` (iframe rendering) and a split `FileTree` / `CodeEditor` (Monaco)

### Routing

- `/` — Home; redirects to an existing or newly created project
- `/[projectId]` — Project workspace (main UI)
- `/api/chat` — Streaming POST endpoint for AI generation

### Auth

JWT sessions via `jose` (`src/lib/auth.ts`), 7-day expiry. Server actions in `src/actions/index.ts` handle sign-up, sign-in, sign-out, and `getUser`. Anonymous use is supported — projects are saved without a `userId`.

### Database

Prisma + SQLite (`prisma/dev.db`). Two models: `User` and `Project`. `Project.messages` stores chat history as JSON; `Project.data` stores the serialized VFS.

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).

## Environment

- `ANTHROPIC_API_KEY` — required for real AI generation; omit to use the mock provider
- Node.js 18+ required; a `node-compat.cjs` shim handles Web Storage API differences in Node 25+
