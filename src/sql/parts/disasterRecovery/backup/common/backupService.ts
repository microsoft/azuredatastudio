/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import Event from 'vs/base/common/event';
import * as sqlops from 'sqlops';

import { DashboardComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';


export enum TaskExecutionMode {
	execute = 0,
	script = 1,
	executeAndScript = 2,
}

export const SERVICE_ID = 'backupService';
export const UI_SERVICE_ID = 'backupUiService';

export const IBackupUiService = createDecorator<IBackupUiService>(UI_SERVICE_ID);

export interface IBackupUiService {
	_serviceBrand: any;

	/**
	 * Show backup wizard
	 */
	showBackup(connection: IConnectionProfile): Promise<any>;

	/**
	 * On show backup event
	 */
	onShowBackupEvent: Event<DashboardComponentParams>;

	/**
	 * Close backup wizard
	 */
	closeBackup();

	/**
	 * After the backup dialog is rendered, run Modal methods to set focusable elements, etc.
	 */
	onShowBackupDialog();
}

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
