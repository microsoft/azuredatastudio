/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as performance from 'vs/base/common/performance';
import { OperatingSystem } from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';

export interface IRemoteAgentEnvironment {
	pid: number;
	connectionToken: string;
	appRoot: URI;
	settingsPath: URI;
	logsPath: URI;
	extensionsPath: URI;
	extensionHostLogsPath: URI;
	globalStorageHome: URI;
	workspaceStorageHome: URI;
	userHome: URI;
	os: OperatingSystem;
	marks: performance.PerformanceMark[];
	useHostProxy: boolean;
}

export interface RemoteAgentConnectionContext {
	remoteAuthority: string;
	clientId: string;
}
