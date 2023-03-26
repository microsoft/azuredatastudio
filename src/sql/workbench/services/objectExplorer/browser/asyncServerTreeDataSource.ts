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
import { IAsyncDataSource } from 'vs/base/browser/ui/tree/tree';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

/**
 * Implements the DataSource(that returns a parent/children of an element) for the server tree
 */
export class AsyncServerTreeDataSource implements IAsyncDataSource<ConnectionProfileGroup, ServerTreeElement> {

	constructor(
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
	}
	/**
	 * Returns a boolean value indicating whether the element has children.
	 */
	public hasChildren(element: ServerTreeElement): boolean {
		if (element instanceof ConnectionProfile) {
			return true;
		} else if (element instanceof ConnectionProfileGroup) {
			return true;
		} else if (element instanceof TreeNode) {
			return !element.isAlwaysLeaf;
		}
		return false;
	}

	/**
	 * Returns the element's children as an array in a promise.
	 */
	public async getChildren(element: ServerTreeElement): Promise<ServerTreeElement[]> {
		if (element instanceof ConnectionProfile) {
			if (element.isDisconnecting) {
				element.isDisconnecting = false;
				return [];
			}
			return await TreeUpdateUtils.getAsyncConnectionNodeChildren(element, this._connectionManagementService, this._objectExplorerService, this._configurationService);
		} else if (element instanceof ConnectionProfileGroup) {
			return element.getChildren();
		} else if (element instanceof TreeNode) {
			if (element.children) {
				return element.children;
			} else {
				return await this._objectExplorerService.resolveTreeNodeChildren(element.getSession()!, element);
			}
		}
		return [];
	}
}
