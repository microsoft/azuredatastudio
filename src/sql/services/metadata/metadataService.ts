/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import data = require('data');

export const SERVICE_ID = 'metadataService';

export const IMetadataService = createDecorator<IMetadataService>(SERVICE_ID);

export interface IMetadataService {
	_serviceBrand: any;

	getMetadata(connectionUri: string): Thenable<data.ProviderMetadata>;

	getDatabaseNames(connectionUri: string): Thenable<string[]>;

	getTableInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]>;

	getViewInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]>;

	/**
	 * Register a metadata provider
	 */
	registerProvider(providerId: string, provider: data.MetadataProvider): void;
}

export class MetadataService implements IMetadataService {

	public _serviceBrand: any;

	private _disposables: IDisposable[] = [];

	private _providers: { [handle: string]: data.MetadataProvider; } = Object.create(null);

	constructor(@IConnectionManagementService private _connectionService: IConnectionManagementService) {
	}

	public getMetadata(connectionUri: string): Thenable<data.ProviderMetadata> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getMetadata(connectionUri);
			}
		}

		return Promise.resolve(undefined);
	}

	public getDatabaseNames(connectionUri: string): Thenable<string[]> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getDatabases(connectionUri);
			}
		}

		return Promise.resolve(undefined);
	}

	public getTableInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getTableInfo(connectionUri, metadata);
			}
		}

		return Promise.resolve(undefined);
	}

	public getViewInfo(connectionUri: string, metadata: data.ObjectMetadata): Thenable<data.ColumnMetadata[]> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getViewInfo(connectionUri, metadata);
			}
		}

		return Promise.resolve(undefined);
	}

	/**
	 * Register a metadata provider
	 */
	public registerProvider(providerId: string, provider: data.MetadataProvider): void {
		this._providers[providerId] = provider;
	}

	public dispose(): void {
		this._disposables = dispose(this._disposables);
	}
}
