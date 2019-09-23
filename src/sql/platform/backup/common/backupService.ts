/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export const SERVICE_ID = 'backupService';

export const IBackupService = createDecorator<IBackupService>(SERVICE_ID);

export interface IBackupService {
	_serviceBrand: undefined;

	getBackupConfigInfo(connectionUri: string): Promise<azdata.BackupConfigInfo | undefined>;

	/**
	 * Backup a data source using the provided connection
	 */
	backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: azdata.TaskExecutionMode): Thenable<azdata.BackupResponse>;

	/**
	 * Register a disaster recovery provider
	 */
	registerProvider(providerId: string, provider: azdata.BackupProvider): void;
}
