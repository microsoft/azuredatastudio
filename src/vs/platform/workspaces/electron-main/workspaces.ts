/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash } from 'crypto';
import { Stats, statSync } from 'fs';
import { Schemas } from 'vs/base/common/network';
import { isLinux, isMacintosh, isWindows } from 'vs/base/common/platform';
import { originalFSPath } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { ISingleFolderWorkspaceIdentifier, IWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';


// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// NOTE: DO NOT CHANGE. IDENTIFIERS HAVE TO REMAIN STABLE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export function getWorkspaceIdentifier(configPath: URI): IWorkspaceIdentifier {

	function getWorkspaceId(): string {
		let configPathStr = configPath.scheme === Schemas.file ? originalFSPath(configPath) : configPath.toString();
		if (!isLinux) {
			configPathStr = configPathStr.toLowerCase(); // sanitize for platform file system
		}

		return createHash('md5').update(configPathStr).digest('hex');
	}

	return {
		id: getWorkspaceId(),
		configPath
	};
}

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// NOTE: DO NOT CHANGE. IDENTIFIERS HAVE TO REMAIN STABLE
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

export function getSingleFolderWorkspaceIdentifier(folderUri: URI): ISingleFolderWorkspaceIdentifier | undefined;
export function getSingleFolderWorkspaceIdentifier(folderUri: URI, folderStat: Stats): ISingleFolderWorkspaceIdentifier;
export function getSingleFolderWorkspaceIdentifier(folderUri: URI, folderStat?: Stats): ISingleFolderWorkspaceIdentifier | undefined {

	function getFolderId(): string | undefined {

		// Remote: produce a hash from the entire URI
		if (folderUri.scheme !== Schemas.file) {
			return createHash('md5').update(folderUri.toString()).digest('hex');
		}

		// Local: produce a hash from the path and include creation time as salt
		if (!folderStat) {
			try {
				folderStat = statSync(folderUri.fsPath);
			} catch (error) {
				return undefined; // folder does not exist
			}
		}

		let ctime: number | undefined;
		if (isLinux) {
			ctime = folderStat.ino; // Linux: birthtime is ctime, so we cannot use it! We use the ino instead!
		} else if (isMacintosh) {
			ctime = folderStat.birthtime.getTime(); // macOS: birthtime is fine to use as is
		} else if (isWindows) {
			if (typeof folderStat.birthtimeMs === 'number') {
				ctime = Math.floor(folderStat.birthtimeMs); // Windows: fix precision issue in node.js 8.x to get 7.x results (see https://github.com/nodejs/node/issues/19897)
			} else {
				ctime = folderStat.birthtime.getTime();
			}
		}

		// we use the ctime as extra salt to the ID so that we catch the case of a folder getting
		// deleted and recreated. in that case we do not want to carry over previous state
		return createHash('md5').update(folderUri.fsPath).update(ctime ? String(ctime) : '').digest('hex');
	}

	const folderId = getFolderId();
	if (typeof folderId === 'string') {
		return {
			id: folderId,
			uri: folderUri
		};
	}

	return undefined; // invalid folder
}
