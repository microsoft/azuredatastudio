/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../../appContext';

import { TreeNode } from '../treeNode';
import { IAzureResourceTreeChangeHandler } from './treeChangeHandler';
import { IAzureResourceCacheService } from '../../azureResource/interfaces';
import { AzureResourceServiceNames } from '../constants';

abstract class AzureResourceTreeNodeBase extends TreeNode {
	public constructor(
		public readonly appContext: AppContext,
		public readonly treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode | undefined
	) {
		super();

		this.parent = parent;
	}
}

export abstract class AzureResourceContainerTreeNodeBase extends AzureResourceTreeNodeBase {
	public constructor(
		appContext: AppContext,
		treeChangeHandler: IAzureResourceTreeChangeHandler,
		parent: TreeNode | undefined
	) {
		super(appContext, treeChangeHandler, parent);

		this._cacheService = this.appContext.getService<IAzureResourceCacheService>(AzureResourceServiceNames.cacheService);
	}

	public clearCache(): void {
		this._isClearingCache = true;
	}

	public get isClearingCache(): boolean {
		return this._isClearingCache;
	}

	protected setCacheKey(id: string): void {
		this._cacheKey = this._cacheService.generateKey(id);
	}

	protected updateCache<T>(cache: T): Promise<void> {
		return this._cacheService.update<T>(this._cacheKey!, cache);
	}

	protected getCache<T>(): T | undefined {
		this.ensureCacheKey();
		return this._cacheService.get<T | undefined>(this._cacheKey!);
	}

	private ensureCacheKey(): void {
		if (!this._cacheKey) {
			throw new Error('A cache key must be generated first');
		}
	}

	protected _isClearingCache = true;
	private _cacheService: IAzureResourceCacheService;
	private _cacheKey: string | undefined = undefined;
}
