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

export interface TestServerProfile {
	ServerName: string;
	UserName: string;
	Password: string;
	AuthenticationType: AuthenticationType;
	Database: string;
	Provider: ConnectionProvider;
	Version: string;
}

export enum AuthenticationType {
	Windows,
	SqlLogin
}

export enum ConnectionProvider {
	SQLServer
}

var TestingServers: TestServerProfile[] = [
	{
		ServerName: 'SQLTOOLS2017-3',
		UserName: '',
		Password: '',
		AuthenticationType: AuthenticationType.Windows,
		Database: 'master',
		Provider: ConnectionProvider.SQLServer,
		Version: '2017'
	}
];

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