/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

export interface ProjectAssets {
	readmeFolder?: string
}

export let targetPlatformToAssets: Map<string, ProjectAssets>;

export function loadAssets(assetsFolderPath: string) {
	targetPlatformToAssets = new Map<string, ProjectAssets>([
		['AzureV12', {
			readmeFolder: path.join(assetsFolderPath, 'AzureV12')
		}],
	]);
}
