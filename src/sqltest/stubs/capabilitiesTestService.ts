/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

import Event from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';


export class CapabilitiesTestService implements ICapabilitiesService {

	public _serviceBrand: any;

	private _capabilities: sqlops.DataProtocolServerCapabilities[] = [];


	constructor() {

		let connectionProvider: sqlops.ConnectionProviderOptions = {
			options: [
				{
					name: 'serverName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.serverName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'databaseName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.databaseName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'userName',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.userName,
					valueType: ServiceOptionType.string
				},
				{
					name: 'authenticationType',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.authType,
					valueType: ServiceOptionType.string
				},
				{
					name: 'password',
					displayName: undefined,
					description: undefined,
					groupName: undefined,
					categoryValues: undefined,
					defaultValue: undefined,
					isIdentity: true,
					isRequired: true,
					specialValueType: ConnectionOptionSpecialType.password,
					valueType: ServiceOptionType.string
				}
			]
		};
		let msSQLCapabilities = {
			protocolVersion: '1',
			providerName: 'MSSQL',
			providerDisplayName: 'MSSQL',
			connectionProvider: connectionProvider,
			adminServicesProvider: undefined,
			features: undefined
		};
		this._capabilities.push(msSQLCapabilities);

	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(): sqlops.DataProtocolServerCapabilities[] {
		return this._capabilities;
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 * @param provider
	 */
	public registerProvider(provider: sqlops.CapabilitiesProvider): void {
	}

	// Event Emitters
	public get onProviderRegisteredEvent(): Event<sqlops.DataProtocolServerCapabilities> {
		return undefined;
	}

	public isFeatureAvailable(featureName: Action, connectionManagementInfo: ConnectionManagementInfo): boolean {
		return true;
	}
}

