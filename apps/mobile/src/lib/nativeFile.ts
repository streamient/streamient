import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeFileReaderPlugin = {
	removeSharedFile(options: { uri: string }): Promise<void>;
	stat(options: { uri: string }): Promise<{ size: number }>;
	readChunk(options: { uri: string; offset: number; length: number }): Promise<{ data: string; bytesRead: number }>;
};

const NativeFileReader = registerPlugin<NativeFileReaderPlugin>("StreamientFileReader");

function decodeBase64(value: string) {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

export async function uriSize(uri: string) {
	if (uri.startsWith("data:")) return (await fetch(uri)).blob().then((blob) => blob.size);
	if (Capacitor.isNativePlatform()) return (await NativeFileReader.stat({ uri })).size;
	const response = await fetch(uri, { method: "HEAD" });
	const size = Number(response.headers.get("Content-Length"));
	if (!Number.isSafeInteger(size) || size < 0) throw new Error("The shared file size is unavailable");
	return size;
}

export async function uriChunk(uri: string, offset: number, length: number) {
	if (uri.startsWith("data:")) return (await fetch(uri)).blob().then((blob) => blob.slice(offset, offset + length));
	if (Capacitor.isNativePlatform()) {
		const result = await NativeFileReader.readChunk({ uri, offset, length });
		return new Blob([decodeBase64(result.data)]);
	}
	const response = await fetch(uri, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
	if (!response.ok) throw new Error("Unable to read the shared file");
	const blob = await response.blob();
	if (response.status === 200 && offset > 0) return blob.slice(offset, offset + length);
	return blob.slice(0, length);
}

export async function removeSharedFile(uri: string) {
	if (Capacitor.getPlatform() === "ios") await NativeFileReader.removeSharedFile({ uri });
}
