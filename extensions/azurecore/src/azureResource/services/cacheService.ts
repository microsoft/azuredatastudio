/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { IAzureResourceCacheService } from '../interfaces';

export class AzureResourceCacheService implements IAzureResourceCacheService {
	public constructor(
		private _context: ExtensionContext
	) { }

	public generateKey(id: string): string {
		return `${AzureResourceCacheService.cacheKeyPrefix}.${id}`;
	}

	public get<T>(key: string): T | undefined {
		return this._context.workspaceState.get(key);
	}

	public async update<T>(key: string, value: T): Promise<void> {
		await this._context.workspaceState.update(key, value);
	}

	private static readonly cacheKeyPrefix = 'azure.resource.cache';
}
