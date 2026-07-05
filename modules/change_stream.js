// ── Change streams removed ──────────────────────────────────────────
// Typesense indexing is now handled by the Streamient indexer scheduler task,
// which runs every 20 seconds and
// batch-imports unindexed documents. This avoids overwhelming
// Typesense with concurrent requests from change stream events.
//
// Trashing / permanent delete already call removeDocument() directly
// in the service layer (note_service, memory_service, url_service,
// trash_service), so no change stream is needed for removals.
