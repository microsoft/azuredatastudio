/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileBrowserService } from 'sql/workbench/services/fileBrowser/common/interfaces';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';

/**
 * View model for file browser dialog
 */
export class FileBrowserViewModel {
	private _ownerUri: string;
	private _expandPath: string;
	private _fileFilters: [{ label: string, filters: string[] }];
	private _fileValidationServiceType: string;
	private _showFoldersOnly: boolean;
	public formattedFileFilters: string[];

	constructor(@IFileBrowserService private _fileBrowserService: IFileBrowserService) {
	}

	public onAddFileTree(onAddFileTreeCallback) {
		this._fileBrowserService.onAddFileTree(args => onAddFileTreeCallback(args));
	}

	public onPathValidate(onPathValidateCallback) {
		this._fileBrowserService.onPathValidate(args => onPathValidateCallback(args));
	}

	public get showFoldersOnly(): boolean {
		return this._showFoldersOnly;
	}

	public initialize(ownerUri: string,
		expandPath: string,
		fileFilters: [{ label: string, filters: string[] }],
		fileValidationServiceType: string,
		showFoldersOnly?: boolean
	) {
		this._ownerUri = ownerUri;
		this._expandPath = expandPath;
		this._fileValidationServiceType = fileValidationServiceType;
		this._showFoldersOnly = !!showFoldersOnly;

		if (!fileFilters) {
			this._fileFilters = [{ label: localize('allFiles', "All files"), filters: ['*'] }];
		} else {
			this._fileFilters = fileFilters;
		}
		this.formattedFileFilters = [];
		for (let i = 0; i < this._fileFilters.length; i++) {
			let filterStr = this._fileFilters[i].label + '(' + this._fileFilters[i].filters.join(';') + ')';
			this.formattedFileFilters.push(filterStr);
		}
	}

	public async validateFilePaths(selectedFiles: string[]): Promise<boolean> {
		return this._fileBrowserService.validateFilePaths(this._ownerUri, this._fileValidationServiceType, selectedFiles);
	}

	public async openFileBrowser(filterIndex: number, changeFilter: boolean): Promise<void> {
		if (this._fileFilters[filterIndex]) {
			await this._fileBrowserService.openFileBrowser(this._ownerUri, this._expandPath, this._fileFilters[filterIndex].filters, changeFilter, this._showFoldersOnly);
		}
	}

	public async closeFileBrowser(): Promise<void> {
		await this._fileBrowserService.closeFileBrowser(this._ownerUri).catch(err => onUnexpectedError(err));
	}
}
