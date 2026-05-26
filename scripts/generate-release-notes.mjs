import { execFileSync } from 'node:child_process';

const {
	GH_TOKEN,
	GITHUB_REPOSITORY,
	IMAGE,
	TAG
} = process.env;

if (!GH_TOKEN) {
	throw new Error('GH_TOKEN is required');
}

if (!GITHUB_REPOSITORY) {
	throw new Error('GITHUB_REPOSITORY is required');
}

if (!TAG) {
	throw new Error('TAG is required');
}

const apiBase = 'https://api.github.com';

async function githubApi(path, options = {}) {
	const response = await fetch(`${apiBase}${path}`, {
		method: options.method || 'GET',
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${GH_TOKEN}`,
			'content-type': 'application/json',
			'x-github-api-version': '2022-11-28'
		},
		body: options.body ? JSON.stringify(options.body) : undefined
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`GitHub API ${response.status} for ${path}: ${text}`);
	}

	return response.json();
}

async function getPreviousReleaseTag() {
	const releases = await githubApi(`/repos/${GITHUB_REPOSITORY}/releases?per_page=100`);
	const releaseTagNames = new Set(releases.map((release) => release.tag_name));

	const tags = execFileSync('git', ['tag', '--sort=-creatordate'], {
		encoding: 'utf8'
	})
		.split('\n')
		.map((tag) => tag.trim())
		.filter(Boolean);

	const startIndex = tags.indexOf(TAG);

	if (startIndex === -1) {
		return tags.find((tag) => tag !== TAG && releaseTagNames.has(tag)) || '';
	}

	for (let index = startIndex + 1; index < tags.length; index += 1) {
		if (releaseTagNames.has(tags[index])) {
			return tags[index];
		}
	}

	return '';
}

function getTagDate(tag) {
	const date = execFileSync('git', ['for-each-ref', `refs/tags/${tag}`, '--format=%(creatordate:iso-strict)'], {
		encoding: 'utf8'
	}).trim();

	if (date) {
		return date;
	}

	return execFileSync('git', ['log', '-1', '--format=%cI', tag], {
		encoding: 'utf8'
	}).trim();
}

function toUtcIso(value) {
	return new Date(value).toISOString();
}

async function searchClosedIssues(previousTag, currentTagDate) {
	const parts = [
		`repo:${GITHUB_REPOSITORY}`,
		'is:issue',
		'is:closed'
	];

	const upperBound = toUtcIso(currentTagDate);

	if (previousTag) {
		const previousDate = new Date(getTagDate(previousTag));
		previousDate.setMilliseconds(previousDate.getMilliseconds() + 1);
		parts.push(`closed:${previousDate.toISOString()}..${upperBound}`);
	} else {
		parts.push(`closed:<=${upperBound}`);
	}

	const query = parts.join(' ');
	const issues = [];
	let page = 1;

	while (true) {
		const params = new URLSearchParams({
			q: query,
			sort: 'created',
			order: 'asc',
			per_page: '100',
			page: String(page)
		});
		const result = await githubApi(`/search/issues?${params.toString()}`);

		issues.push(...result.items);

		if (result.items.length < 100) {
			break;
		}

		page += 1;
	}

	return issues;
}

function markdownEscape(text) {
	return text.replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function primaryLabel(issue) {
	const label = issue.labels.find((item) => typeof item === 'string' || item.name);

	if (typeof label === 'string') {
		return label;
	}

	return label?.name || 'Unlabeled';
}

function normalizeBody(body) {
	const text = (body || '').trim();

	if (!text) {
		return '_No details provided._';
	}

	return text;
}

function fullChangelogUrl(previousTag) {
	if (!previousTag) {
		return `https://github.com/${GITHUB_REPOSITORY}/commits/${TAG}`;
	}

	return `https://github.com/${GITHUB_REPOSITORY}/compare/${previousTag}...${TAG}`;
}

async function main() {
	const previousTag = await getPreviousReleaseTag();
	const currentTagDate = getTagDate(TAG);
	const closedIssues = await searchClosedIssues(previousTag, currentTagDate);
	const issues = [];

	for (const closedIssue of closedIssues) {
		const issue = await githubApi(`/repos/${GITHUB_REPOSITORY}/issues/${closedIssue.number}`);

		issues.push(issue);
	}

	issues.sort((left, right) => new Date(right.closed_at) - new Date(left.closed_at));

	const groups = new Map();

	for (const issue of issues) {
		const group = primaryLabel(issue);

		if (!groups.has(group)) {
			groups.set(group, []);
		}

		groups.get(group).push(issue);
	}

	const lines = [
		`Docker image: ${IMAGE || `ghcr.io/${GITHUB_REPOSITORY}:${TAG}`}`,
		'',
		"## What's Changed",
		''
	];

	if (groups.size === 0) {
		lines.push('_No closed issues found since the previous tag._');
		lines.push('');
	} else {
		for (const [group, groupIssues] of groups) {
			lines.push(`### ${group}`);
			lines.push('');

			for (const issue of groupIssues) {
				lines.push(`#### [#${issue.number}: ${markdownEscape(issue.title)}](${issue.html_url})`);
				lines.push('');
				lines.push(normalizeBody(issue.body));
				lines.push('');
			}
		}
	}

	lines.push(`**Full Changelog**: ${fullChangelogUrl(previousTag)}`);
	lines.push('');

	process.stdout.write(lines.join('\n'));
}

await main();
