#!/usr/bin/env bash
set -euo pipefail

remote="origin"
develop_branch="develop"
main_branch="main"
dry_run=0
assume_yes=0

usage() {
	printf '%s\n' "Usage: ./release.sh [options]"
	printf '%s\n' ""
	printf '%s\n' "Options:"
	printf '%s\n' "    --dry-run              Show release steps without changing git state"
	printf '%s\n' "    --yes                  Skip confirmation prompt"
	printf '%s\n' "    --remote <name>        Remote to use (default: origin)"
	printf '%s\n' "    --develop <branch>     Develop branch name (default: develop)"
	printf '%s\n' "    --main <branch>        Main branch name (default: main)"
	printf '%s\n' "    --help                 Show this help"
	printf '%s\n' ""
	printf '%s\n' "Environment:"
	printf '%s\n' "    RELEASE_DATE=YYYYMMDD  Override release date for tag creation"
}

log() {
	printf '%s\n' "$*"
}

fail() {
	printf 'Error: %s\n' "$*" >&2
	exit 1
}

run() {
	if [ "$dry_run" -eq 1 ]; then
		printf '+'
		printf ' %q' "$@"
		printf '\n'
		return 0
	fi

	"$@"
}

current_branch() {
	git symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

return_to_develop() {
	if [ "$dry_run" -eq 1 ]; then
		return 0
	fi

	local branch
	branch="$(current_branch)"

	if [ "$branch" = "$develop_branch" ]; then
		return 0
	fi

	if git show-ref --verify --quiet "refs/heads/${develop_branch}"; then
		log "Returning to ${develop_branch}"
		git switch "$develop_branch" >/dev/null 2>&1 || true
	fi
}

require_clean_tree() {
	git diff --quiet || fail "working tree has unstaged changes"
	git diff --cached --quiet || fail "index has staged changes"

	if [ -n "$(git ls-files --others --exclude-standard)" ]; then
		fail "working tree has untracked files"
	fi
}

require_branch() {
	local branch="$1"

	git show-ref --verify --quiet "refs/heads/${branch}" || fail "local branch ${branch} is missing"
}

require_remote_branch() {
	local branch="$1"

	git ls-remote --exit-code --heads "$remote" "$branch" >/dev/null || fail "remote branch ${remote}/${branch} is missing"
}

require_date() {
	local value="$1"

	if [[ ! "$value" =~ ^[0-9]{8}$ ]]; then
		fail "RELEASE_DATE must be YYYYMMDD"
	fi
}

release_date() {
	if [ -n "${RELEASE_DATE:-}" ]; then
		require_date "$RELEASE_DATE"
		printf '%s\n' "$RELEASE_DATE"
		return 0
	fi

	date '+%Y%m%d'
}

remote_tag_names_for_date() {
	local date_prefix="$1"

	git ls-remote --tags --refs "$remote" "${date_prefix}[0-9]*" |
		awk '{print $2}' |
		sed 's#refs/tags/##' |
		grep -E "^${date_prefix}[0-9]+$" || true
}

local_tag_points_at_ref() {
	local tag="$1"
	local ref="$2"

	if ! git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
		return 1
	fi

	local target
	local expected

	target="$(git rev-list -n 1 "$tag")"
	expected="$(git rev-parse "$ref")"

	[ "$target" = "$expected" ]
}

remote_tag_exists() {
	local tag="$1"

	git ls-remote --exit-code --tags --refs "$remote" "$tag" >/dev/null 2>&1
}

next_tag_for_date() {
	local date_prefix="$1"
	local highest=0
	local tag
	local suffix

	while IFS= read -r tag; do
		[ -n "$tag" ] || continue
		suffix="${tag#${date_prefix}}"

		if [ "$suffix" -gt "$highest" ] 2>/dev/null; then
			highest="$suffix"
		fi
	done <<EOF
$(remote_tag_names_for_date "$date_prefix")
EOF

	printf '%s%s\n' "$date_prefix" "$((highest + 1))"
}

local_tag_is_reusable() {
	local tag="$1"
	local release_ref="$2"

	if ! git rev-parse --verify --quiet "refs/tags/${tag}" >/dev/null; then
		return 1
	fi

	if remote_tag_exists "$tag"; then
		return 1
	fi

	if local_tag_points_at_ref "$tag" "$release_ref"; then
		return 0
	fi

	fail "local tag ${tag} exists but does not point at release head"
}

confirm_release() {
	local tag="$1"

	if [ "$assume_yes" -eq 1 ] || [ "$dry_run" -eq 1 ]; then
		return 0
	fi

	printf 'Release %s into %s and push tag %s? [y/N] ' "$develop_branch" "$main_branch" "$tag"

	local answer
	read -r answer

	case "$answer" in
		y|Y|yes|YES)
			return 0
			;;
	esac

	fail "release cancelled"
}

parse_args() {
	while [ "$#" -gt 0 ]; do
		case "$1" in
			--dry-run)
				dry_run=1
				shift
				;;
			--yes)
				assume_yes=1
				shift
				;;
			--remote)
				[ "$#" -ge 2 ] || fail "--remote requires a value"
				remote="$2"
				shift 2
				;;
			--develop)
				[ "$#" -ge 2 ] || fail "--develop requires a value"
				develop_branch="$2"
				shift 2
				;;
			--main)
				[ "$#" -ge 2 ] || fail "--main requires a value"
				main_branch="$2"
				shift 2
				;;
			--help)
				usage
				exit 0
				;;
			*)
				fail "unknown option $1"
				;;
		esac
	done
}

main() {
	parse_args "$@"

	git rev-parse --is-inside-work-tree >/dev/null || fail "not inside a git repository"

	if [ -z "$(current_branch)" ]; then
		fail "detached HEAD is not supported"
	fi

	require_clean_tree
	require_branch "$develop_branch"
	require_branch "$main_branch"
	require_remote_branch "$develop_branch"
	require_remote_branch "$main_branch"

	local date_prefix
	date_prefix="$(release_date)"

	local tag
	tag="$(next_tag_for_date "$date_prefix")"

	trap return_to_develop EXIT

	log "Fetching ${remote}"
	run git fetch "$remote" --prune --tags

	log "Switching to ${develop_branch}"
	run git switch "$develop_branch"
	run git merge --ff-only "${remote}/${develop_branch}"

	log "Pushing ${develop_branch}"
	run git push "$remote" "$develop_branch"

	log "Switching to ${main_branch}"
	run git switch "$main_branch"
	run git merge --ff-only "${remote}/${main_branch}"
	run git merge --ff-only "$develop_branch"

	if local_tag_is_reusable "$tag" "$develop_branch"; then
		log "Reusing local tag ${tag}"
	else
		log "Creating tag ${tag}"
		run git tag -a "$tag" -m "$tag"
	fi

	confirm_release "$tag"

	log "Pushing ${main_branch} and ${tag}"
	run git push --atomic "$remote" "$main_branch" "refs/tags/${tag}"

	log "Release ${tag} complete"
}

main "$@"
