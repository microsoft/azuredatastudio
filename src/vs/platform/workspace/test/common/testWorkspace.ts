/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isLinux, isWindows } from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';
import { toWorkspaceFolder, Workspace as BaseWorkspace, WorkspaceFolder } from 'vs/platform/workspace/common/workspace';

export class Workspace extends BaseWorkspace {
	constructor(
		id: string,
		folders: WorkspaceFolder[] = [],
		configuration: URI | null = null,
		ignorePathCasing: (key: URI) => boolean = () => !isLinux
	) {
		super(id, folders, configuration, ignorePathCasing);
	}
}

const wsUri = URI.file(isWindows ? 'C:\\testWorkspace' : '/testWorkspace');
export const TestWorkspace = testWorkspace(wsUri);

export function testWorkspace(resource: URI): Workspace {
	return new Workspace(resource.toString(), [toWorkspaceFolder(resource)]);
}
