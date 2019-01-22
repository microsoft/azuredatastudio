/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

var connectionProviderMapping = {};
var authenticationTypeMapping = {};
connectionProviderMapping[ConnectionProvider.SQLServer] = { name: 'MSSQL', displayName: 'Microsoft SQL Server' };

authenticationTypeMapping[AuthenticationType.SqlLogin] = { name: 'SqlLogin', displayName: 'SQL Login' };
authenticationTypeMapping[AuthenticationType.Windows] = { name: 'Integrated', displayName: 'Windows Authentication' };

export class TestServerProfile {
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
}

var TestingServers: TestServerProfile[] = [
	new TestServerProfile(
		{
			serverName: 'SQLTOOLS2017-3',
			userName: '',
			password: '',
			authenticationType: AuthenticationType.Windows,
			database: 'master',
			provider: ConnectionProvider.SQLServer,
			version: '2017'
		})
];

function getEnumMappingEntry(mapping: any, enumValue: any): INameDisplayNamePair {
	let entry = mapping[enumValue];
	if (entry) {
		return entry;
	} else {
		throw `Unknown enum type: ${enumValue.toString()}`;
	}
}

export async function getDefaultTestingServer(): Promise<TestServerProfile> {
	let servers = await getTestingServers();
	return servers[0];
}

export async function getTestingServers(): Promise<TestServerProfile[]> {
	let promise = new Promise<TestServerProfile[]>(resolve => {
		resolve(TestingServers);
	});
	await promise;
	return promise;
}