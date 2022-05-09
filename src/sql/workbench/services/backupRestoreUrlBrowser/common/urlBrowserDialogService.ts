/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IBackupRestoreUrlBrowserDialogService = createDecorator<IBackupRestoreUrlBrowserDialogService>('backupRestoreUrlBrowserDialogService');
export interface IBackupRestoreUrlBrowserDialogService {
	_serviceBrand: undefined;
	/**
	 * Show url browser dialog
	 */
	showDialog(ownerUri: string,
		expandPath: string,
		fileFilters: { label: string, filters: string[] }[],
		fileValidationServiceType: string,
		isWide: boolean,
		isRestoreDialog: boolean,
		defaultBackupName: string): Promise<string>;
}
