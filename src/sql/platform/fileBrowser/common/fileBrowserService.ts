/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { FileBrowserTree } from 'sql/workbench/services/fileBrowser/common/fileBrowserTree';
import { FileNode } from 'sql/workbench/services/fileBrowser/common/fileNode';
import { IFileBrowserService } from 'sql/platform/fileBrowser/common/interfaces';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

import { Event, Emitter } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import { localize } from 'vs/nls';
import * as strings from 'vs/base/common/strings';
import { invalidProvider } from 'sql/base/common/errors';

export class FileBrowserService implements IFileBrowserService {
	public _serviceBrand: undefined;
	private _providers: { [handle: string]: azdata.FileBrowserProvider; } = Object.create(null);
	private _onAddFileTree = new Emitter<FileBrowserTree>();
	private _onExpandFolder = new Emitter<FileNode>();
	private _onPathValidate = new Emitter<azdata.FileBrowserValidatedParams>();
	private _pathToFileNodeMap: { [path: string]: FileNode } = {};
	private _expandResolveMap: { [key: string]: any } = {};
	static fileNodeId: number = 0;

	constructor(@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService) {
	}

	public registerProvider(providerId: string, provider: azdata.FileBrowserProvider): void {
		this._providers[providerId] = provider;
	}

	public get onAddFileTree(): Event<FileBrowserTree> {
		return this._onAddFileTree.event;
	}

	public get onExpandFolder(): Event<FileNode> {
		return this._onExpandFolder.event;
	}

	public get onPathValidate(): Event<azdata.FileBrowserValidatedParams> {
		return this._onPathValidate.event;
	}

