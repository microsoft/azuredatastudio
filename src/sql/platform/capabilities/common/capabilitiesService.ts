/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import * as Constants from 'sql/common/constants';
import { ConnectionProviderProperties, IConnectionProviderRegistry, Extensions as ConnectionExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { toObject } from 'sql/base/common/map';

import * as sqlops from 'sqlops';

import { Event, Emitter } from 'vs/base/common/event';
import { IAction } from 'vs/base/common/actions';
import { Memento } from 'vs/workbench/common/memento';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { getIdFromLocalExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';

export const SERVICE_ID = 'capabilitiesService';
export const HOST_NAME = 'sqlops';
export const HOST_VERSION = '1.0';

const connectionRegistry = Registry.as<IConnectionProviderRegistry>(ConnectionExtensions.ConnectionProviderContributions);

interface ConnectionCache {
	[id: string]: ConnectionProviderProperties;
}

interface CapabilitiesMomento {
	connectionProviderCache: ConnectionCache;
}

export const clientCapabilities = {
	hostName: HOST_NAME,
	hostVersion: HOST_VERSION
};

export interface ProviderFeatures {
	connection: ConnectionProviderProperties;
}


export const ICapabilitiesService = createDecorator<ICapabilitiesService>(SERVICE_ID);

/**
 * Interface for managing provider capabilities
 */
export interface ICapabilitiesService {
	_serviceBrand: any;

	/**
	 * Retrieve a list of registered capabilities providers
	 */
	getCapabilities(provider: string): ProviderFeatures;

	/**
	 * get the old version of provider information
	 */
	getLegacyCapabilities(provider: string): sqlops.DataProtocolServerCapabilities;

	/**
	 * Register a capabilities provider
	 */
	registerProvider(provider: sqlops.CapabilitiesProvider): void;

	/**
	 * Returns true if the feature is available for given connection
	 */
	isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean;

	/**
	 * When a new capabilities is registered, it emits the provider name, be to use to get the new capabilities
	 */
	readonly onCapabilitiesRegistered: Event<ProviderFeatures>;

	/**
	 * Get an array of all known providers
	 */
	readonly providers: { [id: string]: ProviderFeatures };

}

/**
 * Capabilities service implementation class.  This class provides the ability
 * to discover the DMP capabilties that a DMP provider offers.
 */
export class CapabilitiesService extends Disposable implements ICapabilitiesService {
	_serviceBrand: any;

	private _momento: Memento;
	private _providers = new Map<string, ProviderFeatures>();
	private _featureUpdateEvents = new Map<string, Emitter<ProviderFeatures>>();
	private _legacyProviders = new Map<string, sqlops.DataProtocolServerCapabilities>();

	private _onCapabilitiesRegistered = this._register(new Emitter<ProviderFeatures>());
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;

	constructor(
		@IStorageService private _storageService: IStorageService,
		@IExtensionService extensionService: IExtensionService,
		@IExtensionManagementService extentionManagementService: IExtensionManagementService
	) {
		super();

		this._momento = new Memento('capabilities', this._storageService);

		if (!this.capabilities.connectionProviderCache) {
			this.capabilities.connectionProviderCache = {};
		}

		// handle in case some extensions have already registered (unlikley)
		Object.entries(connectionRegistry.providers).map(v => {
			this.handleConnectionProvider({ id: v[0], properties: v[1] });
		});
		// register for when new extensions are added
		this._register(connectionRegistry.onNewProvider(this.handleConnectionProvider, this));

		// handle adding already known capabilities (could have caching problems)
		Object.entries(this.capabilities.connectionProviderCache).map(v => {
			this.handleConnectionProvider({ id: v[0], properties: v[1] }, false);
		});

		extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.cleanupProviders();
		});

		this._register(extentionManagementService.onDidUninstallExtension(({ identifier }) => {
			let extensionid = getIdFromLocalExtensionId(identifier.id);
			extensionService.getExtensions().then(i => {
				let extension = i.find(c => c.id === extensionid);
				let id = extension.contributes['connectionProvider'].providerId;
				delete this.capabilities.connectionProviderCache[id];
			});
		}));
	}

	private cleanupProviders(): void {
		let knownProviders = Object.keys(connectionRegistry.providers);
		for (let key in this.capabilities.connectionProviderCache) {
			if (!knownProviders.includes(key)) {
				this._providers.delete(key);
				delete this.capabilities.connectionProviderCache[key];
			}
		}
	}

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
		if (!this._featureUpdateEvents.has(e.id)) {
			this._featureUpdateEvents.set(e.id, new Emitter<ProviderFeatures>());
		}

		if (isNew) {
			this.capabilities.connectionProviderCache[e.id] = e.properties;
			this._onCapabilitiesRegistered.fire(provider);
		}
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): ProviderFeatures {
		return this._providers.get(provider);
	}

	public getLegacyCapabilities(provider: string): sqlops.DataProtocolServerCapabilities {
		return this._legacyProviders.get(provider);
	}

	public get providers(): { [id: string]: ProviderFeatures } {
		return toObject(this._providers);
	}

	private get capabilities(): CapabilitiesMomento {
		return this._momento.getMemento(StorageScope.GLOBAL) as CapabilitiesMomento;
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 * @param provider
	 */
	public registerProvider(provider: sqlops.CapabilitiesProvider): void {
		// request the capabilities from server
		provider.getServerCapabilities(clientCapabilities).then(serverCapabilities => {
			this._legacyProviders.set(serverCapabilities.providerName, serverCapabilities);
		});
	}

	/**
	 * Returns true if the feature is available for given connection
	 * @param featureComponent a component which should have the feature name
	 * @param connectionManagementInfo connectionManagementInfo
	 */
	public isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean {
		let isCloud = connectionManagementInfo && connectionManagementInfo.serverInfo && connectionManagementInfo.serverInfo.isCloud;
		let isMssql = connectionManagementInfo.connectionProfile.providerName === 'MSSQL';
		// TODO: The logic should from capabilities service.
		if (action) {
			let featureName: string = action.id;
			switch (featureName) {
				case Constants.BackupFeatureName:
					if (isMssql) {
						return connectionManagementInfo.connectionProfile.databaseName && !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				case Constants.RestoreFeatureName:
					if (isMssql) {
						return !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				default:
					return true;
			}
		} else {
			return true;
		}
	}

	public shutdown(): void {
		this._momento.saveMemento();
	}
}
