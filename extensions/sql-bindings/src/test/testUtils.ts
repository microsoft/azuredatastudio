/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import { RequestType } from 'vscode-languageclient';
import { AzureFunctionsExtensionApi } from '../../../types/vscode-azurefunctions.api';

export interface TestUtils {
	context: vscode.ExtensionContext;
	dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
	outputChannel: vscode.OutputChannel;
	vscodeMssqlIExtension: TypeMoq.IMock<vscodeMssql.IExtension>;
	dacFxMssqlService: TypeMoq.IMock<vscodeMssql.IDacFxService>;
	schemaCompareService: TypeMoq.IMock<vscodeMssql.ISchemaCompareService>;
	azureFunctionsExtensionApi: TypeMoq.IMock<AzureFunctionsExtensionApi>;
}

export class MockVscodeMssqlIExtension implements vscodeMssql.IExtension {
	sqlToolsServicePath: string = '';
	dacFx: vscodeMssql.IDacFxService;
	schemaCompare: vscodeMssql.ISchemaCompareService;
	azureAccountService: vscodeMssql.IAzureAccountService;
	azureResourceService: vscodeMssql.IAzureResourceService;

	constructor() {
		this.dacFx = TypeMoq.Mock.ofType<vscodeMssql.IDacFxService>().object;
		this.schemaCompare = TypeMoq.Mock.ofType<vscodeMssql.ISchemaCompareService>().object;
		this.azureAccountService = TypeMoq.Mock.ofType<vscodeMssql.IAzureAccountService>().object;
		this.azureResourceService = TypeMoq.Mock.ofType<vscodeMssql.IAzureResourceService>().object;
	}

	promptForFirewallRule(_: string, __: vscodeMssql.IConnectionInfo): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	sendRequest<P, R, E, R0>(_: RequestType<P, R, E, R0>, __?: P): Promise<R> {
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
}

export function createTestUtils(): TestUtils {
	// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
	const azureFunctionsExtensionApi = TypeMoq.Mock.ofType<AzureFunctionsExtensionApi>();
	azureFunctionsExtensionApi.setup((x: any) => x.then).returns(() => undefined);
	return {
		context: TypeMoq.Mock.ofType<vscode.ExtensionContext>().object,
		dacFxService: TypeMoq.Mock.ofType<mssql.IDacFxService>(),
		vscodeMssqlIExtension: TypeMoq.Mock.ofType(MockVscodeMssqlIExtension),
		dacFxMssqlService: TypeMoq.Mock.ofType<vscodeMssql.IDacFxService>(),
		schemaCompareService: TypeMoq.Mock.ofType<vscodeMssql.ISchemaCompareService>(),
		outputChannel: TypeMoq.Mock.ofType<vscode.OutputChannel>().object,
		azureFunctionsExtensionApi
	};
}

export function createTestCredentials(): vscodeMssql.IConnectionInfo {
	const creds: vscodeMssql.IConnectionInfo = {
		server: 'my-server',
		database: 'my_db',
		user: 'sa',
		password: '12345678',
		email: 'test-email',
		accountId: 'test-account-id',
		tenantId: 'test-tenant-id',
		port: 1234,
		authenticationType: 'SqlLogin',
		azureAccountToken: '',
		expiresOn: 0,
		encrypt: false,
		trustServerCertificate: false,
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
		connectionString: ''
	};
	return creds;
}

/**
 * Create SQL server table node used for testing
 * @param connectionInfo the connection info used for the test case
 * @returns SQL Server table node
 */
export function createTestTableNode(connectionInfo: vscodeMssql.IConnectionInfo): vscodeMssql.ITreeNodeInfo {
	return {
		connectionInfo: connectionInfo,
		nodeType: 'Table',
		metadata: {
			metadataType: 0,
			metadataTypeName: 'Table',
			urn: '',
			name: 'testTable',
			schema: 'testSchema',
		},
		parentNode: {
			connectionInfo: connectionInfo,
			nodeType: 'Folder',
			metadata: null!,
			parentNode: {
				connectionInfo: connectionInfo,
				nodeType: 'Database',
				metadata: {
					metadataType: 0,
					metadataTypeName: 'Database',
					urn: '',
					name: 'testDb',
					schema: null!,
				},
				parentNode: undefined! // set to undefined since we do not need further parent node
			}
		}
	};
}
