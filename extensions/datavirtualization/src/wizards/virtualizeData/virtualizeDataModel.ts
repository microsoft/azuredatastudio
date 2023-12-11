/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as utils from '../../utils';

import {
	DataSourceWizardConfigInfoResponse, DataSourceWizardService, VirtualizeDataInput,
	ProcessVirtualizeDataInputResponse,
	GenerateScriptResponse,
	GetDatabaseInfoResponse,
	DatabaseInfo,
	CredentialInfo,
	GetSourceDatabasesResponse,
	GetSourceTablesRequestParams,
	GetSourceTablesResponse,
	GetSourceColumnDefinitionsRequestParams,
	ColumnDefinition,
	ExecutionResult,
	DataSourceBrowsingParams,
	SchemaViews,
	DatabaseOverview
} from '../../services/contracts';
import { VDIManager } from './virtualizeDataInputManager';

// Stores important state and service methods used by the Virtualize Data wizard.
export class VirtualizeDataModel {

	private _configInfoResponse: DataSourceWizardConfigInfoResponse;
	private _databaseInfo: { [databaseName: string]: DatabaseInfo };

	constructor(
		private readonly _connection: azdata.connection.ConnectionProfile,
		private readonly _wizardService: DataSourceWizardService,
		private readonly _wizard: azdata.window.Wizard,
		private readonly _vdiManager: VDIManager) {
		this._databaseInfo = {};
	}

	public get connection(): azdata.connection.ConnectionProfile {
		return this._connection;
	}

	public get wizardService(): DataSourceWizardService {
		return this._wizardService;
	}

	public get wizard(): azdata.window.Wizard {
		return this._wizard;
	}

	public get configInfoResponse(): DataSourceWizardConfigInfoResponse {
		return this._configInfoResponse;
	}

	public get destDatabaseList(): DatabaseOverview[] {
		return this._configInfoResponse ? (this._configInfoResponse.databaseList || []) : [];
	}

	public get sessionId(): string {
		return this._configInfoResponse ? this._configInfoResponse.sessionId : undefined;
	}

	public get existingCredentials(): CredentialInfo[] {
		let currentDbInfo = this._databaseInfo[this.selectedDestDatabaseName];
		return currentDbInfo ? currentDbInfo.existingCredentials : undefined;
	}

	private get selectedDestDatabaseName(): string {
		return this._vdiManager.destinationDatabaseName;
	}

	public get defaultSchema(): string {
		let currentDbInfo = this._databaseInfo[this.selectedDestDatabaseName];
		return currentDbInfo ? currentDbInfo.defaultSchema : undefined;
	}

	public get schemaList(): string[] {
		let currentDbInfo = this._databaseInfo[this.selectedDestDatabaseName];
		return currentDbInfo ? currentDbInfo.schemaList : [];
	}

	public async hasMasterKey(): Promise<boolean> {
		let dbInfo = this._databaseInfo[this.selectedDestDatabaseName];
		if (!dbInfo) {
			await this.loadDatabaseInfo();
			dbInfo = this._databaseInfo[this.selectedDestDatabaseName];
		}
		return dbInfo.hasMasterKey;
	}

	public showWizardError(title: string, description?: string): void {
		this.showWizardMessage(title, description, azdata.window.MessageLevel.Error);
	}

	public showWizardInfo(title: string, description?: string): void {
		this.showWizardMessage(title, description, azdata.window.MessageLevel.Information);
	}

	public showWizardWarning(title: string, description?: string): void {
		this.showWizardMessage(title, description, azdata.window.MessageLevel.Warning);
	}

	public showWizardMessage(title: string, description: string, msgLevel: number): void {
		this._wizard.message = {
			text: title,
			level: msgLevel,
			description: description
		};
	}

	public async createSession(): Promise<void> {
		if (!this._configInfoResponse) {
			try {
				let credentials = await azdata.connection.getCredentials(this.connection.connectionId);
				if (credentials) {
					Object.assign(this.connection, credentials);
				}
			} catch (error) {
				// swallow this as either it was integrated auth or we will fail later with login failed,
				// which is a good error that makes sense to the user
			}

			try {
				const timeout = vscode.workspace.getConfiguration('mssql').get('query.executionTimeout');
				this.connection.options['QueryTimeout'] = timeout;
				this._configInfoResponse = await this.wizardService.createDataSourceWizardSession(this.connection);
			} catch (error) {
				this.showWizardError(utils.getErrorMessage(error));
				this._configInfoResponse = {
					sessionId: undefined,
					supportedSourceTypes: [],
					databaseList: [],
					serverMajorVersion: -1,
					productLevel: undefined
				};
			}
		}
	}

