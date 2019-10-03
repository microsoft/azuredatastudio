/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

import { IWorkspaceContextService, IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';

/**
 * Resolves the given file path using the VS ConfigurationResolver service, replacing macros such as
 * ${workspaceRoot} with their expected values and then testing each path to see if it exists. It will
 * return either the first full path that exists or throw an error if none of the resolved paths exist
 * @param filePath The path to resolve
 * @param workspaceContextService The workspace context to use for resolving workspace vars
 * @param configurationResolverService The resolver service to use to resolve the vars
 */
export async function resolveQueryFilePath(services: ServicesAccessor, filePath: string): Promise<string> {
	if (!filePath) {
		return filePath;
	}

	const workspaceContextService = services.get(IWorkspaceContextService);
	const configurationResolverService = services.get(IConfigurationResolverService);
	const fileService = services.get(IFileService);

	let workspaceFolders: IWorkspaceFolder[] = workspaceContextService.getWorkspace().folders;
	// Resolve the path using each folder in our workspace, or undefined if there aren't any
	// (so that non-folder vars such as environment vars still resolve)
	let resolvedFilePaths = (workspaceFolders.length > 0 ? workspaceFolders : [undefined])
		.map(f => configurationResolverService.resolve(f, filePath));

	// Just need a single query file so use the first we find that exists
	for (const path of resolvedFilePaths) {
		if (await fileService.exists(URI.file(path))) {
			return path;
		}
	}

	throw Error(localize('insightsDidNotFindResolvedFile', "Could not find query file at any of the following paths :\n {0}", resolvedFilePaths.join('\n')));
}
