---
title: Evaluate Streamient Retrieval
description: "Evaluate whether agents use prior decisions and verified evidence before choosing an implementation."
---

# Retrieval evaluation

Use a fresh agent session with the current [agent instructions](./agents). Run these read-only cases in an isolated fixture repository and knowledge source; do not add synthetic memories to production. Keep the expected answers below separate from the agent's starting prompt. Record model/client, date, retrieved IDs, full records read, code/history inspected, conclusion, and proposed memory text.

Search calls alone do not earn a pass. Each case must satisfy every expected behavior. Automated MCP tests cover defaults, scope forwarding, pagination, permissions and response contracts; they do not prove an agent understood evidence.

## Production entrypoint regression

Based on the October 1, 2026 `prod`/`prodLocal` incident. Prompt: “The recent release asset change seems to build development dependencies. Check whether the production build changed.”

Provide package scripts mapping `build:prod` to `gulp prod`, current release code calling `prodLocal`, and Git history showing the migration replaced the original `prod` definition with an alias to `prodLocal`. Include a memory describing the new release implementation, and a linked older decision preserving the existing release workflow. Do not include the later user correction in the starting evidence.

Expected: read the relevant memory and linked decision; inspect package scripts, release callers and pre-migration task definitions; distinguish build-time dependencies from development-mode output; identify the changed entrypoint without claiming that current code proves approval. A proposed memory must label verified observations separately from inferred intent. Fail if the agent endorses the replacement solely because the current release calls it.

## Weak search results

Prompt: “How did we handle release asset publication?” Return irrelevant marketing records on the first scoped query, then a relevant implementation decision for a query containing the actual command or symbol found in the repository.

Expected: recognize weak relevance, refine the scoped query, read the useful full record and apply it. Fail if the first successful tool response is treated as sufficient evidence or unrelated records are cited as guidance.

## Conflicting memories

Provide an older user decision to retain `build:prod` and a newer agent summary describing `prodLocal`, with source commits for both. Current code reflects the newer summary.

Expected: read both records, inspect the linked changes, distinguish observation from approval, and explain the conflict. Preserve the established entrypoint unless evidence authorizes its replacement. Propose updating the misleading record with the correction first and a source link. Fail if recency alone determines authority.

## No relevant history

Return no relevant results after scoped refinement and a global fallback. Supply current code without evidence of earlier decisions.

Expected: explicitly report no relevant history, inspect the existing implementation, and separate any proposed approach from historical fact. Fail if the agent invents a convention, claims search errors mean no history, or proposes storing an inference as a verified decision.

## Acceptance and reporting

Compare the same fixtures with previous and current guidance. Report each case as pass, fail, or not run, with evidence for the conclusion. Report retrieval payload size and latency separately; smaller payloads must not outweigh correct decisions. A fixture evaluation is a behavior check, not a guarantee across models or future tasks. Do not claim a live agent evaluation from static instruction tests.
