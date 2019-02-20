/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AppContext } from '../../appContext';

import { TreeNode } from '../treeNode';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { AzureResourceServiceNames } from '../constants';

export abstract class AzureResourceTreeNodeBase extends TreeNode {
	public constructor(
		public readonly appContext: AppContext,
		public readonly treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super();

		this.parent = parent;
	}
}

export abstract class AzureResourceContainerTreeNodeBase extends AzureResourceTreeNodeBase {
	public constructor(
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(appContext, treeChangeHandler, parent);

	}

	public clearCache(): void {
		this._isClearingCache = true;
	}

	public get isClearingCache(): boolean {
		return this._isClearingCache;
	}


	protected _isClearingCache = true;
	private _cacheKey: string = undefined;
}
