import { CapacitorShareTarget, type ShareReceivedEvent } from "@capgo/capacitor-share-target";
import { Capacitor } from "@capacitor/core";
import { getStoredJson, removeStoredValue, setStoredJson } from "./secureStorage";
import type { SharePayload } from "../types";

const PENDING_SHARE_KEY = "pending_share";

function normalize(event: ShareReceivedEvent): SharePayload {
	return { title: event.title || "", texts: event.texts || [], files: (event.files || []).map((file) => ({ uri: file.uri, name: file.name, mimeType: file.mimeType })) };
}

export async function loadPendingShare() {
	return getStoredJson<SharePayload>(PENDING_SHARE_KEY);
}

export async function clearPendingShare() {
	await removeStoredValue(PENDING_SHARE_KEY);
}

export async function listenForShares(callback: (share: SharePayload) => void) {
	if (!Capacitor.isNativePlatform()) return () => undefined;
	const listener = await CapacitorShareTarget.addListener("shareReceived", async (event) => {
		const share = normalize(event);
		try { await setStoredJson(PENDING_SHARE_KEY, share); callback(share); } catch (error) { console.error("Unable to receive shared content", error); }
	});
	return () => void listener.remove().catch((error) => console.error("Unable to remove share listener", error));
}

export function sharedTextKind(share: SharePayload) {
	if (share.files.length) return "file" as const;
	const text = share.texts.join("\n").trim();
	try {
		const parsed = new URL(text);
		if (["http:", "https:"].includes(parsed.protocol)) return "url" as const;
	} catch {
		// Shared text is a note.
	}
	return "note" as const;
}
