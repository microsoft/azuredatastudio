/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as data from 'data';
import { FileBrowserTree } from 'sql/parts/fileBrowser/common/fileBrowserTree';
import { FileNode } from 'sql/parts/fileBrowser/common/fileNode';
import Event from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IFileBrowserDialogController = createDecorator<IFileBrowserDialogController>('fileBrowserDialogService');
export interface IFileBrowserDialogController {
	_serviceBrand: any;
	/**
	 * Show file browser dialog
	 */
	showDialog(ownerUri: string,
		expandPath: string,
		fileFilters: [{label: string, filters: string[]}],
		fileValidationServiceType: string,
		isWide: boolean,
		handleOnOk: (path: string) => void): void;
}

export const IFileBrowserService = createDecorator<IFileBrowserService>('fileBrowserService');
export interface IFileBrowserService {
	_serviceBrand: any;
	onAddFileTree: Event<FileBrowserTree>;
	onExpandFolder: Event<FileNode>;
	onPathValidate: Event<data.FileBrowserValidatedParams>;

	/**
	 * Register file browser provider
	 */
	registerProvider(providerId: string, provider: data.FileBrowserProvider): void;

	/**
	 * Open file browser
	 */
	openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Thenable<boolean>;

	/**
	 * Event called when file browser is opened
	 */
	onFileBrowserOpened(handle: number, fileBrowserOpenedParams: data.FileBrowserOpenedParams);

	/**
	 * Expand folder node
	 */
	expandFolderNode(fileNode: FileNode): Thenable<FileNode[]>;

	/**
	 * Event called when children nodes are retrieved
	 */
	onFolderNodeExpanded(handle: number, fileBrowserExpandedParams: data.FileBrowserExpandedParams);

	/**
	 * Validate selected file paths
	 */
	validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Thenable<boolean>;

	/**
	 * Event called when the validation is complete
	 */
	onFilePathsValidated(handle: number, fileBrowserValidatedParams: data.FileBrowserValidatedParams);

	/**
	 * Close file browser
	 */
	closeFileBrowser(ownerUri: string): Thenable<data.FileBrowserCloseResponse>;
}