/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { localize } from 'vs/nls';

/**
 * View model for file browser dialog
 */
export class FileBrowserViewModel {
	private _ownerUri: string;
	private _expandPath: string;
	private _fileFilters: [{ label: string, filters: string[] }];
	private _fileValidationServiceType: string;
	public formattedFileFilters: string[];

	constructor( @IFileBrowserService private _fileBrowserService: IFileBrowserService) {
	}

	public onAddFileTree(onAddFileTreeCallback) {
		this._fileBrowserService.onAddFileTree(args => onAddFileTreeCallback(args));
	}

	public onPathValidate(onPathValidateCallback) {
		this._fileBrowserService.onPathValidate(args => onPathValidateCallback(args));
	}

	public initialize(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
	) {
		this._ownerUri = ownerUri;
		this._expandPath = expandPath;
		this._fileValidationServiceType = fileValidationServiceType;

		if (!fileFilters) {
			this._fileFilters = [{ label: localize('allFiles', 'All files'), filters: ['*'] }];
		} else {
			this._fileFilters = fileFilters;
		}
		this.formattedFileFilters = [];
		for (var i = 0; i < this._fileFilters.length; i++) {
			var filterStr = this._fileFilters[i].label + '(' + this._fileFilters[i].filters.join(';') + ')';
			this.formattedFileFilters.push(filterStr);
		}
	}

	public validateFilePaths(selectedFiles: string[]) {
		this._fileBrowserService.validateFilePaths(this._ownerUri, this._fileValidationServiceType, selectedFiles);
	}

	public openFileBrowser(filterIndex: number, changeFilter: boolean) {
		if (this._fileFilters[filterIndex]) {
			this._fileBrowserService.openFileBrowser(this._ownerUri, this._expandPath, this._fileFilters[filterIndex].filters, changeFilter);
		}
	}

	public closeFileBrowser() {
		this._fileBrowserService.closeFileBrowser(this._ownerUri);
	}
}