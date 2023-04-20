/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStringDictionary } from 'vs/base/common/collections';
import { ISandboxConfiguration } from 'vs/base/parts/sandbox/common/sandboxTypes';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';
import { LogLevel } from 'vs/platform/log/common/log';
import { IUserDataProfile } from 'vs/platform/userDataProfile/common/userDataProfile';
import { PolicyDefinition, PolicyValue } from 'vs/platform/policy/common/policy';
import { UriDto } from 'vs/base/common/types';

export interface ISharedProcess {

	/**
	 * Toggles the visibility of the otherwise hidden
	 * shared process window.
	 */
	toggle(): Promise<void>;
}

export interface ISharedProcessConfiguration extends ISandboxConfiguration {
	readonly machineId: string;

	readonly args: NativeParsedArgs;

	readonly logLevel: LogLevel;

	readonly backupWorkspacesPath: string;

	readonly profiles: UriDto<IUserDataProfile>[];

	readonly policiesData?: IStringDictionary<{ definition: PolicyDefinition; value: PolicyValue }>;
}
