/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { AppContext } from '../../appContext';

import { TreeNode } from '../treeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';

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

export abstract class CmsResourceContainerTreeNodeBase extends CmsResourceTreeNodeBase {
	public constructor(
		appContext: AppContext,
		treeChangeHandler: ICmsResourceTreeChangeHandler,
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
