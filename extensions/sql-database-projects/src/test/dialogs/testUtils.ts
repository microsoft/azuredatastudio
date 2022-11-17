/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
//import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import { RequestType } from 'vscode-languageclient';
import { azdata } from '@microsoft/azdata-test/out/mocks';
//import { AzureFunctionsExtensionApi } from '../../../types/vscode-azurefunctions.api';

export interface TestUtils {
	//context: vscode.ExtensionContext;
	//dacFxService: TypeMoq.IMock<mssql.IDacFxService>;
	//outputChannel: vscode.OutputChannel;
	vscodeMssqlIExtension: TypeMoq.IMock<vscodeMssql.IExtension>;
	quickPick: TypeMoq.IMock<vscode.QuickPick<any>>
	//dacFxMssqlService: TypeMoq.IMock<vscodeMssql.IDacFxService>;
	//schemaCompareService: TypeMoq.IMock<vscodeMssql.ISchemaCompareService>;
	//azureFunctionsExtensionApi: TypeMoq.IMock<AzureFunctionsExtensionApi>;
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
	getServerInfo(_: vscodeMssql.IConnectionInfo): vscodeMssql.ServerInfo {
		throw new Error('Method not implemented.');
	}
}

export function createTestUtils(): TestUtils {
	// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
	//const azureFunctionsExtensionApi = TypeMoq.Mock.ofType<AzureFunctionsExtensionApi>();
	//azureFunctionsExtensionApi.setup((x: any) => x.then).returns(() => undefined);
	return {
		//context: TypeMoq.Mock.ofType<vscode.ExtensionContext>().object,
		//dacFxService: TypeMoq.Mock.ofType<mssql.IDacFxService>(),
		vscodeMssqlIExtension: TypeMoq.Mock.ofType(MockVscodeMssqlIExtension),
		quickPick: TypeMoq.Mock.ofType(MockQuickPick)
		//dacFxMssqlService: TypeMoq.Mock.ofType<vscodeMssql.IDacFxService>(),
		//schemaCompareService: TypeMoq.Mock.ofType<vscodeMssql.ISchemaCompareService>(),
		//outputChannel: TypeMoq.Mock.ofType<vscode.OutputChannel>().object//,
		//azureFunctionsExtensionApi
	};
}

// Mock test data
export const mockConnectionInfo: vscodeMssql.IConnectionInfo = {
	server: 'Server',
	database: 'Database',
	user: 'User',
	password: 'Pwd',
	email: 'test-email',
	accountId: 'test-account-id',
	tenantId: 'test-tenant-id',
	port: 1234,
	authenticationType: vscodeMssql.AuthenticationType.SqlLogin,
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

let MockType: any;

export interface QuickPickTestContext {
	quickpick: vscode.QuickPick<typeof MockType>;
	onDidChangeSelection: vscode.EventEmitter<any>;
	onDidHide: vscode.EventEmitter<any>;
	onDidChangeValue: vscode.EventEmitter<any>;
	onDidAccept: vscode.EventEmitter<any>;
	onDidTriggerButton: vscode.EventEmitter<any>;
	onDidTriggerItemButton: vscode.EventEmitter<any>;
	onDidChangeActive: vscode.EventEmitter<any>
}

export function createQuickPickContext(): QuickPickTestContext {
	let onDidChangeSelection: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidHide: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidChangeValue: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidAccept: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidTriggerButton: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidTriggerItemButton: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
	let onDidChangeActive: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	let quickPick: vscode.QuickPick<typeof MockType> = {
		onDidChangeSelection: onDidChangeSelection.event,
		onDidHide: onDidHide.event,

		value: '',
		placeholder: undefined,
		buttons: undefined,//new vscode.QuickInputButtons(),
		items: undefined,
		canSelectMany: false,
		matchOnDescription: false,
		matchOnDetail: false,
		keepScrollPosition: undefined,
		activeItems: undefined,
		selectedItems: undefined,
		title: undefined,
		step: undefined,
		totalSteps: undefined,
		enabled: false,
		busy: false,
		ignoreFocusOut: false,

		onDidChangeValue: onDidChangeValue.event,
		onDidAccept: onDidAccept.event,
		onDidTriggerButton: onDidTriggerButton.event,
		onDidTriggerItemButton: onDidTriggerItemButton.event,
		onDidChangeActive: onDidChangeActive.event,

		show(): void {
			throw new Error('Method not implemented.');
		},
		hide(): void {
			throw new Error('Method not implemented.');
		},
		dispose(): void {
			throw new Error('Method not implemented.');
		}
	};

	return {
		quickpick: quickPick,
		onDidChangeSelection: onDidChangeSelection,
		onDidHide: onDidHide,
		onDidChangeValue: onDidChangeValue,
		onDidAccept: onDidAccept,
		onDidTriggerButton: onDidTriggerButton,
		onDidTriggerItemButton: onDidTriggerItemButton,
		onDidChangeActive: onDidChangeActive
	};
}

export class MockQuickPick implements vscode.QuickPick<typeof MockType> {
	value: string = '';
	placeholder: string | undefined;
	buttons: readonly vscode.QuickInputButton[];
	items: readonly typeof MockType[];
	canSelectMany: boolean;
	matchOnDescription: boolean;
	matchOnDetail: boolean;
	keepScrollPosition?: boolean;
	activeItems: readonly typeof MockType[];
	selectedItems: readonly typeof MockType[];

	title: string | undefined;
	step: number | undefined;
	totalSteps: number | undefined;
	enabled: boolean;
	busy: boolean;
	ignoreFocusOut: boolean;

	readonly onDidChangeValue!: vscode.Event<string>;
	readonly onDidAccept!: vscode.Event<void>;
	readonly onDidTriggerButton!: vscode.Event<vscode.QuickInputButton>;
	readonly onDidTriggerItemButton!: vscode.Event<vscode.QuickPickItemButtonEvent<typeof MockType>>;
	readonly onDidChangeActive!: vscode.Event<readonly typeof MockType[]>;
	readonly onDidChangeSelection!: vscode.Event<readonly typeof MockType[]>;
	onDidHide!: vscode.Event<void>;

	constructor() {
		this.buttons = [];
		this.items = [];
		this.canSelectMany = false;
		this.matchOnDescription = false;
		this.matchOnDetail = false;
		this.activeItems = [];
		this.selectedItems = [];

		this.enabled = false;
		this.busy = false;
		this.ignoreFocusOut = false;
	}

	show(): void {
		throw new Error('Method not implemented.');
	}
	hide(): void {
		throw new Error('Method not implemented.');
	}
	dispose(): void {
		throw new Error('Method not implemented.');
	}

	promptForFirewallRule(_: string, __: vscodeMssql.IConnectionInfo): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
}
