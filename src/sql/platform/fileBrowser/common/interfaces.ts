/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { FileBrowserTree } from 'sql/workbench/services/fileBrowser/common/fileBrowserTree';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const IFileBrowserService = createDecorator<IFileBrowserService>('fileBrowserService');
export interface IFileBrowserService {
	_serviceBrand: undefined;
	onAddFileTree: Event<FileBrowserTree>;
	onExpandFolder: Event<FileNode>;
	onPathValidate: Event<azdata.FileBrowserValidatedParams>;

	/**
	 * Register file browser provider
	 */
	registerProvider(providerId: string, provider: azdata.FileBrowserProvider): void;

	/**
	 * Open file browser
	 */
	openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Promise<boolean>;

	/**
	 * Event called when file browser is opened
	 */
	onFileBrowserOpened(handle: number, fileBrowserOpenedParams: azdata.FileBrowserOpenedParams): void;

	/**
	 * Expand folder node
	 */
	expandFolderNode(fileNode: FileNode): Promise<FileNode[]>;

	/**
	 * Event called when children nodes are retrieved
	 */
	onFolderNodeExpanded(handle: number, fileBrowserExpandedParams: azdata.FileBrowserExpandedParams): void;

	/**
	 * Validate selected file paths
	 */
	validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Promise<boolean>;

	/**
	 * Event called when the validation is complete
	 */
	onFilePathsValidated(handle: number, fileBrowserValidatedParams: azdata.FileBrowserValidatedParams): void;

	/**
	 * Close file browser
	 */
	closeFileBrowser(ownerUri: string): Promise<azdata.FileBrowserCloseResponse | undefined>;
}
