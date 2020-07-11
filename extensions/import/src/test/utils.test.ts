/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ImportDataModel, ColumnMetadata } from '../wizard/api/models';
import { FlatFileProvider, PROSEDiscoveryParams, InsertDataParams, GetColumnInfoParams, ChangeColumnSettingsParams, PROSEDiscoveryResponse, InsertDataResponse, ChangeColumnSettingsResponse, GetColumnInfoResponse } from '../services/contracts';
import * as fs from 'fs';

export class ImportTestUtils {

	public static getTestServer(): azdata.connection.Connection {
		return {
			providerName: 'MSSQL',
			connectionId: 'testConnection2Id',
			options: {}
		};
	}

	public static getTestConnectionProfile(): azdata.connection.ConnectionProfile {
		return {
			providerId: 'InvalidProvider',
			databaseName: 'databaseName',
			serverName: 'testServerName',
			connectionId: 'testConnectionId',
			groupId: 'testGroupId',
			connectionName: 'testConnectionName',
			userName: 'testUserName',
			password: 'testPassword',
			authenticationType: 'testAuthenticationType',
			savePassword: true,
			saveProfile: true,
			groupFullName: 'testGroupFullName',
			options: {}
		} as azdata.connection.ConnectionProfile;
	}

	public static async checkPathExists(path: string): Promise<boolean> {
		return fs.promises.access(path, fs.constants.F_OK)
			.then(() => true)
			.catch(() => false);
	}

	public static async getExtensionPath(): Promise<string> {
		return await vscode.extensions.getExtension('Microsoft.import').extensionPath;
	}

	public static async getTestExtensionContext(): Promise<TestExtensionContext> {
		let testContext = new TestExtensionContext();
		testContext.extensionPath = await vscode.extensions.getExtension('Microsoft.import').extensionPath;
		return testContext;
	}
}

