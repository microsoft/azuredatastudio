/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { MainThreadWindowShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IBackupRestoreUrlBrowserDialogService } from 'sql/workbench/services/backupRestoreUrlBrowser/common/urlBrowserDialogService';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import * as validationConstants from 'sql/workbench/services/fileBrowser/common/fileValidationServiceConstants';
import * as restoreConstants from 'sql/workbench/services/restore/common/constants';
import { Disposable } from 'vs/base/common/lifecycle';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadWindow)
export class MainThreadWindow extends Disposable implements MainThreadWindowShape {

	constructor(
		extHostContext: IExtHostContext,
		@IFileBrowserDialogController private _fileBrowserDialogService: IFileBrowserDialogController,
		@IBackupRestoreUrlBrowserDialogService private _urlBrowserDialogService: IBackupRestoreUrlBrowserDialogService
	) {
		super();
	}

	public async $openServerFileBrowserDialog(connectionUri: string, targetPath: string, fileFilters: azdata.window.FileFilters[], showFoldersOnly?: boolean): Promise<string | undefined> {
		let completion = new Promise<string | undefined>((resolve, reject) => {
			try {
				const handleOnClosed = (path: string | undefined) => {
					resolve(path);
				};
				this._fileBrowserDialogService.showDialog(connectionUri, targetPath, fileFilters, '', true, handleOnClosed, showFoldersOnly);
			} catch (error) {
				reject(error);
			}
		});
		return await completion;
	}

	public async $openBackupUrlBrowserDialog(connectionUri: string, storageUrl: string, isRestoreDialog: boolean, defaultBackupName: string): Promise<string | undefined> {
		let validationType = isRestoreDialog ? validationConstants.restore : validationConstants.backup;
		return this._urlBrowserDialogService.showDialog(connectionUri, storageUrl, restoreConstants.fileFiltersSet, validationType, isRestoreDialog, isRestoreDialog, defaultBackupName);
	}
}
