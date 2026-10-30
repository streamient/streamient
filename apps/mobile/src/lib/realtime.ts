import { io, type Socket } from "socket.io-client";
import type { StreamientApi } from "./api";
import type { ServerOption } from "../types";

const RECORD_EVENTS = ["note:created", "note:updated", "note:deleted", "memory:created", "memory:updated", "memory:deleted", "url:created", "url:updated", "url:deleted", "email:created", "email:updated", "email:deleted", "counts:refresh", "note-import:progress", "note-import:processing", "note-import:complete", "note-import:failed"] as const;

export function startRealtime(api: StreamientApi, server: ServerOption, identity: { hostId: string; userId: string }, onEvent: (event: string, payload: Record<string, unknown>) => void) {
	let socket: Socket | null = null;
	let stopped = false;
	let refreshTimer = 0;
	const renew = async () => {
		if (stopped) return;
		try {
			const result = await api.socketToken();
			if (stopped) return;
			if (!socket) {
				socket = io(server.baseUrl, { autoConnect: false, auth: { token: result.token }, reconnection: true, transports: ["websocket"] });
				// Catch up on every connect, including a restarted realtime's first one, so events in the gap are not lost.
				socket.on("connect", () => { socket?.emit("subscribe", `tenant:${identity.hostId}`, identity.userId, identity.hostId, "mobile"); onEvent("connection:reconnected", {}); });
				for (const event of RECORD_EVENTS) socket.on(event, (payload: Record<string, unknown> = {}) => onEvent(event, payload));
			} else socket.auth = { token: result.token };
			if (!socket.connected) socket.connect();
			window.clearTimeout(refreshTimer);
			refreshTimer = window.setTimeout(renew, Math.max(30, result.refresh_after) * 1000);
		} catch {
			if (stopped) return;
			refreshTimer = window.setTimeout(renew, 10_000);
		}
	};
	void renew();
	return () => { stopped = true; window.clearTimeout(refreshTimer); socket?.io.removeAllListeners(); socket?.removeAllListeners(); socket?.disconnect(); };
}
