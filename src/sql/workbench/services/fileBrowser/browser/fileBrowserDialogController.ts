/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { FileBrowserDialog } from 'sql/workbench/services/fileBrowser/browser/fileBrowserDialog';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

/**
 * File browser dialog service
 */
export class FileBrowserDialogController implements IFileBrowserDialogController {
	_serviceBrand: undefined;
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
		handleOnClosed: (path: string | undefined) => void,
		showFoldersOnly?: boolean
	): void {
		if (!this._fileBrowserDialog) {
			this._fileBrowserDialog = this._instantiationService.createInstance(FileBrowserDialog, localize('filebrowser.selectFile', "Select a file"));
			this._fileBrowserDialog.render();
		}

		this._fileBrowserDialog.setWide(isWide);
		var onOK = this._fileBrowserDialog.onOk((filepath) => handleOnClosed(filepath));
		var onClosed = this._fileBrowserDialog.onClosed((hideReason) => {
			if (hideReason !== 'ok') {
				handleOnClosed(undefined);
			}
			onOK.dispose();
			onClosed.dispose();
			this._fileBrowserDialog.dispose();
			this._fileBrowserDialog = undefined;
		});

		this._fileBrowserDialog.open(ownerUri, expandPath, fileFilters, fileValidationServiceType, showFoldersOnly);
	}
}
