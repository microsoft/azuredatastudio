/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext } from 'vscode';

import { IAzureResourceCacheService } from '../interfaces';

export class AzureResourceCacheService implements IAzureResourceCacheService {
	public constructor(
		context: ExtensionContext
	) {
		this._context = context;
	}

	public generateKey(id: string): string {
		return `${AzureResourceCacheService.cacheKeyPrefix}.${id}`;
	}

	public get<T>(key: string): T | undefined {
		return this._context.workspaceState.get(key);
	}

	public update<T>(key: string, value: T): void {
		this._context.workspaceState.update(key, value);
	}

	private _context: ExtensionContext = undefined;

	private static readonly cacheKeyPrefix = 'azure.resource.cache';
}
