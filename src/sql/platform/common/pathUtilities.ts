/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { normalize, join, dirname } from 'vs/base/common/path';

import { URI } from 'vs/base/common/uri';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { Schemas } from 'vs/base/common/network';

export const FILE_SCHEMA: string = 'file';

export function resolveCurrentDirectory(uri: string, rootPath?: string): string | undefined {
	let sqlUri = URI.parse(uri);
	let currentDirectory: string | undefined;

	// use current directory of the sql file if sql file is saved
	if (sqlUri.scheme === FILE_SCHEMA) {
		currentDirectory = dirname(sqlUri.fsPath);
	} else if (sqlUri.scheme === Schemas.untitled) {
		// if sql file is unsaved/untitled but a workspace is open use workspace root
		let root = rootPath;
		if (root) {
			currentDirectory = root;
		}
	} else {
		currentDirectory = dirname(sqlUri.path);
	}
	return currentDirectory;
}

export function resolveFilePath(uri: string, filePath: string, rootPath?: string): string | undefined {
	let currentDirectory = resolveCurrentDirectory(uri, rootPath);
	if (currentDirectory) {
		return normalize(join(currentDirectory, filePath));
	}
	return undefined;
}

export function getRootPath(contextService: IWorkspaceContextService): string | undefined {
	let isWorkspace = contextService.getWorkbenchState() === WorkbenchState.WORKSPACE;
	if (isWorkspace) {
		let folder = contextService.getWorkspace().folders[0];
		if (folder && folder.uri) {
			return folder.uri.fsPath;
		}
	}

	return undefined;
}
