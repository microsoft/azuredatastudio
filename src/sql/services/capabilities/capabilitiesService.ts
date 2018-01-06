/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import * as Constants from 'sql/common/constants';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import Event, { Emitter } from 'vs/base/common/event';
import { IAction } from 'vs/base/common/actions';
import { ConnectionProviderProperties, IConnectionProviderRegistry, Extensions as ConnectionExtensions } from 'sql/workbench/parts/connection/common/connectionProviderExtension';
import { clone } from 'vs/base/common/objects';
import { BackupProviderProperties, IBackupProviderRegistry, Extensions as BackupExtensions } from 'sql/workbench/parts/backup/common/backupProviderExtension';
import { SerializationProviderProperties, ISerializationProviderRegistry, Extensions as SerializationExtensions } from 'sql/workbench/parts/serialization/common/serializationProviderExtension';
import { RestoreProviderProperties } from 'sql/workbench/parts/restore/common/restoreProviderRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { toObject } from 'sql/base/common/map';

export const SERVICE_ID = 'capabilitiesService';
export const HOST_NAME = 'sqlops';

export const ICapabilitiesService = createDecorator<ICapabilitiesService>(SERVICE_ID);

const connectionRegistry = Registry.as<IConnectionProviderRegistry>(ConnectionExtensions.ConnectionProviderContributions);
const backupRegistry = Registry.as<IBackupProviderRegistry>(BackupExtensions.BackupProviderContributions);
const serializationRegistry = Registry.as<ISerializationProviderRegistry>(SerializationExtensions.SerializationProviderContributions);

export interface ProviderFeatures {
	connection: ConnectionProviderProperties;
	serialization: SerializationProviderProperties;
	backup: { [id: string]: BackupProviderProperties };
	restore: { [id: string]: RestoreProviderProperties };
}

/**
 * Interface for managing provider capabilities
 */
export interface ICapabilitiesService {
	_serviceBrand: any;

	/**
	 * Retrieve a list of registered capabilities providers
	 */
	readonly providers: { [id: string]: ProviderFeatures };

	/**
	 * Retrieve capability information for a connection provider
	 */
	getCapabilities(providerId: string): ProviderFeatures;

	/**
	 * Returns true if the feature is available for given connection
	 */
	isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean;

	/**
	 * Event raised when a provider is registered
	 */
	onConnectionProviderRegistered: Event<ProviderFeatures>;

	/**
	 * Event raised when a feature is added for a particular connection provider
	 */
	onFeatureUpdateRegistered(providerId: string): Event<ProviderFeatures>;
}

/**
 * Capabilities service implementation class.  This class provides the ability
 * to discover the DMP capabilties that a DMP provider offers.
 */
export class CapabilitiesService extends Disposable implements ICapabilitiesService {

	public _serviceBrand: any;

	private _providers = new Map<string, ProviderFeatures>();
	private _onConnectionProviderRegistered = this._register(new Emitter<ProviderFeatures>());
	private _featureUpdateEvents = new Map<string, Emitter<ProviderFeatures>>();

	public readonly onConnectionProviderRegistered: Event<ProviderFeatures> = this._onConnectionProviderRegistered.event;

	constructor() {
		super();
		let connectionProviderHandler = (e: { id: string, properties: ConnectionProviderProperties }) => {
			let provider = this._providers.get(e.id);
			if (provider) {
				provider.connection = e.properties;
			} else {
				provider = {
					connection: e.properties,
					serialization: undefined,
					backup: {},
					restore: {}
				};
				this._providers.set(e.id, provider);
			}
			if (!this._featureUpdateEvents.has(e.id)) {
				this._featureUpdateEvents.set(e.id, new Emitter<ProviderFeatures>());
			}
			this._onConnectionProviderRegistered.fire(provider);
		};
		let backupProviderHandler = (e: { id: string, properties: BackupProviderProperties }) => {
			let provider = this._providers.get(e.properties.useConnection);
			if (provider) {
				provider.backup[e.id] = e.properties;
			} else {
				provider = {
					connection: undefined,
					serialization: undefined,
					backup: { [e.id]: e.properties },
					restore: {}
				};
				this._providers.set(e.properties.useConnection, provider);
			}
			if (!this._featureUpdateEvents.has(e.properties.useConnection)) {
				this._featureUpdateEvents.set(e.id, new Emitter<ProviderFeatures>());
			}
			this._featureUpdateEvents.get(e.properties.useConnection).fire(provider);
		};
		let serializationProviderHandler = (e: { id: string, properties: SerializationProviderProperties }) => {
			let provider = this._providers.get(e.id);
			if (provider) {
				provider.serialization = e.properties;
			} else {
				provider = {
					connection: undefined,
					serialization: e.properties,
					backup: {},
					restore: {}
				};
				this._providers.set(e.id, provider);
			}
			if (!this._featureUpdateEvents.has(e.id)) {
				this._featureUpdateEvents.set(e.id, new Emitter<ProviderFeatures>());
			}
			this._featureUpdateEvents.get(e.id).fire(provider);
		};

		Object.entries(connectionRegistry.providers).map(v => {
			connectionProviderHandler({ id: v[0], properties: v[1] });
		});
		connectionRegistry.onNewProvider(connectionProviderHandler);

		Object.entries(backupRegistry.providers).map(v => {
			backupProviderHandler({ id: v[0], properties: v[1] });
		});
		backupRegistry.onNewProvider(backupProviderHandler);

		Object.entries(serializationRegistry.providers).map(v => {
			serializationProviderHandler({ id: v[0], properties: v[1] });
		});
		serializationRegistry.onNewProvider(serializationProviderHandler);
	}

	public get providers(): { [id: string]: ProviderFeatures } {
		return toObject(this._providers);
	}

	public getCapabilities(providerId: string): ProviderFeatures {
		return clone(this._providers.get(providerId));
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

	public onFeatureUpdateRegistered(providerId: string): Event<ProviderFeatures> {
		let emitter = this._featureUpdateEvents.get(providerId);
		if (emitter) {
			return emitter.event;
		}
		return undefined;
	}
}
