/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Event } from 'vs/base/common/event';

export const UI_SERVICE_ID = 'backupUiService';
export const IBackupUiService = createDecorator<IBackupUiService>(UI_SERVICE_ID);

export interface IBackupUiService {
	_serviceBrand: undefined;

	/**
	 * Show backup wizard
	 */
	showBackup(connection: IConnectionProfile): Promise<any>;

	/**
	 * On show backup event
	 */
	onShowBackupEvent: Event<{ connection: IConnectionProfile, ownerUri: string }>;

	/**
	 * Close backup wizard
	 */
	closeBackup();

	/**
	 * After the backup dialog is rendered, run Modal methods to set focusable elements, etc.
	 */
	onShowBackupDialog();
}
