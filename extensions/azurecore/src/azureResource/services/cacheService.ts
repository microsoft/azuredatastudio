/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';

import { IAzureResourceCacheService } from '../interfaces';

export class AzureResourceCacheService implements IAzureResourceCacheService {
	public constructor(
		public readonly context: ExtensionContext
	) {
	}

	public generateKey(id: string): string {
        return `${AzureResourceCacheService.cacheKeyPrefix}.${id}`;
    }

    public get<T>(key: string): T | undefined {
		return this.context.workspaceState.get(key);
	}

	public update<T>(key: string, value: T): void {
		this.context.workspaceState.update(key, value);
	}

	private static readonly cacheKeyPrefix = 'azure.resource.cache';
}