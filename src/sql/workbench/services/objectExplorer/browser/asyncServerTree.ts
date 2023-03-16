/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { FuzzyScore } from 'vs/base/common/filters';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IAsyncDataTreeViewState } from 'vs/base/browser/ui/tree/asyncDataTree';

export class AsyncServerTree extends WorkbenchAsyncDataTree<ConnectionProfileGroup, ServerTreeElement, FuzzyScore> {
	override async setInput(input: ConnectionProfileGroup, viewState?: IAsyncDataTreeViewState): Promise<void> {
		const originalInput = this.getInput();
		await super.setInput(input, viewState);
		originalInput?.dispose();
	}

	/**
	 * Delete and update the children of the parent
	 */
	public async deleteElement(element: ConnectionProfile | ConnectionProfileGroup) {
		if (this.hasNode(element) && this.hasNode(element.parent)) {
			if (element instanceof ConnectionProfile) {
				element.parent.connections = element.parent.connections.filter(c => c.id !== element.id);
			} else if (element instanceof ConnectionProfileGroup) {
				element.parent.children = element.parent.children.filter(c => c.id !== element.id);
			}
			await this.updateChildren(element.parent);
		}
	}
}

export type ServerTreeElement = ConnectionProfile | ConnectionProfileGroup | TreeNode;
