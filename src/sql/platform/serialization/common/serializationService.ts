/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import * as sqlops from 'sqlops';

export const SERVICE_ID = 'serializationService';

export interface SerializationProviderEvents {
	onSaveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult>;
}

export const ISerializationService = createDecorator<ISerializationService>(SERVICE_ID);

export interface ISerializationService {
	_serviceBrand: any;

	saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult>;

	disabledSaveAs(): Thenable<sqlops.SaveResultRequestResult>;

	addEventListener(handle: number, events: SerializationProviderEvents): IDisposable;

	getSerializationFeatureMetadataProvider(ownerUri: string): sqlops.FeatureMetadataProvider;
}

export class SerializationService implements ISerializationService {

	_serviceBrand: any;

	private disposables: IDisposable[] = [];

	private _serverEvents: { [handle: number]: SerializationProviderEvents; } = Object.create(null);

	private _lastHandle: number;

	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
	}

	public addEventListener(handle: number, events: SerializationProviderEvents): IDisposable {
		this._lastHandle = handle;

		this._serverEvents[handle] = events;

		return {
			dispose: () => {
			}
		};
	}

	public saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult> {
		if (this._serverEvents === undefined || this._serverEvents[this._lastHandle] === undefined) {
			return this.disabledSaveAs();
		}

		return this._serverEvents[this._lastHandle].onSaveAs(saveFormat, savePath, results, appendToFile);
	}

	public disabledSaveAs(): Thenable<sqlops.SaveResultRequestResult> {
		return Promise.resolve({ messages: 'Saving results into different format disabled for this data provider.' });

	}

	public getSerializationFeatureMetadataProvider(ownerUri: string): sqlops.FeatureMetadataProvider {
		let providerId: string = this._connectionService.getProviderIdFromUri(ownerUri);
		let providerCapabilities = this._capabilitiesService.getLegacyCapabilities(providerId);

		if (providerCapabilities) {
			return providerCapabilities.features.find(f => f.featureName === SERVICE_ID);
		}

		return undefined;
	}

	public dispose(): void {
		this.disposables = dispose(this.disposables);
	}
}
