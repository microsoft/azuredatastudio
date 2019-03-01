/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITree, IDataSource } from 'vs/base/parts/tree/browser/tree';
import { TreeNode, TreeItemCollapsibleState } from 'sql/parts/objectExplorer/common/treeNode';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { TPromise } from 'vs/base/common/winjs.base';
import { TreeUpdateUtils } from 'sql/parts/objectExplorer/viewlet/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the server tree
 */
export class ServerTreeDataSource implements IDataSource {

	constructor(
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
	}

	/**
	 * Returns the unique identifier of the given element.
	 * No more than one element may use a given identifier.
	 */
	public getId(tree: ITree, element: any): string {
		if (element instanceof ConnectionProfile
			|| element instanceof ConnectionProfileGroup
			|| element instanceof TreeNode) {
			return element.id;
		} else {
			return undefined;
		}
	}

	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(tree: ITree, element: any): boolean {
		if (element instanceof ConnectionProfile) {
			return true;
		} else if (element instanceof ConnectionProfileGroup) {
			return element.hasChildren();
		} else if (element instanceof TreeNode) {
			return !element.isAlwaysLeaf;
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public getChildren(tree: ITree, element: any): TPromise<any> {
		return new TPromise<any>((resolve) => {
			if (element instanceof ConnectionProfile) {
				TreeUpdateUtils.getObjectExplorerNode(<ConnectionProfile>element, this._connectionManagementService, this._objectExplorerService).then(nodes => {
					resolve(nodes);
				}, error => {
					resolve([]);
				});
			} else if (element instanceof ConnectionProfileGroup) {
				resolve((<ConnectionProfileGroup>element).getChildren());
			} else if (element instanceof TreeNode) {
				var node = element;
				if (node.children) {
					resolve(node.children);
				} else {
					// These similar changes are probably needed for a ConnectionProfile group element as well. However, we do not have a repro of a failiure in that scenario so they will be tackled in a future checkin.
					// It has been tested for connecting to the server in profile itself and things work fine there.
					this._objectExplorerService.resolveTreeNodeChildren(node.getSession(), node).then(() => {
						resolve(node.children);
					}, expandError => {
						node.setExpandedState(TreeItemCollapsibleState.Collapsed);
						node.errorStateMessage = expandError;
						this.showError(expandError);
						resolve([]);
					});
				}
			} else {
				resolve([]);
			}
		});
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): TPromise<any> {
		if (element instanceof ConnectionProfile) {
			return TPromise.as(element.getParent());
		} else if (element instanceof ConnectionProfileGroup) {
			return TPromise.as(element.getParent());
		} else if (element instanceof TreeNode) {
			return TPromise.as(TreeUpdateUtils.getObjectExplorerParent(element, this._connectionManagementService));
		} else {
			return TPromise.as(null);
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}