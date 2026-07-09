---
name: streamient-memory
description: Retrieve and preserve durable context with Streamient notes and memories. Use when resuming project work, applying prior decisions or preferences, finding stored specifications, maintaining continuity across sessions, or when the user asks to remember an outcome. Do not use for simple stateless questions or when the user asks not to access or store memory.
---

# Streamient Memory

Use Streamient as a private, cross-session context layer. Retrieve only relevant context and save only durable outcomes.

## Retrieve context

1. Form a focused query from the task.
2. Use `recall_memory` for prior decisions, preferences, debugging insights, and task outcomes.
3. Use `search_notes` for specifications, documentation, meeting notes, and longer structured material.
4. Start with three results. Broaden the query or increase the result count only when results are weak.
5. Use `read_memory` or `read_note` when the complete selected item is needed.
6. Use `list_projects` or `get_project` only when project scope is unclear. Never guess a project ID.
7. Apply retrieved context only when relevant. Prefer newer explicit user instructions when they conflict with stored context.

## Preserve outcomes

Write only when the task produces reusable context:

- Use `store_memory` for concise decisions, preferences, debugging solutions, conventions, and task outcomes.
- Use `create_note` for structured specifications, architecture decisions, plans, and meeting notes.
- Call `suggest_memory_tags` before `store_memory`; reuse existing descriptive tags when suitable.
- Include enough source or task context to make the stored item understandable later.
- Skip writes for trivial answers, transient status, raw logs, or information already stored.

## Safety and quality

- Do not store passwords, access tokens, API keys, authentication codes, or other credentials.
- Do not store sensitive personal information unless the user explicitly requests it and confirms the intended content.
- Keep retrieval and writes within the user's authenticated Streamient workspace and selected project.
- Do not claim that context was retrieved or stored unless the corresponding tool call succeeded.
- If Streamient is unavailable, continue when possible and state briefly that persistent context could not be accessed or saved.
