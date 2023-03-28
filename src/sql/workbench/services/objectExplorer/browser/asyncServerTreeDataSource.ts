/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IAsyncDataSource } from 'vs/base/browser/ui/tree/tree';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the server tree
 */
export class AsyncServerTreeDataSource implements IAsyncDataSource<ConnectionProfileGroup, ServerTreeElement> {

	constructor(
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
	}
	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(element: ServerTreeElement): boolean {
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
	public async getChildren(element: ServerTreeElement): Promise<ServerTreeElement[]> {
		try {
			if (element instanceof ConnectionProfile) {
				return await TreeUpdateUtils.getAsyncConnectionNodeChildren(element, this._connectionManagementService, this._objectExplorerService);
			} else if (element instanceof ConnectionProfileGroup) {
				return (element as ConnectionProfileGroup).getChildren();
			} else if (element instanceof TreeNode) {
				if (element.children) {
					return element.children;
				} else {
					return await this._objectExplorerService.resolveTreeNodeChildren(element.getSession()!, element);
				}
			}
		} catch (err) {
			if (element instanceof TreeNode) {
				element.errorStateMessage = err.message ?? err;
			}
			if (err.message) {
				this.showError(err.message);
			}

			throw err;
		}
		return [];
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}
