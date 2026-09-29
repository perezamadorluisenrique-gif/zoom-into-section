#!/usr/bin/env node
// Reads a plugin's public listing on community.obsidian.md: which version the
// directory serves and the result of its automated review of that version.
//
// This file is copied verbatim into each public plugin repo as
// `.github/scripts/directory-review.mjs`, where the Release workflow runs it
// after publishing; the canonical copy lives in obsidian-dev under
// tools/directory/. It is in English for that reason.
//
// The directory has no API for this. Both pages it reads are public and need
// no login: the release feed (`/plugins/<id>/feed.xml`) and the listing page,
// whose review section is server-rendered. Claude sessions cannot reach the
// site, so this runs from GitHub Actions.
//
// Usage:
//   node review.mjs <plugin-id>                       # report now, exit 1 if the review is not Passed
//   node review.mjs <plugin-id> --wait 1.2.3          # wait until the directory serves 1.2.3 and has reviewed it
//   node review.mjs <plugin-id> --wait 1.2.3 --timeout 60 --settle 10   # minutes
//   node review.mjs <plugin-id> --json
//
// Exit codes: 0 review passed, or the plugin is not listed yet (nothing to
// review: submit it at community.obsidian.md); 1 review did not pass; 2 the
// directory did not pick up the version in time (press "Check for new
// releases" on the dashboard); 3 the page could not be read or parsed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://community.obsidian.md';

// Severities as the listing keys its findings: "high:0:Uses Obsidian APIs ...".
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info', 'pass'];
const BLOCKING = new Set(['critical', 'high']);

// The page streams its content as React Server Component chunks, each a JSON
// string inside `self.__next_f.push([1,"..."])`. Decoding them gives clean
// text with no HTML escaping to undo.
export function rscText(html) {
	const chunks = [];
	const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
	for (const m of html.matchAll(re)) {
		try {
			chunks.push(JSON.parse(m[1]));
		} catch {
			// A chunk that is not valid JSON on its own is skipped.
		}
	}
	return chunks.join('');
}

export function parseListing(html) {
	const text = rscText(html);
	const source = text || html;

	let currentVersion = null;
	const version = source.match(/"children":"Current version"\}\],\["\$","div",null,\{[^{}]*"children":"([^"]+)"\}/)
		?? html.match(/Current version<\/div><div[^>]*>([^<]+)<\/div>/);
	if (version) currentVersion = version[1];

	let review = null;
	const status = source.match(/"children":"Review"\}\],\["\$","span",null,\{[^{}]*"children":"([^"]+)"\}/)
		?? html.match(/>Review<\/span><span[^>]*>([^<]+)<\/span>/);
	if (status) review = status[1];

	const summaryMatch = source.match(/"children":"((?:No|\d+) issues? found[^"]*)"/)
		?? html.match(/>((?:No|\d+) issues? found[^<]*)</);
	const summary = summaryMatch ? summaryMatch[1] : null;

	const findings = [];
	const seen = new Set();
	const findingRe = new RegExp(`"((?:${SEVERITIES.join('|')})):(\\d+):((?:[^"\\\\]|\\\\.)*)"`, 'g');
	for (const m of source.matchAll(findingRe)) {
		let message;
		try {
			message = JSON.parse(`"${m[3]}"`);
		} catch {
			message = m[3];
		}
		const key = `${m[1]}:${m[2]}:${message}`;
		if (seen.has(key)) continue;
		seen.add(key);
		findings.push({ severity: m[1], message });
	}
	findings.sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity));

	return { currentVersion, review, summary, findings };
}

export function parseFeed(xml) {
	const versions = [];
	for (const m of xml.matchAll(/<guid[^>]*>release:plugin:[^:<]+:([^<]+)<\/guid>/g)) versions.push(m[1]);
	return versions;
}

// The listing rates a review Passed, Satisfactory (seen with one medium CSS
// finding) or Risks (seen with a high finding: an API newer than
// minAppVersion). The first two are fine to ship; anything else, or any
// critical or high finding, fails the check. Medium ones are reported only.
export const OK_REVIEWS = ['passed', 'satisfactory'];

export function passed(listing) {
	if (!listing.review || !OK_REVIEWS.includes(listing.review.toLowerCase())) return false;
	return !listing.findings.some((f) => BLOCKING.has(f.severity));
}

