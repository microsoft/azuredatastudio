/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/*
	TODO: Due to a runtime error, I duplicated this file at these 2 locations:
	$/extensions/integration-test/src/testConfig.ts
	$/test/smoke/src/sql/testConfig.ts
	for now, make sure to keep both files in sync.
*/

interface ITestServerProfile {
	serverName: string;
	userName: string;
	password: string;
	authenticationType: AuthenticationType;
	database: string;
	provider: ConnectionProvider;
	version: string;
	engineType: EngineType;
}

interface INameDisplayNamePair {
	name: string;
	displayName: string;
}

export enum AuthenticationType {
	Windows,
	SqlLogin
}

export enum ConnectionProvider {
	SQLServer
}

export enum EngineType {
	Standalone,
	Azure,
}

let connectionProviderMapping: { [key: string]: { name: string; displayName: string } } = {};
let authenticationTypeMapping: { [key: string]: { name: string; displayName: string } } = {};
connectionProviderMapping[ConnectionProvider.SQLServer] = { name: 'MSSQL', displayName: 'Microsoft SQL Server' };

authenticationTypeMapping[AuthenticationType.SqlLogin] = { name: azdata.connection.AuthenticationType.SqlLogin, displayName: 'SQL Login' };
authenticationTypeMapping[AuthenticationType.Windows] = { name: 'Integrated', displayName: 'Windows Authentication' };

export function getConfigValue(name: string): string {
	let configValue = process.env[name];
	return configValue ? configValue.toString() : '';
}

export const EnvironmentVariable_STANDALONE_SERVER: string = 'STANDALONE_SQL';
export const EnvironmentVariable_STANDALONE_USERNAME: string = 'STANDALONE_SQL_USERNAME';
export const EnvironmentVariable_STANDALONE_PASSWORD: string = 'STANDALONE_SQL_PWD';
export const EnvironmentVariable_AZURE_SERVER: string = 'AZURE_SQL';
export const EnvironmentVariable_AZURE_USERNAME: string = 'AZURE_SQL_USERNAME';
export const EnvironmentVariable_AZURE_PASSWORD: string = 'AZURE_SQL_PWD';
export const EnvironmentVariable_PYTHON_PATH: string = 'PYTHON_TEST_PATH';
export const EnvironmentVariable_STANDALONE_SERVER_2019: string = 'STANDALONE_SQL_2019';
export const EnvironmentVariable_STANDALONE_USERNAME_2019: string = 'STANDALONE_SQL_USERNAME_2019';
export const EnvironmentVariable_STANDALONE_PASSWORD_2019: string = 'STANDALONE_SQL_PWD_2019';

export interface TestConnectionInfo {
	readonly serverName: string;
	readonly database: string;
	readonly userName: string;
	readonly password: string;
	readonly providerName: string;
	readonly authenticationTypeName: string;
}
export class TestServerProfile implements TestConnectionInfo {
	constructor(private _profile: ITestServerProfile) { }
	public get serverName(): string { return this._profile.serverName; }
	public get userName(): string { return this._profile.userName; }
	public get password(): string { return this._profile.password; }
	public get database(): string { return this._profile.database; }
	public get version(): string { return this._profile.version; }
	public get provider(): ConnectionProvider { return this._profile.provider; }
	public get providerName(): string { return getEnumMappingEntry(connectionProviderMapping, this.provider).name; }
	public get providerDisplayName(): string { return getEnumMappingEntry(connectionProviderMapping, this.provider).displayName; }
	public get authenticationType(): AuthenticationType { return this._profile.authenticationType; }
	public get authenticationTypeName(): string { return getEnumMappingEntry(authenticationTypeMapping, this.authenticationType).name; }
	public get authenticationTypeDisplayName(): string { return getEnumMappingEntry(authenticationTypeMapping, this.authenticationType).displayName; }
	public get engineType(): EngineType { return this._profile.engineType; }
}

let TestingServers: TestServerProfile[] = [
	new TestServerProfile(
		{
			serverName: getConfigValue(EnvironmentVariable_STANDALONE_SERVER),
			userName: getConfigValue(EnvironmentVariable_STANDALONE_USERNAME),
			password: getConfigValue(EnvironmentVariable_STANDALONE_PASSWORD),
			authenticationType: AuthenticationType.SqlLogin,
			database: 'master',
			provider: ConnectionProvider.SQLServer,
			version: '2017',
			engineType: EngineType.Standalone
		}),
	new TestServerProfile(
		{
			serverName: getConfigValue(EnvironmentVariable_AZURE_SERVER),
			userName: getConfigValue(EnvironmentVariable_AZURE_USERNAME),
			password: getConfigValue(EnvironmentVariable_AZURE_PASSWORD),
			authenticationType: AuthenticationType.SqlLogin,
			database: 'master',
			provider: ConnectionProvider.SQLServer,
			version: '2012',
			engineType: EngineType.Azure
		}),
	new TestServerProfile(
		{
			serverName: getConfigValue(EnvironmentVariable_STANDALONE_SERVER_2019),
			userName: getConfigValue(EnvironmentVariable_STANDALONE_USERNAME_2019),
			password: getConfigValue(EnvironmentVariable_STANDALONE_PASSWORD_2019),
			authenticationType: AuthenticationType.SqlLogin,
			database: 'master',
			provider: ConnectionProvider.SQLServer,
			version: '2019',
			engineType: EngineType.Standalone
		})
];

function getEnumMappingEntry(mapping: any, enumValue: any): INameDisplayNamePair {
	let entry = mapping[enumValue];
	if (entry) {
		return entry;
	} else {
		throw new Error(`Unknown enum type: ${enumValue.toString()}`);
	}
}

export async function getAzureServer(): Promise<TestServerProfile> {
	let servers = await getTestingServers();
	return servers.filter(s => s.engineType === EngineType.Azure)[0];
}

export async function getStandaloneServer(version: '2017' | '2019' = '2017'): Promise<TestServerProfile> {
	let servers = await getTestingServers();
	return servers.filter(s => s.version === version && s.engineType === EngineType.Standalone)[0];
}

export async function getTestingServers(): Promise<TestServerProfile[]> {
	let promise = new Promise<TestServerProfile[]>(resolve => {
		resolve(TestingServers);
	});
	await promise;
	return promise;
}
