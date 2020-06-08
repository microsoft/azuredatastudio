/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { values } from 'vs/base/common/map';
import { IStringDictionary } from 'vs/base/common/collections';
import { deepClone } from 'vs/base/common/objects';

export interface IMergeResult {
	added: IStringDictionary<string>;
	updated: IStringDictionary<string>;
	removed: string[];
	conflicts: string[];
	remote: IStringDictionary<string> | null;
}

export function merge(local: IStringDictionary<string>, remote: IStringDictionary<string> | null, base: IStringDictionary<string> | null, resolvedConflicts: IStringDictionary<string | null> = {}): IMergeResult {
	const added: IStringDictionary<string> = {};
	const updated: IStringDictionary<string> = {};
	const removed: Set<string> = new Set<string>();

	if (!remote) {
		return {
			added,
			removed: values(removed),
			updated,
			conflicts: [],
			remote: Object.keys(local).length > 0 ? local : null
		};
	}

	const localToRemote = compare(local, remote);
	if (localToRemote.added.size === 0 && localToRemote.removed.size === 0 && localToRemote.updated.size === 0) {
		// No changes found between local and remote.
		return {
			added,
			removed: values(removed),
			updated,
			conflicts: [],
			remote: null
		};
	}

	const baseToLocal = compare(base, local);
	const baseToRemote = compare(base, remote);
	const remoteContent: IStringDictionary<string> = deepClone(remote);
	const conflicts: Set<string> = new Set<string>();
	const handledConflicts: Set<string> = new Set<string>();
	const handleConflict = (key: string): void => {
		if (handledConflicts.has(key)) {
			return;
		}
		handledConflicts.add(key);
		const conflictContent = resolvedConflicts[key];

		// add to conflicts
		if (conflictContent === undefined) {
			conflicts.add(key);
		}

		// remove the snippet
		else if (conflictContent === null) {
			delete remote[key];
			if (local[key]) {
				removed.add(key);
			}
		}

		// add/update the snippet
		else {
			if (local[key]) {
				if (local[key] !== conflictContent) {
					updated[key] = conflictContent;
				}
			} else {
				added[key] = conflictContent;
			}
			remoteContent[key] = conflictContent;
		}
	};

	// Removed snippets in Local
	for (const key of values(baseToLocal.removed)) {
		// Conflict - Got updated in remote.
		if (baseToRemote.updated.has(key)) {
			// Add to local
			added[key] = remote[key];
		}
		// Remove it in remote
		else {
			delete remoteContent[key];
		}
	}

	// Removed snippets in Remote
	for (const key of values(baseToRemote.removed)) {
		if (handledConflicts.has(key)) {
			continue;
		}
		// Conflict - Got updated in local
		if (baseToLocal.updated.has(key)) {
			handleConflict(key);
		}
		// Also remove in Local
		else {
			removed.add(key);
		}
	}

	// Updated snippets in Local
	for (const key of values(baseToLocal.updated)) {
		if (handledConflicts.has(key)) {
			continue;
		}
		// Got updated in remote
		if (baseToRemote.updated.has(key)) {
			// Has different value
			if (localToRemote.updated.has(key)) {
				handleConflict(key);
			}
		} else {
			remoteContent[key] = local[key];
		}
	}

	// Updated snippets in Remote
	for (const key of values(baseToRemote.updated)) {
		if (handledConflicts.has(key)) {
			continue;
		}
		// Got updated in local
		if (baseToLocal.updated.has(key)) {
			// Has different value
			if (localToRemote.updated.has(key)) {
				handleConflict(key);
			}
		} else if (local[key] !== undefined) {
			updated[key] = remote[key];
		}
	}

	// Added snippets in Local
	for (const key of values(baseToLocal.added)) {
		if (handledConflicts.has(key)) {
			continue;
		}
		// Got added in remote
		if (baseToRemote.added.has(key)) {
			// Has different value
			if (localToRemote.updated.has(key)) {
				handleConflict(key);
			}
		} else {
			remoteContent[key] = local[key];
		}
	}

	// Added snippets in remote
	for (const key of values(baseToRemote.added)) {
		if (handledConflicts.has(key)) {
			continue;
		}
		// Got added in local
		if (baseToLocal.added.has(key)) {
			// Has different value
			if (localToRemote.updated.has(key)) {
				handleConflict(key);
			}
		} else {
			added[key] = remote[key];
		}
	}

	return { added, removed: values(removed), updated, conflicts: values(conflicts), remote: areSame(remote, remoteContent) ? null : remoteContent };
}

function compare(from: IStringDictionary<string> | null, to: IStringDictionary<string> | null): { added: Set<string>, removed: Set<string>, updated: Set<string> } {
	const fromKeys = from ? Object.keys(from) : [];
	const toKeys = to ? Object.keys(to) : [];
	const added = toKeys.filter(key => fromKeys.indexOf(key) === -1).reduce((r, key) => { r.add(key); return r; }, new Set<string>());
	const removed = fromKeys.filter(key => toKeys.indexOf(key) === -1).reduce((r, key) => { r.add(key); return r; }, new Set<string>());
	const updated: Set<string> = new Set<string>();

	for (const key of fromKeys) {
		if (removed.has(key)) {
			continue;
		}
		const fromSnippet = from![key]!;
		const toSnippet = to![key]!;
		if (fromSnippet !== toSnippet) {
			updated.add(key);
		}
	}

	return { added, removed, updated };
}

function areSame(a: IStringDictionary<string>, b: IStringDictionary<string>): boolean {
	const { added, removed, updated } = compare(a, b);
	return added.size === 0 && removed.size === 0 && updated.size === 0;
}
