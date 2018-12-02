/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TreeNode } from '../treeNode';

import { AzureResourceServicePool } from '../servicePool';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';

export abstract class AzureResourceTreeNodeBase extends TreeNode {
	public constructor(
		public readonly treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super();

		this.parent = parent;
	}

	public readonly servicePool = AzureResourceServicePool.getInstance();
}

export abstract class AzureResourceContainerTreeNodeBase extends AzureResourceTreeNodeBase {
	public constructor(
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode
	) {
		super(treeChangeHandler, parent);
	}

	public clearCache(): void {
		this._isClearingCache = true;
	}

	public get isClearingCache(): boolean {
		return this._isClearingCache;
	}

	protected setCacheKey(id: string): void {
        this._cacheKey = this.servicePool.cacheService.generateKey(id);
    }

	protected updateCache<T>(cache: T): void {
		this.servicePool.cacheService.update<T>(this._cacheKey, cache);
	}

	protected getCache<T>(): T {
		return this.servicePool.cacheService.get<T>(this._cacheKey);
	}

	protected _isClearingCache = true;
	private _cacheKey: string = undefined;
}
