#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
IOS_DIR="${REPO_ROOT}/apps/mobile/ios"
PROJECT_PATH="${IOS_DIR}/App/App.xcodeproj"
BUILD_DIR="${IOS_DIR}/App/build"
VERSION="${STREAMIENT_IOS_VERSION:-1.0}"
BUILD_NUMBER="${STREAMIENT_IOS_BUILD_NUMBER:-5}"
ARCHIVE_PATH="${STREAMIENT_IOS_ARCHIVE_PATH:-${BUILD_DIR}/Streamient-${VERSION}-${BUILD_NUMBER}.xcarchive}"
EXPORT_PATH="${STREAMIENT_IOS_EXPORT_PATH:-${BUILD_DIR}/export-${BUILD_NUMBER}}"
UPLOAD="${STREAMIENT_IOS_UPLOAD:-false}"

if [ "${1:-}" = "--upload" ]; then
	UPLOAD=true
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
	echo "xcodebuild is required" >&2
	exit 1
fi
if [ -e "${ARCHIVE_PATH}" ]; then
	echo "Archive already exists: ${ARCHIVE_PATH}" >&2
	exit 1
fi
if [ -e "${EXPORT_PATH}" ]; then
	echo "Export path already exists: ${EXPORT_PATH}" >&2
	exit 1
fi

export NODE_ENV=production
export VITE_ENABLE_LOCAL_SERVER=false

cd "${REPO_ROOT}"
pnpm --dir apps/mobile build
pnpm --dir apps/mobile exec cap sync ios
mkdir -p "${BUILD_DIR}"

xcodebuild archive \
	-project "${PROJECT_PATH}" \
	-scheme App \
	-configuration Release \
	-destination "generic/platform=iOS" \
	-archivePath "${ARCHIVE_PATH}" \
	MARKETING_VERSION="${VERSION}" \
	CURRENT_PROJECT_VERSION="${BUILD_NUMBER}" \
	CODE_SIGNING_ALLOWED=NO \
	-allowProvisioningUpdates

BOOTSTRAP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/streamient-ios-signing.XXXXXX")"
cleanup() {
	if [ -n "${BOOTSTRAP_DIR}" ] && [ -d "${BOOTSTRAP_DIR}" ]; then
		rm -rf "${BOOTSTRAP_DIR}"
	fi
}
trap cleanup EXIT

xcodebuild -exportArchive \
	-archivePath "${ARCHIVE_PATH}" \
	-exportPath "${BOOTSTRAP_DIR}/export" \
	-exportOptionsPlist "${IOS_DIR}/ExportOptions.plist" \
	-allowProvisioningUpdates

ditto -x -k "${BOOTSTRAP_DIR}/export/App.ipa" "${BOOTSTRAP_DIR}/unpacked"
BOOTSTRAP_APP="${BOOTSTRAP_DIR}/unpacked/Payload/App.app"
ARCHIVE_APP="${ARCHIVE_PATH}/Products/Applications/App.app"
ARCHIVE_EXTENSION="${ARCHIVE_APP}/PlugIns/ShareExtension.appex"
SIGNING_IDENTITY="$(codesign -dvv "${BOOTSTRAP_APP}" 2>&1 | sed -n 's/^Authority=\(Apple Distribution.*\)$/\1/p' | head -1)"

if [ -z "${SIGNING_IDENTITY}" ]; then
	echo "Could not resolve the Apple Distribution signing identity" >&2
	exit 1
fi

cp "${BOOTSTRAP_APP}/embedded.mobileprovision" "${ARCHIVE_APP}/embedded.mobileprovision"
cp "${BOOTSTRAP_APP}/PlugIns/ShareExtension.appex/embedded.mobileprovision" "${ARCHIVE_EXTENSION}/embedded.mobileprovision"
security cms -D -i "${ARCHIVE_APP}/embedded.mobileprovision" | plutil -extract Entitlements xml1 -o "${BOOTSTRAP_DIR}/App.xcent" -
security cms -D -i "${ARCHIVE_EXTENSION}/embedded.mobileprovision" | plutil -extract Entitlements xml1 -o "${BOOTSTRAP_DIR}/ShareExtension.xcent" -

while IFS= read -r code_path; do
	codesign --force --sign "${SIGNING_IDENTITY}" --timestamp=none "${code_path}"
done < <(find "${ARCHIVE_APP}" -depth \( -type d -name '*.framework' -o -type f -name '*.dylib' \) -print)

codesign --force --sign "${SIGNING_IDENTITY}" --entitlements "${BOOTSTRAP_DIR}/ShareExtension.xcent" --generate-entitlement-der --timestamp=none "${ARCHIVE_EXTENSION}"
codesign --force --sign "${SIGNING_IDENTITY}" --entitlements "${BOOTSTRAP_DIR}/App.xcent" --generate-entitlement-der --timestamp=none "${ARCHIVE_APP}"
codesign --verify --deep --strict --verbose=2 "${ARCHIVE_APP}"

xcodebuild -exportArchive \
	-archivePath "${ARCHIVE_PATH}" \
	-exportPath "${EXPORT_PATH}" \
	-exportOptionsPlist "${IOS_DIR}/ExportOptions.plist"

if [ "${UPLOAD}" = "true" ]; then
	xcodebuild -exportArchive \
		-archivePath "${ARCHIVE_PATH}" \
		-exportPath "${BUILD_DIR}/upload-${BUILD_NUMBER}" \
		-exportOptionsPlist "${IOS_DIR}/UploadOptions.plist" \
		-allowProvisioningUpdates
fi

echo "iOS archive: ${ARCHIVE_PATH}"
echo "Signed iOS app: ${EXPORT_PATH}/App.ipa"
