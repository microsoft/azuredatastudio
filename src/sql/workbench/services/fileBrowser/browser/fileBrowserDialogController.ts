/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { FileBrowserDialog } from 'sql/workbench/services/fileBrowser/browser/fileBrowserDialog';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * File browser dialog service
 */
export class FileBrowserDialogController implements IFileBrowserDialogController {
	_serviceBrand: any;
	private _fileBrowserDialog: FileBrowserDialog;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}

	public showDialog(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
		isWide: boolean,
		handleOnOk: (path: string) => void
	) {
		if (!this._fileBrowserDialog) {
			this._fileBrowserDialog = this._instantiationService.createInstance(FileBrowserDialog, localize('filebrowser.selectFile', "Select a file"));
			this._fileBrowserDialog.render();
		}

		this._fileBrowserDialog.setWide(isWide);
		this._fileBrowserDialog.onOk((filepath) => handleOnOk(filepath));
		this._fileBrowserDialog.open(ownerUri, expandPath, fileFilters, fileValidationServiceType);
	}
}
