/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { ServiceClientCredentials } from 'ms-rest';
import { TreeNode } from '../../treeNodes';

import { AzureResourceServicePool } from '../servicePool';
import { AzureResourceCredentialError } from '../errors';
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
		public readonly account: sqlops.Account,
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

	protected async getCredentials(): Promise<ServiceClientCredentials[]> {
		try {
			return await this.servicePool.credentialService.getCredentials(this.account, sqlops.AzureResource.ResourceManagement);
		} catch (error) {
			if (error instanceof AzureResourceCredentialError) {
				this.servicePool.contextService.showErrorMessage(error.message);

				this.servicePool.contextService.executeCommand('azureresource.signin');
			} else {
				throw error;
			}
		}
	}

	protected updateCache<T>(cache: T): void {
		this.servicePool.cacheService.update<T>(this.cacheKey, cache);
	}

	protected getCache<T>(): T {
		return this.servicePool.cacheService.get<T>(this.cacheKey);
	}

	protected abstract get cacheKey(): string;

	protected _isClearingCache = true;
}
