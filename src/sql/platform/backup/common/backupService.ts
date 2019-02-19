/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';

export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export const SERVICE_ID = 'backupService';

export const IBackupService = createDecorator<IBackupService>(SERVICE_ID);

export interface IBackupService {
	_serviceBrand: any;

	getBackupConfigInfo(connectionUri: string): Thenable<sqlops.BackupConfigInfo>;

	/**
	 * Backup a data source using the provided connection
	 */
	backup(connectionUri: string, backupInfo: { [key: string]: any }, taskExecutionMode: sqlops.TaskExecutionMode): Thenable<sqlops.BackupResponse>;

	/**
	 * Register a disaster recovery provider
	 */
	registerProvider(providerId: string, provider: sqlops.BackupProvider): void;
}
