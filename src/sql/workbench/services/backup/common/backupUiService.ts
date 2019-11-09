/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';

export const UI_SERVICE_ID = 'backupUiService';
export const IBackupUiService = createDecorator<IBackupUiService>(UI_SERVICE_ID);

export interface IBackupUiService {
	_serviceBrand: undefined;

	/**
	 * Show backup wizard
	 */
	showBackup(connection: ConnectionProfile): Promise<any>;

	/**
	 * On show backup event
	 */
	onShowBackupEvent: Event<{ connection: ConnectionProfile, ownerUri: string }>;

	/**
	 * Close backup wizard
	 */
	closeBackup();

	/**
	 * After the backup dialog is rendered, run Modal methods to set focusable elements, etc.
	 */
	onShowBackupDialog();
}
