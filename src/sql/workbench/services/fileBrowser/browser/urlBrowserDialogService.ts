/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UrlBrowserDialog } from 'sql/workbench/services/fileBrowser/browser/urlBrowserDialog';
import { IUrlBrowserDialogService } from 'sql/workbench/services/fileBrowser/common/urlBrowserDialogService';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * Url browser dialog service
 */
export class UrlBrowserDialogService implements IUrlBrowserDialogService {
	_serviceBrand: undefined;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}

	public showDialog(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
		isWide: boolean,
		isRestoreDialog: boolean,
		defaultBackupName: string,
		handleOnOk: (path: string) => void
	): void {
		const urlBrowserDialog = this._instantiationService.createInstance(UrlBrowserDialog, localize('filebrowser.selectBlob', "Select a blob"), isRestoreDialog, defaultBackupName);
		urlBrowserDialog.render();

		urlBrowserDialog.setWide(isWide);
		urlBrowserDialog.onOk((filepath) => handleOnOk(filepath));
		urlBrowserDialog.open(ownerUri, expandPath, fileFilters, fileValidationServiceType);
	}
}
