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
}

export type ServerTreeElement = ConnectionProfile | ConnectionProfileGroup | TreeNode;
