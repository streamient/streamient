import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(relativePath) {
	return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

describe('Streamient Mobile source contracts', () => {
	it('applies HTTP and socket records through one stable item updater without reloads', () => {
		const app = read('apps/mobile/src/App.tsx');
		const realtimeBlock = app.slice(app.indexOf('realtimeEventHandler.current ='), app.indexOf('async function openSharedContent'));

		assert.match(app, /function upsertRecord\(/);
		assert.match(app, /setRecords\(\(current\) => upsertRecord\(current, result\.record, activeProjectId, filter\)\)/);
		assert.match(realtimeBlock, /setRecords\(\(current\) => upsertRecord\(current, record, activeProjectId, filter\)\)/);
		assert.match(app, /filter !== "all" && record\.type !== filter/);
		assert.match(realtimeBlock, /event === "counts:refresh"[\s\S]*refreshCounts\(\)/);
		assert.match(realtimeBlock, /api\.record\(type, id\)[\s\S]*refreshCounts\(\)/);
		assert.doesNotMatch(realtimeBlock, /loadFeed\(|location\.reload|window\.location|navigate/);
		assert.doesNotMatch(app, /location\.reload/);
	});

	it('resumes reconnects by cursor and persists uploads and pending shares', () => {
		const app = read('apps/mobile/src/App.tsx');
		const realtime = read('apps/mobile/src/lib/realtime.ts');
		const uploads = read('apps/mobile/src/lib/uploads.ts');
		const shares = read('apps/mobile/src/lib/shareTarget.ts');

		assert.match(realtime, /socket\.io\.on\("reconnect"/);
		assert.match(app, /connection:reconnected[\s\S]*applyChanges\(\)/);
		assert.match(app, /startRealtime\(api, server, \{ hostId: realtimeHostId, userId: realtimeUserId \}/);
		assert.doesNotMatch(app, /startRealtime\(api, server, bootstrap/);
		assert.match(uploads, /indexedDB\.open/);
		assert.match(uploads, /api\.uploadStatus\(session\.id, true\)/);
		assert.match(uploads, /Math\.min\(session\.chunk_size/);
		assert.match(shares, /PENDING_SHARE_KEY/);
		assert.match(app, /loadPendingShare\(\)/);
		assert.match(app, /function closeAdd\(\)[\s\S]*clearPendingShare\(\)/);
	});

	it('configures TipTap link support once through StarterKit', () => {
		const editor = read('apps/mobile/src/components/RichTextEditor.tsx');

		assert.match(editor, /StarterKit\.configure\(\{ link: \{ openOnClick: false \} \}\)/);
		assert.doesNotMatch(editor, /import Link from/);
	});

	it('keeps mutations and AI unavailable while offline', () => {
		const app = read('apps/mobile/src/App.tsx');

		assert.match(app, /function openAdd[\s\S]*if \(!online\)/);
		assert.match(app, /function changeView[\s\S]*next === "ai" && !online/);
		assert.match(app, /async function saveNote[\s\S]*!online/);
		assert.match(app, /async function saveUrl[\s\S]*!online/);
		assert.match(app, /async function startFileUpload[\s\S]*!online/);
	});

	it('closes record detail before opening its note editor drawer', () => {
		const app = read('apps/mobile/src/App.tsx');
		const editDetail = app.slice(app.indexOf('function editDetail()'), app.indexOf('async function runSearch()'));

		assert.match(editDetail, /setDetail\(null\);[\s\S]*setAddDrawer\(true\);/);
	});

	it('refreshes expiring OAuth tokens before protected requests', () => {
		const api = read('apps/mobile/src/lib/api.ts');

		assert.match(api, /accessTokenNeedsRefresh\(\)/);
		assert.match(api, /expires_in \* 1000 - 30_000/);
		assert.match(api, /if \(retry && this\.accessTokenNeedsRefresh\(\)\)/);
		assert.match(api, /navigator\.onLine && !\(error instanceof TypeError\)/);
		assert.match(api, /payload\.sub \|\| payload\.userId/);
		assert.match(api, /getCachedJson<T>\(this\.cacheNamespace/);
	});

	it('shows a cloud-first login with custom servers behind Advanced and working icons', () => {
		const app = read('apps/mobile/src/App.tsx');
		const config = read('apps/mobile/src/lib/config.ts');
		const login = read('apps/mobile/src/components/LoginScreen.tsx');
		const styles = read('apps/mobile/src/styles.css');

		assert.match(login, /Continue with Cloud/);
		assert.match(login, />Advanced</);
		assert.match(login, /Custom server URL/);
		assert.doesNotMatch(login, /Local development/);
		assert.doesNotMatch(login, /server-options/);
		assert.match(app, /useState<ServerOption>\(HOSTED_SERVER\)/);
		assert.match(app, /storedServer \|\| HOSTED_SERVER/);
		assert.doesNotMatch(config, /export const LOCAL_SERVER/);
		assert.doesNotMatch(login, /LOCAL_SERVER/);
		assert.match(styles, /font-family: "Material Symbols Outlined Variable"/);
		assert.match(styles, /font-feature-settings: "liga"/);
	});

	it('surfaces module, render, and saved-auth startup failures instead of staying blank', () => {
		const app = read('apps/mobile/src/App.tsx');
		const main = read('apps/mobile/src/main.tsx');
		const restoreBlock = app.slice(app.indexOf('void (async () => {'), app.indexOf('\n\t\t})();', app.indexOf('void (async () => {')));

		assert.match(main, /import\("\.\/App"\)/);
		assert.match(main, /class StartupBoundary/);
		assert.match(main, /Streamient couldn’t start/);
		assert.match(main, /root\.render\(<StartupFailure \/>\)/);
		assert.match(restoreBlock, /try \{[\s\S]*Promise\.all\(\[loadSelectedServer\(\), loadTokens\(\)\]\)/);
		assert.match(restoreBlock, /catch \(restoreError\)[\s\S]*setTokens\(null\)/);
		assert.match(restoreBlock, /finally \{[\s\S]*setAuthReady\(true\)/);
	});

	it('re-enables login only when returning from the browser history cache', () => {
		const app = read('apps/mobile/src/App.tsx');
		const handler = app.match(/const resumeLogin = \(event: PageTransitionEvent\) => \{ ([^\n]+) \};/)[1];
		const updates = [];
		const resumeLogin = new Function('event', 'setLoginLoading', handler);
		resumeLogin({ persisted: false }, (value) => updates.push(value));
		assert.deepEqual(updates, []);
		resumeLogin({ persisted: true }, (value) => updates.push(value));
		assert.deepEqual(updates, [false]);
		assert.match(app, /window\.addEventListener\("pageshow", resumeLogin\)/);
		assert.match(app, /return \(\) => window\.removeEventListener\("pageshow", resumeLogin\)/);
	});

	it('keeps release icons inside platform mask safe zones and advances native builds', () => {
		const androidBuild = read('apps/mobile/android/app/build.gradle');
		const assets = read('apps/mobile/scripts/generate-assets.mjs');
		const iosProject = read('apps/mobile/ios/App/App.xcodeproj/project.pbxproj');
		const iosExport = read('apps/mobile/ios/ExportOptions.plist');
		const iosRelease = read('apps/mobile/scripts/ios-release-archive.sh');
		const iosUpload = read('apps/mobile/ios/UploadOptions.plist');
		const playAssets = read('apps/mobile/scripts/generate-play-store-assets.mjs');

		assert.equal((assets.match(/size \* 0\.64/g) || []).length, 2);
		assert.equal((assets.match(/size \* 0\.48/g) || []).length, 1);
		assert.doesNotMatch(assets, /size \* 0\.(?:75|58)/);
		assert.match(playAssets, /resize\(288, 288/);
		assert.match(playAssets, /left: 112, top: 112/);
		assert.match(androidBuild, /versionCode 3/);
		assert.match(androidBuild, /versionName "1\.0"/);
		assert.equal((iosProject.match(/CURRENT_PROJECT_VERSION = 5;/g) || []).length, 4);
		assert.equal((iosProject.match(/MARKETING_VERSION = 1\.0;/g) || []).length, 4);
		assert.equal((iosProject.match(/CODE_SIGN_STYLE = Automatic;/g) || []).length, 4);
		assert.match(iosExport, /<key>signingStyle<\/key>\s*<string>automatic<\/string>/);
		assert.match(iosUpload, /<key>signingStyle<\/key>\s*<string>automatic<\/string>/);
		assert.match(iosRelease, /STREAMIENT_IOS_BUILD_NUMBER:-5/);
		assert.match(iosRelease, /CODE_SIGNING_ALLOWED=NO/);
		assert.match(iosRelease, /embedded\.mobileprovision/);
		assert.match(iosRelease, /plutil -extract Entitlements/);
		assert.match(iosRelease, /codesign --verify --deep --strict/);
		assert.equal((iosRelease.match(/-allowProvisioningUpdates/g) || []).length, 3);
	});

	it('uses the brand as records home and the bottom Projects action as the switcher', () => {
		const app = read('apps/mobile/src/App.tsx');
		const bottomNav = read('apps/mobile/src/components/BottomNav.tsx');
		const chooseProject = app.slice(app.indexOf('function chooseProject'), app.indexOf('function showAllRecords'));
		const showAllRecords = app.slice(app.indexOf('function showAllRecords'), app.indexOf('function changeView'));

		assert.match(app, /className="brand-home"[\s\S]*src="\/favicon\.svg"/);
		assert.doesNotMatch(app, /className="project-trigger"/);
		assert.match(app, /<BottomNav active=\{view\} onProjects=\{\(\) => setProjectDrawer\(true\)\}/);
		assert.match(bottomNav, /onProjects: \(\) => void/);
		assert.match(bottomNav, /onClick=\{onProjects\}/);
		assert.doesNotMatch(bottomNav, /onChange/);
		assert.match(chooseProject, /setFilter\("all"\)/);
		assert.match(chooseProject, /setView\("projects"\)/);
		assert.match(showAllRecords, /setProjectDrawer\(false\)/);
		assert.match(showAllRecords, /setFilter\("all"\)/);
		assert.match(showAllRecords, /setView\("projects"\)/);
		assert.match(showAllRecords, /if \(refreshCurrent\) void loadFeed\(\)/);
	});

	it('resets AI to all projects on entry and links the other product apps from Settings', () => {
		const app = read('apps/mobile/src/App.tsx');
		const changeView = app.slice(app.indexOf('function changeView'), app.indexOf('if (!authReady)'));

		assert.match(changeView, /if \(next === "ai"\) setChatAllProjects\(true\)/);
		assert.match(app, /checked=\{props\.allProjects\}[\s\S]*props\.setAllProjects/);
		assert.match(app, /Browser\.open\(\{ url: event\.currentTarget\.href \}\)/);
		assert.match(app, /Built by the team behind:/);
		for (const value of ['https://razuna.com/', 'https://managani.com/', 'https://helpmonks.com/', 'https://mailtwine.com/']) assert.match(app, new RegExp(value.replaceAll('.', '\\.')));
		assert.doesNotMatch(app.slice(app.indexOf('const FAMILY_APPS'), app.indexOf('function activeProjectKey')), /streamient\.com/);
	});

	it('configures native share targets and bounded URI reads on both platforms', () => {
		const manifest = read('apps/mobile/android/app/src/main/AndroidManifest.xml');
		const androidReader = read('apps/mobile/android/app/src/main/java/com/streamient/mobile/StreamientFileReaderPlugin.java');
		const iosReader = read('apps/mobile/ios/App/App/StreamientFileReaderPlugin.swift');
		const shareExtension = read('apps/mobile/ios/App/ShareExtension/ShareViewController.swift');
		const packageJson = read('apps/mobile/package.json');

		assert.match(packageJson, /"@capgo\/capacitor-share-target": "8\.0\.49"/);
		assert.match(manifest, /android\.intent\.action\.SEND/);
		assert.match(manifest, /application\/pdf/);
		assert.match(androidReader, /20_000_000/);
		assert.match(androidReader, /openInputStream/);
		assert.match(iosReader, /20_000_000/);
		assert.match(iosReader, /read\(upToCount:/);
		assert.match(shareExtension, /share-target-data/);
		assert.match(shareExtension, /com\.streamient\.mobile:\/\/share/);
		assert.match(shareExtension, /provider\.suggestedName != nil \|\| !type\.conforms\(to: \.text\)/);
	});

	it('keeps upload chunks outside normal request-count limits and documents failure branches', () => {
		const limits = read('middleware/rate_limit.js');
		const service = read('services/note_import_service.js');
		const importService = read('services/import_service.js');

		assert.match(limits, /isMobileUploadChunk\(request\)/);
		assert.match(limits, /isSearchReadApi\(request\) \|\| isMobileUploadChunk\(request\)/);
		assert.match(service, /insufficient_storage/);
		assert.match(service, /checksum_mismatch/);
		assert.match(service, /overlap_conflict/);
		assert.match(service, /state: 'failed'/);
		assert.match(importService, /spawn\('pdftotext'/);
		assert.doesNotMatch(importService, /readFile\(|readFileSync\(/);
	});
});
