/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as azdata from 'azdata';

export const SERVICE_ID = 'metadataService';

export const IMetadataService = createDecorator<IMetadataService>(SERVICE_ID);

export interface IMetadataService {
	_serviceBrand: undefined;

	getMetadata(connectionUri: string): Thenable<azdata.ProviderMetadata | undefined>;

	getDatabases(connectionUri: string): Thenable<string[] | azdata.DatabaseInfo[]>;

	getTableInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[] | undefined>;

	getViewInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[] | undefined>;

	/**
	 * Register a metadata provider
	 */
	registerProvider(providerId: string, provider: azdata.MetadataProvider): void;
}

export class MetadataService implements IMetadataService {

	_serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.MetadataProvider; } = Object.create(null);

	constructor(@IConnectionManagementService private _connectionService: IConnectionManagementService) {
	}

	public getMetadata(connectionUri: string): Thenable<azdata.ProviderMetadata | undefined> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getMetadata(connectionUri);
			}
		}

		return Promise.resolve(undefined);
	}

	public getDatabases(connectionUri: string): Thenable<string[] | azdata.DatabaseInfo[]> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getDatabases(connectionUri);
			}
		}

		return Promise.resolve([]);
	}

	public getTableInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[] | undefined> {
		let providerId: string = this._connectionService.getProviderIdFromUri(connectionUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getTableInfo(connectionUri, metadata);
			}
		}

		return Promise.resolve(undefined);
	}

	public getViewInfo(connectionUri: string, metadata: azdata.ObjectMetadata): Thenable<azdata.ColumnMetadata[] | undefined> {
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
	public registerProvider(providerId: string, provider: azdata.MetadataProvider): void {
		this._providers[providerId] = provider;
	}
}
