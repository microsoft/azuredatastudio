/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ICapabilitiesService, ProviderFeatures } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

import { Event, Emitter } from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionShape, ConnectionProfile } from 'sql/base/common/connectionProfile';
import { find } from 'vs/base/common/arrays';

export class TestCapabilitiesService implements ICapabilitiesService {

	public _serviceBrand: undefined;

	public capabilities: { [id: string]: ProviderFeatures } = {};

	constructor() {

		let connectionProvider: azdata.ConnectionOption[] = [
			{
				name: 'connectionName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.connectionName,
				valueType: ServiceOptionType.string
			},
			{
				name: 'serverName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.serverName,
				valueType: ServiceOptionType.string
			},
			{
				name: 'databaseName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.databaseName,
				valueType: ServiceOptionType.string
			},
			{
				name: 'userName',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.userName,
				valueType: ServiceOptionType.string
			},
			{
				name: 'authenticationType',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.authType,
				valueType: ServiceOptionType.string
			},
			{
				name: 'password',
				displayName: undefined!,
				description: undefined!,
				groupName: undefined!,
				categoryValues: undefined!,
				defaultValue: undefined!,
				isIdentity: true,
				isRequired: true,
				specialValueType: ConnectionOptionSpecialType.password,
				valueType: ServiceOptionType.string
			}
		];
		let msSQLCapabilities = {
			providerId: mssqlProviderName,
			displayName: 'MSSQL',
			connectionOptions: connectionProvider,
		};
		this.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): ProviderFeatures {
		return this.capabilities[provider];
	}

	isPasswordRequired(profile: ConnectionProfile): boolean {
		throw new Error('Method not implemented.');
	}

	public getLegacyCapabilities(provider: string): azdata.DataProtocolServerCapabilities {
		throw new Error('Method not implemented.');
	}

	public get providers(): { [id: string]: ProviderFeatures } {
		return this.capabilities;
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 */
	public registerProvider(provider: azdata.CapabilitiesProvider): void {
	}

	// Event Emitters
	public get onProviderRegisteredEvent(): Event<azdata.DataProtocolServerCapabilities> {
		return Event.None;
	}

	public isFeatureAvailable(featureName: Action, connectionManagementInfo: any): boolean {
		return true;
	}

	public onCapabilitiesReady(): Promise<void> {
		return Promise.resolve();
	}

	public fireCapabilitiesRegistered(providerFeatures: ProviderFeatures): void {
		this._onCapabilitiesRegistered.fire(providerFeatures);
	}

	private _onCapabilitiesRegistered = new Emitter<ProviderFeatures>();
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;

	createConnectionShapeFromOptions(options: { [key: string]: any; }, providerName: string): ConnectionShape | undefined {
		const provider = this.getCapabilities(providerName);
		if (!provider) {
			return undefined;
		}
		const connectionOptions = provider.connection.connectionOptions;
		const serverName = filterOutFromOptions(options, ConnectionOptionSpecialType.serverName, connectionOptions);
		const userName = filterOutFromOptions(options, ConnectionOptionSpecialType.userName, connectionOptions);
		const databaseName = filterOutFromOptions(options, ConnectionOptionSpecialType.databaseName, connectionOptions);
		const password = filterOutFromOptions(options, ConnectionOptionSpecialType.password, connectionOptions);
		const authenticationType = filterOutFromOptions(options, ConnectionOptionSpecialType.authType, connectionOptions);
		const connectionName = filterOutFromOptions(options, ConnectionOptionSpecialType.connectionName, connectionOptions);

		return {
			connectionName,
			serverName,
			databaseName,
			userName,
			password,
			authenticationType,
			providerName,
			options
		};
	}

	createOptionsFromConnectionShape(shape: ConnectionShape): { [key: string]: any; } | undefined {
		const provider = this.getCapabilities(shape.providerName);
		if (!provider) {
			return undefined;
		}
		const connectionOptions = provider.connection.connectionOptions;
		const options = Object.create(null);
		assignSpecialValue(options, ConnectionOptionSpecialType.serverName, connectionOptions, shape.serverName);
		assignSpecialValue(options, ConnectionOptionSpecialType.databaseName, connectionOptions, shape.databaseName);
		assignSpecialValue(options, ConnectionOptionSpecialType.userName, connectionOptions, shape.userName);
		assignSpecialValue(options, ConnectionOptionSpecialType.password, connectionOptions, shape.password);
		assignSpecialValue(options, ConnectionOptionSpecialType.authType, connectionOptions, shape.authenticationType);
		assignSpecialValue(options, ConnectionOptionSpecialType.connectionName, connectionOptions, shape.connectionName);
		return options;
	}
}

/**
 * filters out the given option from the options provider AND IN PLACE DELETES THE KEY
 */
function filterOutFromOptions(options: { [key: string]: any; }, type: ConnectionOptionSpecialType, connectionOptions: azdata.ConnectionOption[]): any {
	const key = find(connectionOptions, o => o.specialValueType === type);
	const value = options[key.name];
	delete options[key.name];
	return value;
}

/**
 * In place assigns the key for the type with the value provided and returns the object
 */
function assignSpecialValue(options: { [key: string]: any; }, type: ConnectionOptionSpecialType, connectionOptions: azdata.ConnectionOption[], value: any): { [key: string]: any; } {
	const key = find(connectionOptions, o => o.specialValueType === type);
	if (key && value) {
		options[key.name] = value;
	}
	return options;
}
