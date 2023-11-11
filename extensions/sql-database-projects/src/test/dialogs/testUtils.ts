/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as vscodeMssql from 'vscode-mssql';
import { RequestType } from 'vscode-languageclient';

export interface TestUtils {
	vscodeMssqlIExtension: TypeMoq.IMock<vscodeMssql.IExtension>;
}

export class MockVscodeMssqlIExtension implements vscodeMssql.IExtension {
	sqlToolsServicePath: string = '';
	dacFx: vscodeMssql.IDacFxService;
	sqlProjects: vscodeMssql.ISqlProjectsService;
	schemaCompare: vscodeMssql.ISchemaCompareService;
	azureAccountService: vscodeMssql.IAzureAccountService;
	azureResourceService: vscodeMssql.IAzureResourceService;

	constructor() {
		this.dacFx = TypeMoq.Mock.ofType<vscodeMssql.IDacFxService>().object;
		this.sqlProjects = TypeMoq.Mock.ofType<vscodeMssql.ISqlProjectsService>().object;
		this.schemaCompare = TypeMoq.Mock.ofType<vscodeMssql.ISchemaCompareService>().object;
		this.azureAccountService = TypeMoq.Mock.ofType<vscodeMssql.IAzureAccountService>().object;
		this.azureResourceService = TypeMoq.Mock.ofType<vscodeMssql.IAzureResourceService>().object;
	}

	promptForFirewallRule(_: string, __: vscodeMssql.IConnectionInfo): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	sendRequest<P, R, E>(_: RequestType<P, R, E>, __?: P): Promise<R> {
		throw new Error('Method not implemented.');
	}
	promptForConnection(_?: boolean): Promise<vscodeMssql.IConnectionInfo | undefined> {
		throw new Error('Method not implemented.');
	}
	connect(_: vscodeMssql.IConnectionInfo, __?: boolean): Promise<string> {
		throw new Error('Method not implemented.');
	}
	listDatabases(_: string): Promise<string[]> {
		throw new Error('Method not implemented.');
	}
	getDatabaseNameFromTreeNode(_: vscodeMssql.ITreeNodeInfo): string {
		throw new Error('Method not implemented.');
	}
	getConnectionString(_: string | vscodeMssql.ConnectionDetails, ___?: boolean, _____?: boolean): Promise<string> {
		throw new Error('Method not implemented.');
	}
	createConnectionDetails(_: vscodeMssql.IConnectionInfo): vscodeMssql.ConnectionDetails {
		throw new Error('Method not implemented.');
	}
	getServerInfo(_: vscodeMssql.IConnectionInfo): vscodeMssql.IServerInfo {
		throw new Error('Method not implemented.');
	}
}

export function createTestUtils(): TestUtils {
	return {
		vscodeMssqlIExtension: TypeMoq.Mock.ofType(MockVscodeMssqlIExtension)
	};
}

// Mock test data
export const mockConnectionInfo: vscodeMssql.IConnectionInfo = {
	server: 'Server',
	database: 'Database',
	user: 'User',
	password: 'Placeholder',
	email: 'test-email',
	accountId: 'test-account-id',
	tenantId: 'test-tenant-id',
	port: 1234,
	authenticationType: vscodeMssql.AuthenticationType.SqlLogin,
	azureAccountToken: '',
	expiresOn: 0,
	encrypt: false,
	trustServerCertificate: false,
	hostNameInCertificate: '',
	persistSecurityInfo: false,
	connectTimeout: 15,
	connectRetryCount: 0,
	connectRetryInterval: 0,
	applicationName: 'vscode-mssql',
	workstationId: 'test',
	applicationIntent: '',
	currentLanguage: '',
	pooling: true,
	maxPoolSize: 15,
	minPoolSize: 0,
	loadBalanceTimeout: 0,
	replication: false,
	attachDbFilename: '',
	failoverPartner: '',
	multiSubnetFailover: false,
	multipleActiveResultSets: false,
	packetSize: 8192,
	typeSystemVersion: 'Latest',
	connectionString: '',
	commandTimeout: undefined
};
