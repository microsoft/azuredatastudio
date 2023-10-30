/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITree, IDataSource } from 'sql/base/parts/tree/browser/tree';
import { TreeNode, TreeItemCollapsibleState } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
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
	public getId(tree: ITree, element?: any): string {
		// Note there really shouldn't be any undefined elements in the tree, but the original implementation
		// didn't do that correctly and since this is going to replaced by the async tree at some point just
		// making it so we handle the undefined case here.
		// This should be safe to do since the undefined element is only used when we want to clear the tree
		// so it'll be the only "element" in the tree and thus there shouldn't be any duplicate ids
		return element?.id || '';
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
	public async getChildren(tree: ITree, element: any): Promise<(ConnectionProfile | ConnectionProfileGroup | TreeNode)[]> {
		if (element instanceof ConnectionProfile) {
			return TreeUpdateUtils.getConnectionNodeChildren(<ConnectionProfile>element, this._objectExplorerService);
		} else if (element instanceof ConnectionProfileGroup) {
			return (element as ConnectionProfileGroup).getChildren();
		} else if (element instanceof TreeNode) {
			let node = element;
			try {
				// Grab the latest data from the server of the node's children.
				await this._objectExplorerService.refreshTreeNode(node.getSession()!, node);
				return node.children;
			}
			catch (expandRefreshError) {
				await node.setExpandedState(TreeItemCollapsibleState.Collapsed);
				node.errorStateMessage = expandRefreshError;
				this.showError(expandRefreshError);
				// collapse node and refresh in case of error so remove tree cache
				setTimeout(() => {
					tree.collapse(element).then(() => tree.refresh(element));
				});
				return [];
			}
		}
		return [];
	}

	/**
	 * Returns the element's parent in a promise.
	 */
	public getParent(tree: ITree, element: any): Promise<any> {
		if (element instanceof ConnectionProfile) {
			return Promise.resolve(element.getParent());
		} else if (element instanceof ConnectionProfileGroup) {
			return Promise.resolve(element.getParent());
		} else if (element instanceof TreeNode) {
			return Promise.resolve(TreeUpdateUtils.getObjectExplorerParent(element, this._connectionManagementService));
		} else {
			return Promise.resolve(null);
		}
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}
