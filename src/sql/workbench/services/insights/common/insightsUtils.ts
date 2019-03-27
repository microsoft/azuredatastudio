/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

 import * as fs from 'fs';

import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';

export class InsightsUtils {

	/**
	 * Resolves the given file path using the VS ConfigurationResolver service, replacing macros such as
	 * ${workspaceRoot} with their expected values and then testing each path to see if it exists. It will
	 * return either the first full path that exists or the original file path if none of the paths existed.
	 * @param filePath The path to resolve
	 * @param workspaceContextService The workspace context to use for resolving workspace vars
	 * @param configurationResolverService The resolver service to use to resolve the vars
	 */
	public static resolveQueryFilePath(filePath: string,
		workspaceContextService: IWorkspaceContextService,
		configurationResolverService: IConfigurationResolverService): string {
			if(!filePath || !workspaceContextService || !configurationResolverService) {
				return filePath;
			}
			// Look through all the folders in the workspace use the first one that has the file we're looking for
			let foundFilePaths = workspaceContextService.getWorkspace().folders
						.map(f => configurationResolverService.resolve(f, filePath))
						.filter(p => fs.existsSync(p));

			// Default to the original path if resolution didn't come back with any valid paths
			return foundFilePaths.length > 0 ? foundFilePaths[0] : filePath;
		}
}