	public async validateInput(virtualizeDataInput: VirtualizeDataInput): Promise<boolean> {
		try {
			let response = await this._wizardService.validateVirtualizeDataInput(virtualizeDataInput);
			if (!response.isValid) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response.isValid;
		} catch (error) {
			this.showWizardError(utils.getErrorMessage(error));
			return false;
		}
	}

	public async getDatabaseInfo(databaseName: string): Promise<GetDatabaseInfoResponse> {
		try {
			let response = await this._wizardService.getDatabaseInfo({ sessionId: this.sessionId, databaseName: databaseName });
			if (!response.isSuccess) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response;
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			return { isSuccess: false, errorMessages: [eMessage], databaseInfo: undefined };
		}
	}

	public async loadDatabaseInfo(databaseName?: string): Promise<DatabaseInfo> {
		if (!databaseName) {
			databaseName = this.selectedDestDatabaseName;
		}
		let databaseInfo: DatabaseInfo = this._databaseInfo[databaseName];
		if (databaseInfo === undefined) {
			let response = await this.getDatabaseInfo(databaseName);
			if (response.isSuccess) {
				databaseInfo = response.databaseInfo;
				this._databaseInfo[databaseName] = databaseInfo;
			} else {
				this.showWizardError(response.errorMessages.join('\n'));
			}
		}
		return databaseInfo;
	}

	public async generateScript(virtualizeDataInput: VirtualizeDataInput): Promise<GenerateScriptResponse> {
		try {
			let response = await this._wizardService.generateScript(virtualizeDataInput);
			if (!response.isSuccess) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response;
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			return { isSuccess: false, errorMessages: [eMessage], script: undefined };
		}
	}

	public async processInput(virtualizeDataInput: VirtualizeDataInput): Promise<ProcessVirtualizeDataInputResponse> {
		try {
			let response = await this._wizardService.processVirtualizeDataInput(virtualizeDataInput);
			if (!response.isSuccess) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response;
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			return { isSuccess: false, errorMessages: [eMessage] };
		}
	}

	public async getSourceDatabases(virtualizeDataInput: VirtualizeDataInput): Promise<GetSourceDatabasesResponse> {
		try {
			let response = await this._wizardService.getSourceDatabases(virtualizeDataInput);
			if (!response.isSuccess) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response;
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			this.showWizardError(eMessage);
			return { isSuccess: false, errorMessages: [eMessage], databaseNames: undefined };
		}
	}

	public async getSourceTables(requestParams: GetSourceTablesRequestParams): Promise<GetSourceTablesResponse> {
		try {
			let response = await this._wizardService.getSourceTables(requestParams);
			if (!response.isSuccess) {
				this.showWizardError(response.errorMessages.join('\n'));
			}
			return response;
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			this.showWizardError(eMessage);
			return { isSuccess: false, errorMessages: [eMessage], schemaTablesList: undefined };
		}
	}

	public async getSourceViewList(requestParams: DataSourceBrowsingParams<string>): Promise<ExecutionResult<SchemaViews[]>> {
		let result: ExecutionResult<SchemaViews[]> = undefined;
		try {
			result = await this._wizardService.getSourceViewList(requestParams);
			if (!result.isSuccess) {
				this.showWizardError(result.errorMessages.join('\n'));
			}
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			this.showWizardError(eMessage);
			result = { isSuccess: false, errorMessages: [eMessage], returnValue: undefined };
		}
		return result;
	}

	public async getSourceColumnDefinitions(requestParams: GetSourceColumnDefinitionsRequestParams): Promise<ExecutionResult<ColumnDefinition[]>> {
		let result: ExecutionResult<ColumnDefinition[]> = undefined;
		try {
			let response = await this._wizardService.getSourceColumnDefinitions(requestParams);
			if (response && response.isSuccess) {
				result = { isSuccess: true, errorMessages: undefined, returnValue: response.columnDefinitions };
			} else {
				result = { isSuccess: false, errorMessages: response.errorMessages, returnValue: undefined };
			}
		} catch (error) {
			let eMessage = utils.getErrorMessage(error);
			result = { isSuccess: false, errorMessages: [eMessage], returnValue: undefined };
		}
		return result;
	}
}
