/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

import * as azdata from 'azdata';

import { toObject } from 'sql/base/common/map';
import { ICapabilitiesService, ProviderFeatures, clientCapabilities, ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

/**
 * Capabilities service implementation class.  This class provides the ability
 * to discover the DMP capabilities that a DMP provider offers.
 */
export class CapabilitiesService extends Disposable implements ICapabilitiesService {
	_serviceBrand: undefined;

	private _providers = new Map<string, ProviderFeatures>();
	private _legacyProviders = new Map<string, azdata.DataProtocolServerCapabilities>();

	private _onCapabilitiesRegistered = this._register(new Emitter<ProviderFeatures>());
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;

	private handleConnectionProvider(e: { id: string, properties: ConnectionProviderProperties }, isNew = true): void {

		let provider = this._providers.get(e.id);
		if (provider) {
			provider.connection = e.properties;
		} else {
			provider = {
				connection: e.properties
			};
			this._providers.set(e.id, provider);
		}

		if (isNew) {
			this._onCapabilitiesRegistered.fire(provider);
		}
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): ProviderFeatures | undefined {
		return this._providers.get(provider);
	}

	public getLegacyCapabilities(provider: string): azdata.DataProtocolServerCapabilities | undefined {
		return this._legacyProviders.get(provider);
	}

	public get providers(): { [id: string]: ProviderFeatures } {
		return toObject(this._providers);
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 */
	public registerProvider(provider: azdata.CapabilitiesProvider): void {
		// request the capabilities from server
		provider.getServerCapabilities(clientCapabilities).then(serverCapabilities => {
			this._legacyProviders.set(serverCapabilities.providerName, serverCapabilities);
		});
	}
}