	public openFileBrowser(ownerUri: string, expandPath: string, fileFilters: string[], changeFilter: boolean): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			const provider = this.getProvider(ownerUri);
			if (provider) {
				provider.openFileBrowser(ownerUri, expandPath, fileFilters, changeFilter).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	public onFileBrowserOpened(handle: number, fileBrowserOpenedParams: azdata.FileBrowserOpenedParams) {
		if (fileBrowserOpenedParams.succeeded === true
			&& fileBrowserOpenedParams.fileTree
			&& fileBrowserOpenedParams.fileTree.rootNode
			&& fileBrowserOpenedParams.fileTree.selectedNode
		) {
			let fileTree = this.convertFileTree(undefined, fileBrowserOpenedParams.fileTree.rootNode, fileBrowserOpenedParams.fileTree.selectedNode.fullPath, fileBrowserOpenedParams.ownerUri);
			this._onAddFileTree.fire({ rootNode: fileTree.rootNode, selectedNode: fileTree.selectedNode, expandedNodes: fileTree.expandedNodes });
		} else {
			let genericErrorMessage = localize('fileBrowserErrorMessage', "An error occured while loading the file browser.");
			let errorDialogTitle = localize('fileBrowserErrorDialogTitle', "File browser error");
			let errorMessage = strings.isFalsyOrWhitespace(fileBrowserOpenedParams.message) ? genericErrorMessage : fileBrowserOpenedParams.message;
			this._errorMessageService.showDialog(Severity.Error, errorDialogTitle, errorMessage);
		}
	}

	public expandFolderNode(fileNode: FileNode): Promise<FileNode[]> {
		this._pathToFileNodeMap[fileNode.fullPath] = fileNode;
		let self = this;
		return new Promise<FileNode[]>((resolve, reject) => {
			const provider = this.getProvider(fileNode.ownerUri);
			if (provider) {
				provider.expandFolderNode(fileNode.ownerUri, fileNode.fullPath).then(result => {
					let mapKey = self.generateResolveMapKey(fileNode.ownerUri, fileNode.fullPath);
					self._expandResolveMap[mapKey] = resolve;
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	public onFolderNodeExpanded(handle: number, fileBrowserExpandedParams: azdata.FileBrowserExpandedParams) {
		let mapKey = this.generateResolveMapKey(fileBrowserExpandedParams.ownerUri, fileBrowserExpandedParams.expandPath);
		let expandResolve = this._expandResolveMap[mapKey];
		if (expandResolve) {
			if (fileBrowserExpandedParams.succeeded === true) {
				// get the expanded folder node
				let expandedNode = this._pathToFileNodeMap[fileBrowserExpandedParams.expandPath];
				if (expandedNode) {
					if (fileBrowserExpandedParams.children && fileBrowserExpandedParams.children.length > 0) {
						expandedNode.children = this.convertChildren(expandedNode, fileBrowserExpandedParams.children, fileBrowserExpandedParams.ownerUri);
					}
					expandResolve(expandedNode.children ? expandedNode.children : []);
					this._onExpandFolder.fire(expandedNode);
				} else {
					expandResolve([]);
				}
			} else {
				expandResolve([]);
			}
		}
	}

	public validateFilePaths(ownerUri: string, serviceType: string, selectedFiles: string[]): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			const provider = this.getProvider(ownerUri);
			if (provider) {
				provider.validateFilePaths(ownerUri, serviceType, selectedFiles).then(result => {
					resolve(result);
				}, error => {
					reject(error);
				});
			} else {
				reject(invalidProvider());
			}
		});
	}

	public onFilePathsValidated(handle: number, fileBrowserValidatedParams: azdata.FileBrowserValidatedParams) {
		this._onPathValidate.fire(fileBrowserValidatedParams);
	}

	public closeFileBrowser(ownerUri: string): Promise<azdata.FileBrowserCloseResponse | undefined> {
		let provider = this.getProvider(ownerUri);
		if (provider) {
			return Promise.resolve(provider.closeFileBrowser(ownerUri));
		}
		return Promise.resolve(undefined);
	}

	private generateResolveMapKey(ownerUri: string, expandPath: string): string {
		return ownerUri + ':' + expandPath;
	}

	private getProvider(connectionUri: string): azdata.FileBrowserProvider | undefined {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			return this._providers[providerId];
		} else {
			return undefined;
		}
	}

	private convertFileTree(parentNode: FileNode | undefined, fileTreeNode: azdata.FileTreeNode, expandPath: string, ownerUri: string): FileBrowserTree {
		FileBrowserService.fileNodeId += 1;
		let expandedNodes: FileNode[] = [];
		let selectedNode: FileNode | undefined;
		let fileNode = new FileNode(FileBrowserService.fileNodeId.toString(),
			fileTreeNode.name,
			fileTreeNode.fullPath,
			fileTreeNode.isFile,
			fileTreeNode.isExpanded,
			ownerUri,
			parentNode
		);

		if (fileNode.isExpanded === true) {
			expandedNodes.push(fileNode);
		}

		if (fileTreeNode.children) {
			let convertedChildren = [];
			for (let i = 0; i < fileTreeNode.children.length; i++) {
				let convertedFileTree: FileBrowserTree = this.convertFileTree(fileNode, fileTreeNode.children[i], expandPath, ownerUri);
				convertedChildren.push(convertedFileTree.rootNode);

				if (convertedFileTree.expandedNodes.length > 0) {
					expandedNodes = expandedNodes.concat(convertedFileTree.expandedNodes);
				}

				if (convertedFileTree.selectedNode) {
					selectedNode = convertedFileTree.selectedNode;
				}
			}

			if (convertedChildren.length > 0) {
				fileNode.children = convertedChildren;
			}
		}

		if (!selectedNode && fileTreeNode.fullPath === expandPath) {
			selectedNode = fileNode;
		}

		// Assume every folder has children initially
		if (fileTreeNode.isFile === false) {
			fileNode.hasChildren = true;
		}

		return { rootNode: fileNode, selectedNode: selectedNode, expandedNodes: expandedNodes };
	}

	private convertChildren(expandedNode: FileNode, childrenToConvert: azdata.FileTreeNode[], ownerUri: string): FileNode[] {
		let childrenNodes = [];

		for (let i = 0; i < childrenToConvert.length; i++) {
			FileBrowserService.fileNodeId += 1;
			let childNode = new FileNode(FileBrowserService.fileNodeId.toString(),
				childrenToConvert[i].name,
				childrenToConvert[i].fullPath,
				childrenToConvert[i].isFile,
				childrenToConvert[i].isExpanded,
				ownerUri,
				expandedNode
			);

			// Assume every folder has children initially
			if (childrenToConvert[i].isFile === false) {
				childNode.hasChildren = true;
			}
			childrenNodes.push(childNode);
		}

		return childrenNodes;
	}
}
