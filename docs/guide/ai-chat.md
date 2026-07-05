# AI Chat

Streamient includes a built-in AI chat that lets you search, analyze, and manage your team's memory layer using natural language.

## What You Can Do

### Search Your Knowledge

Ask questions in plain English. The AI searches across all your notes, memories, URLs, and crawled pages using semantic vector search.

> "What did I save about Docker networking?"

> "Find notes related to project planning"

### Get Stats

Ask about your data and the AI returns live counts from your collections.

> "How many notes do I have?"

> "Show me my usage stats"

### Create Items via Chat

Create notes, store memories, or save URLs directly from the chat.

> "Remember that the deploy key expires on June 15"

> "Save this URL: https://example.com/article"

> "Create a note about today's meeting decisions"

### Analyze & Summarize

Request summaries, comparisons, or deeper analysis across your stored knowledge. The AI retrieves relevant context and generates an answer.

> "Summarize everything I have about our API design"

> "Compare my notes on React vs Vue"

### Manage Items

Move items between projects or delete them. Destructive actions (like delete) require confirmation before executing.

> "Move that note to the Work project"

> "Delete the memory about the old server"

## How It Works

The chat uses a two-tier LLM architecture:

1. **Intent classification** — A lightweight model (`NL_SEARCH_MODEL`) classifies your message as search, stats, action, analysis, or conversation
2. **Execution** — Based on the intent, the system either searches Typesense, calls service functions, or routes to a heavier model (`CHAT_AI_MODEL`) for analysis

Search results are powered by Typesense vector embeddings across all your data types.

## Using the Chat

The chat sidebar is available on every page. To start:

1. Type your question or command in the input field
2. Press Enter or click Send
3. Results appear as cards in the main content area
4. Click any result to open it in a modal for viewing or editing

### Project Filter

Use the project dropdown above the chat input to scope searches to a specific project. Leave it on "All" to search everything.

### Conversation History

- Click the history icon to browse your last 10 conversations
- Click any previous conversation to resume it
- Click the new conversation button to start fresh

## Configuration

AI Chat requires at least one LLM provider configured. See [Configuration](/selfhosted/configuration) for the relevant environment variables (`CHAT_AI_MODEL`, `NL_SEARCH_MODEL`, `GOOGLE_API_KEY`, etc.).
