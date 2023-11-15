/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BackupRestoreUrlBrowserDialog } from 'sql/workbench/services/backupRestoreUrlBrowser/browser/urlBrowserDialog';
import { IBackupRestoreUrlBrowserDialogService } from 'sql/workbench/services/backupRestoreUrlBrowser/common/urlBrowserDialogService';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * Url browser dialog service
 */
export class BackupRestoreUrlBrowserDialogService implements IBackupRestoreUrlBrowserDialogService {
	_serviceBrand: undefined;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}

	public showDialog(ownerUri: string,
		isWide: boolean,
		isRestoreDialog: boolean,
		defaultBackupName: string
	): Promise<string> {
		const backupRestoreUrlBrowserDialog = this._instantiationService.createInstance(BackupRestoreUrlBrowserDialog, localize('filebrowser.selectBlob', "Select a blob"), isRestoreDialog, defaultBackupName);
		backupRestoreUrlBrowserDialog.render();

		backupRestoreUrlBrowserDialog.setWide(isWide);
		backupRestoreUrlBrowserDialog.open(ownerUri);
		return backupRestoreUrlBrowserDialog.onOk;
	}
}
