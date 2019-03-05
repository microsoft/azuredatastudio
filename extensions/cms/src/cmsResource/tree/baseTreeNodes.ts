/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { AppContext } from '../../appContext';
import { TreeNode } from '../treeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { ShellQuotingOptions } from 'vscode';

export abstract class CmsResourceTreeNodeBase extends TreeNode {

	public constructor(
		public readonly appContext: AppContext,
		public readonly treeChangeHandler: ICmsResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super();
		this.parent = parent;
	}
}

export interface CmsResourceNodeInfo {
	name: string;
	description: string;
	ownerUri: string;
	connection: sqlops.connection.Connection;
}