export function report(id, listing, { waitedFor = null, note = null } = {}) {
	const lines = [];
	const url = `${SITE}/plugins/${id}`;
	lines.push(`### Directory review: ${id}`);
	lines.push('');
	lines.push(`- Listing: ${url}`);
	lines.push(`- Version the directory serves: ${listing.currentVersion ?? 'unknown'}${waitedFor && listing.currentVersion !== waitedFor ? ` (waiting for ${waitedFor})` : ''}`);
	lines.push(`- Review: ${listing.review ?? 'not shown'}${listing.summary ? `. ${listing.summary}` : ''}`);
	if (note) lines.push(`- ${note}`);
	const issues = listing.findings.filter((f) => f.severity !== 'pass');
	if (issues.length) {
		lines.push('');
		for (const f of issues) lines.push(`- **${f.severity}**: ${f.message}`);
	}
	return lines.join('\n') + '\n';
}

export function notListedReport(id) {
	return [
		`### Directory review: ${id}`,
		'',
		`- This plugin is not in the directory yet, so there is nothing to review: ${SITE}/plugins/${id} does not exist.`,
		`- To list it, submit this repository at ${SITE} (dashboard, submit a plugin). The directory then reviews every release by itself.`,
		'',
	].join('\n');
}

async function get(url) {
	const res = await fetch(url, {
		headers: { 'user-agent': 'Mozilla/5.0 (compatible; plugin-release-check)' },
		redirect: 'follow',
	});
	if (!res.ok) throw Object.assign(new Error(`${url} answered ${res.status}`), { status: res.status });
	return res.text();
}

export async function read(id) {
	const [page, feed] = await Promise.all([get(`${SITE}/plugins/${id}`), get(`${SITE}/plugins/${id}/feed.xml`)]);
	return { listing: parseListing(page), feedVersions: parseFeed(feed) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const signature = (l) => JSON.stringify([l.review, l.summary, l.findings]);

// Waits until the directory serves `version`, then until its review of that
// version is in. The review block cannot be told apart from the previous
// version's by its content alone, so after the version switches this waits
// for the review to change, or for `settle` minutes if it never does (a
// release that changes nothing the scan looks at keeps the same result).
//
// A plugin that is not in the directory at all has a listing page that answers
// 404. Waiting 75 minutes for a review that cannot start would only end in a
// misleading failure, so after `missing` 404s in a row this gives up with
// `notListed` and the caller says what to do (submit the plugin).
export async function waitFor(id, version, { timeout = 60, settle = 10, every = 1, missing = 3 } = {}) {
	const deadline = Date.now() + timeout * 60_000;
	let before = null;
	let switchedAt = null;
	let last = null;
	let notFound = 0;
	for (;;) {
		try {
			last = await read(id);
			notFound = 0;
		} catch (err) {
			if (err.status === 404 && ++notFound >= missing) return { listing: null, feedVersions: [], pickedUp: false, notListed: true };
			console.log(`Could not read the listing yet: ${err.message}`);
		}
		if (last) {
			const { listing } = last;
			if (listing.currentVersion !== version) {
				before = signature(listing);
			} else {
				switchedAt ??= Date.now();
				const changed = before !== null && signature(listing) !== before;
				const settled = Date.now() - switchedAt >= settle * 60_000;
				if (listing.review && (changed || settled)) return { ...last, pickedUp: true };
			}
		}
		if (Date.now() > deadline) return { ...(last ?? { listing: null, feedVersions: [] }), pickedUp: switchedAt !== null };
		await sleep(every * 60_000);
	}
}

function arg(args, name, fallback) {
	const i = args.indexOf(name);
	return i === -1 ? fallback : args[i + 1];
}

async function main() {
	const args = process.argv.slice(2);
	const id = args[0];
	if (!id || id.startsWith('--')) {
		console.error('Usage: node review.mjs <plugin-id> [--wait <version>] [--timeout <min>] [--settle <min>] [--json]');
		process.exit(3);
	}
	const version = arg(args, '--wait', null);
	let result;
	try {
		result = version
			? await waitFor(id, version, { timeout: Number(arg(args, '--timeout', 60)), settle: Number(arg(args, '--settle', 10)) })
			: { ...(await read(id)), pickedUp: true };
	} catch (err) {
		console.error(`Could not read ${SITE}/plugins/${id}: ${err.message}`);
		process.exit(3);
	}
	if (result.notListed) {
		const text = notListedReport(id);
		console.log(text);
		if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
		process.exit(0);
	}
	if (!result.listing) {
		console.error(`Could not read ${SITE}/plugins/${id}.`);
		process.exit(3);
	}

	let note = null;
	let code;
	if (version && !result.pickedUp) {
		note = `The directory has not picked up ${version} yet. On the developer dashboard, open this plugin's ... menu and choose Check for new releases, then Request review.`;
		code = 2;
	} else {
		code = passed(result.listing) ? 0 : 1;
	}

	if (args.includes('--json')) {
		console.log(JSON.stringify({ id, ...result, passed: code === 0 }, null, 2));
	} else {
		const text = report(id, result.listing, { waitedFor: version, note });
		console.log(text);
		if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
	}
	process.exit(code);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
