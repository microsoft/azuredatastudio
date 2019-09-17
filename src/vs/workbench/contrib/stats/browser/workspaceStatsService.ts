/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WorkbenchState, IWorkspace } from 'vs/platform/workspace/common/workspace';
import { URI } from 'vs/base/common/uri';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IWorkspaceStatsService, Tags } from 'vs/workbench/contrib/stats/common/workspaceStats';

export class NoOpWorkspaceStatsService implements IWorkspaceStatsService {

	_serviceBrand: undefined;

	getTags(): Promise<Tags> {
		return Promise.resolve({});
	}

	getTelemetryWorkspaceId(workspace: IWorkspace, state: WorkbenchState): string | undefined {
		return undefined;
	}

	getHashedRemotesFromUri(workspaceUri: URI, stripEndingDotGit?: boolean): Promise<string[]> {
		return Promise.resolve([]);
	}
}

registerSingleton(IWorkspaceStatsService, NoOpWorkspaceStatsService, true);
