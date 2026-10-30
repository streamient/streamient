const PREFIX = "streamient_cache:";

export async function getCachedJson<T>(namespace: string, key: string): Promise<T | null> {
	try {
		const raw = localStorage.getItem(`${PREFIX}${encodeURIComponent(namespace)}:${key}`);
		if (!raw) return null;
		return (JSON.parse(raw) as { value: T }).value;
	} catch {
		return null;
	}
}

export async function setCachedJson(namespace: string, key: string, value: unknown) {
	try {
		localStorage.setItem(`${PREFIX}${encodeURIComponent(namespace)}:${key}`, JSON.stringify({ cached_at: Date.now(), value }));
		const keys = Object.keys(localStorage).filter((item) => item.startsWith(PREFIX));
		if (keys.length > 80) for (const item of keys.slice(0, keys.length - 80)) localStorage.removeItem(item);
	} catch {
		// Cache writes are best effort.
	}
}

export function saveDraft(key: string, value: unknown) {
	localStorage.setItem(`streamient_draft:${key}`, JSON.stringify(value));
}

export function loadDraft<T>(key: string): T | null {
	try {
		const value = localStorage.getItem(`streamient_draft:${key}`);
		return value ? JSON.parse(value) as T : null;
	} catch {
		return null;
	}
}

export function clearDraft(key: string) {
	localStorage.removeItem(`streamient_draft:${key}`);
}

export function clearCachedJson(namespace: string) {
	const prefix = `${PREFIX}${encodeURIComponent(namespace)}:`;
	for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
}
