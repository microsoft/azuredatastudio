/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ConnectionProviderProperties } from 'sql/platform/capabilities/common/capabilitiesService';

// Used to allow various methods of matching profiles
export type ProfileMatcher = (a: IConnectionProfile, b: IConnectionProfile) => boolean;

export interface IConnectionProfile extends azdata.IConnectionProfile {
	serverCapabilities: ConnectionProviderProperties | undefined;
	getOptionsKey(getOriginalOptions?: boolean): string;
	getOptionKeyIdNames(): string[];
	matches(profile: azdata.IConnectionProfile): boolean;
}

export interface IConnectionProfileStore {
	options: { [key: string]: any };
	groupId: string;
	providerName: string;
	savePassword: boolean;
	id: string;
}

export enum ServiceOptionType {
	string = 'string',
	multistring = 'multistring',
	password = 'password',
	number = 'number',
	category = 'category',
	boolean = 'boolean',
	object = 'object'
}

export enum ConnectionOptionSpecialType {
	connectionName = 'connectionName',
	serverName = 'serverName',
	databaseName = 'databaseName',
	authType = 'authType',
	userName = 'userName',
	password = 'password',
	appName = 'appName'
}
