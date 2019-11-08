/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeNode } from '../treeNode';

export interface ICmsResourceTreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
