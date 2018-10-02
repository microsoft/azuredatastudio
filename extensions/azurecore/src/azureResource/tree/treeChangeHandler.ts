/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeNode } from '../../treeNodes';

export interface IAzureResourceTreeChangeHandler {
	notifyNodeChanged(node: TreeNode): void;
}
