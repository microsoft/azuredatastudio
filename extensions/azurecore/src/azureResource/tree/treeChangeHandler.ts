/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeNode } from '../treeNode';

export interface IAzureResourceTreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
