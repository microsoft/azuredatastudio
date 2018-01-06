/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { ICapabilitiesService, ProviderFeatures } from 'sql/services/capabilities/capabilitiesService';
import { ConnectionOptionSpecialType, ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';

import Event from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';
import { ConnectionProviderProperties } from 'sql/workbench/parts/connection/common/connectionProviderExtension';

export class CapabilitiesTestService implements ICapabilitiesService {
	public get providers(): { [id: string]: ProviderFeatures; } {
		return undefined;
	}

	public getCapabilities(providerId: string): ProviderFeatures {
		return this._capabilities[providerId];
	}

	public readonly onConnectionProviderRegistered: Event<ProviderFeatures>;

	onFeatureUpdateRegistered(providerId: string): Event<ProviderFeatures> {
		throw new Error("Method not implemented.");
	}

	private _capabilities: { [id: string]: ProviderFeatures; } = {};

	public _serviceBrand: any;

	constructor() {

		let connectionProvider: sqlops.ConnectionOption[] = [
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
		];

		let msSQLCapabilities: ConnectionProviderProperties = {
			providerId: 'MSSQL',
			displayName: 'MSSQL',
			connectionOptions: connectionProvider
		};

		this._capabilities['MSSQL'] = { connection: msSQLCapabilities, restore: undefined, backup: undefined, serialization: undefined };
	}

	public isFeatureAvailable(featureName: Action, connectionManagementInfo: ConnectionManagementInfo): boolean {
		return true;
	}
}