export class TestQueryProvider implements azdata.QueryProvider {
	cancelQuery(ownerUri: string): Thenable<azdata.QueryCancelResult> {
		throw new Error('Method not implemented.');
	}
	runQuery(ownerUri: string, selection: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryStatement(ownerUri: string, line: number, column: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryString(ownerUri: string, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	runQueryAndReturn(ownerUri: string, queryString: string): Thenable<azdata.SimpleExecuteResult> {
		throw new Error('Method not implemented.');
	}
	parseSyntax(ownerUri: string, query: string): Thenable<azdata.SyntaxParseResult> {
		throw new Error('Method not implemented.');
	}
	getQueryRows(rowData: azdata.QueryExecuteSubsetParams): Thenable<azdata.QueryExecuteSubsetResult> {
		throw new Error('Method not implemented.');
	}
	disposeQuery(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	saveResults(requestParams: azdata.SaveResultsRequestParams): Thenable<azdata.SaveResultRequestResult> {
		throw new Error('Method not implemented.');
	}
	setQueryExecutionOptions(ownerUri: string, options: azdata.QueryExecutionOptions): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	registerOnQueryComplete(handler: (result: azdata.QueryExecuteCompleteNotificationResult) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnBatchStart(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnBatchComplete(handler: (batchInfo: azdata.QueryExecuteBatchNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnResultSetAvailable(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnResultSetUpdated(handler: (resultSetInfo: azdata.QueryExecuteResultSetNotificationParams) => any): void {
		throw new Error('Method not implemented.');
	}
	registerOnMessage(handler: (message: azdata.QueryExecuteMessageParams) => any): void {
		throw new Error('Method not implemented.');
	}
	commitEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	createRow(ownerUri: string): Thenable<azdata.EditCreateRowResult> {
		throw new Error('Method not implemented.');
	}
	deleteRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	disposeEdit(ownerUri: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	initializeEdit(ownerUri: string, schemaName: string, objectName: string, objectType: string, rowLimit: number, queryString: string): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	revertCell(ownerUri: string, rowId: number, columnId: number): Thenable<azdata.EditRevertCellResult> {
		throw new Error('Method not implemented.');
	}
	revertRow(ownerUri: string, rowId: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	updateCell(ownerUri: string, rowId: number, columnId: number, newValue: string): Thenable<azdata.EditUpdateCellResult> {
		throw new Error('Method not implemented.');
	}
	getEditRows(rowData: azdata.EditSubsetParams): Thenable<azdata.EditSubsetResult> {
		throw new Error('Method not implemented.');
	}
	registerOnEditSessionReady(handler: (ownerUri: string, success: boolean, message: string) => any): void {
		throw new Error('Method not implemented.');
	}
	handle?: number;
	providerId: string;

}

export class TestWizard implements azdata.window.Wizard {
	title: string;
	pages: azdata.window.WizardPage[];
	currentPage: number;
	doneButton: azdata.window.Button;
	cancelButton: azdata.window.Button;
	generateScriptButton: azdata.window.Button = azdata.window.createButton('testButton');
	nextButton: azdata.window.Button;
	backButton: azdata.window.Button;
	customButtons: azdata.window.Button[];
	displayPageTitles: boolean;
	onPageChanged: vscode.Event<azdata.window.WizardPageChangeInfo> = new vscode.EventEmitter<any>().event;
	addPage(page: azdata.window.WizardPage, index?: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	removePage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	setCurrentPage(index: number): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	open(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	close(): Thenable<void> {
		throw new Error('Method not implemented.');
	}
	registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		throw new Error('Method not implemented.');
	}
	message: azdata.window.DialogMessage;
	registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		throw new Error('Method not implemented.');
	}

}

export class TestWizardPage implements azdata.window.WizardPage {
	title: string;
	content: string;
	customButtons: azdata.window.Button[];
	enabled: boolean;
	description: string;
	registerContent(handler: (view: azdata.ModelView) => Thenable<void>): void {
		throw new Error('Method not implemented.');
	}
	modelView: azdata.ModelView;
	valid: boolean;
	onValidityChanged: vscode.Event<boolean>;

}

export class TestButton implements azdata.window.Button {
	label: string;
	enabled: boolean;
	hidden: boolean;
	focused?: boolean;
	constructor(private onClickEmitter: vscode.EventEmitter<void>) {
	}
	onClick: vscode.Event<void> = this.onClickEmitter.event;
	position?: azdata.window.DialogButtonPosition;
}

export class TestExtensionContext implements vscode.ExtensionContext {
	extensionMode: vscode.ExtensionMode;
	subscriptions: { dispose(): any; }[];
	workspaceState: vscode.Memento;
	globalState: vscode.Memento;
	extensionUri: vscode.Uri;
	extensionPath: string;
	environmentVariableCollection: vscode.EnvironmentVariableCollection;
	asAbsolutePath(relativePath: string): string {
		throw new Error('Method not implemented.');
	}
	storagePath: string;
	globalStoragePath: string;
	logPath: string;
}

export class TestImportDataModel implements ImportDataModel {
	server: azdata.connection.Connection;
	serverId: string;
	ownerUri: string;
	proseColumns: ColumnMetadata[];
	proseDataPreview: string[][];
	database: string;
	table: string;
	schema: string;
	filePath: string;
	fileType: string;
}

export class TestFlatFileProvider implements FlatFileProvider {
	providerId?: string;
	sendPROSEDiscoveryRequest(params: PROSEDiscoveryParams): Thenable<PROSEDiscoveryResponse> {
		throw new Error('Method not implemented.');
	}
	sendInsertDataRequest(params: InsertDataParams): Thenable<InsertDataResponse> {
		throw new Error('Method not implemented.');
	}
	sendGetColumnInfoRequest(params: GetColumnInfoParams): Thenable<GetColumnInfoResponse> {
		throw new Error('Method not implemented.');
	}
	sendChangeColumnSettingsRequest(params: ChangeColumnSettingsParams): Thenable<ChangeColumnSettingsResponse> {
		throw new Error('Method not implemented.');
	}

}
