/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { ICapabilitiesService, ProviderFeatures, ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

import { Event, Emitter } from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { IDisposable } from 'vs/base/common/lifecycle';

export class TestCapabilitiesService implements ICapabilitiesService {

	private pgsqlProviderName = 'PGSQL';
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
		let pgSQLCapabilities = {
			providerId: this.pgsqlProviderName,
			displayName: this.pgsqlProviderName,
			connectionOptions: connectionProvider,
		};
		this.capabilities[mssqlProviderName] = { connection: msSQLCapabilities };
		this.capabilities[this.pgsqlProviderName] = { connection: pgSQLCapabilities };
	}

	registerConnectionProvider(id: string, properties: ConnectionProviderProperties): IDisposable {
		throw new Error('Method not implemented.');
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): ProviderFeatures {
		return this.capabilities[provider];
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

	public isFeatureAvailable(featureName: Action, connectionManagementInfo: ConnectionManagementInfo): boolean {
		return true;
	}

	public onCapabilitiesReady(): Promise<void> {
		return Promise.resolve();
	}

	public fireCapabilitiesRegistered(id: string, features: ProviderFeatures): void {
		this._onCapabilitiesRegistered.fire({ id, features });
	}

	private _onCapabilitiesRegistered = new Emitter<{ id: string; features: ProviderFeatures }>();
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;
}
