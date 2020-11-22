/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { SKURecommendations } from './externalContract';

export enum State {
	INIT,
	COLLECTING_SOURCE_INFO,
	COLLECTION_SOURCE_INFO_ERROR,
	TARGET_SELECTION,
	TARGET_SELECTION_ERROR,
	AZURE_SERVER_SELECTION,
	AZURE_SERVER_SELECTION_ERROR,
	AZURE_DB_BACKUP,
	AZURE_DB_BACKUP_ERROR,
	MIGRATION_AGENT_CREATION,
	MIGRATION_AGENT_SELECTION,
	MIGRATION_AGENT_ERROR,
	MIGRATION_START,
	NO_AZURE_SERVER,
	EXIT,
}

export enum MigrationCutover {
	MANUAL,
	AUTOMATIC
}

export enum NetworkContainerType {
	FILE_SHARE,
	BLOB_CONTAINER,
	NETWORK_SHARE
}

export interface NetworkShare {
	networkShareLocation: string;
	windowsUser: string;
	password: string;
	storageSubscriptionId: string;
	storageAccountId: string;
}

export interface BlobContainer {
	subscriptionId: string;
	storageAccountId: string;
	containerId: string;
}

export interface FileShare {
	subscriptionId: string;
	storageAccountId: string;
	fileShareId: string;
}
export interface DatabaseBackupModel {
	emailNotification: boolean;
	migrationCutover: MigrationCutover;
	networkContainerType: NetworkContainerType;
	networkContainer: NetworkShare | BlobContainer | FileShare;
}
export interface Model {
	readonly sourceConnection: azdata.connection.Connection;
	readonly currentState: State;
	gatheringInformationError: string | undefined;
	skuRecommendations: SKURecommendations | undefined;
	azureAccount: azdata.Account | undefined;
	databaseBackup: DatabaseBackupModel | undefined;
}

export interface StateChangeEvent {
	oldState: State;
	newState: State;
}

export class MigrationStateModel implements Model, vscode.Disposable {
	private _stateChangeEventEmitter = new vscode.EventEmitter<StateChangeEvent>();
	private _currentState: State;
	private _gatheringInformationError: string | undefined;
	private _skuRecommendations: SKURecommendations | undefined;
	private _assessmentResults: mssql.SqlMigrationAssessmentResultItem[] | undefined;
	private _azureAccount: azdata.Account | undefined;
	private _databaseBackup: DatabaseBackupModel | undefined;

	constructor(
		private readonly _extensionContext: vscode.ExtensionContext,
		private readonly _sourceConnection: azdata.connection.Connection,
		public readonly migrationService: mssql.ISqlMigrationService
	) {
		this._currentState = State.INIT;
	}

	public get azureAccount(): azdata.Account | undefined {
		return this._azureAccount;
	}

	public set azureAccount(account: azdata.Account | undefined) {
		this._azureAccount = account;
	}

	public get databaseBackup(): DatabaseBackupModel | undefined {
		return this._databaseBackup;
	}

	public set databaseBackup(dbBackup: DatabaseBackupModel | undefined) {
		this._databaseBackup = dbBackup;
	}

	public get sourceConnection(): azdata.connection.Connection {
		return this._sourceConnection;
	}

	public get currentState(): State {
		return this._currentState;
	}

	public set currentState(newState: State) {
		const oldState = this.currentState;

		this._currentState = newState;

		this._stateChangeEventEmitter.fire({ oldState, newState: this.currentState });
	}

	public get assessmentResults(): mssql.SqlMigrationAssessmentResultItem[] | undefined {
		return this._assessmentResults;
	}

	public set assessmentResults(assessmentResults: mssql.SqlMigrationAssessmentResultItem[] | undefined) {
		this._assessmentResults = assessmentResults;
	}

	public get gatheringInformationError(): string | undefined {
		return this._gatheringInformationError;
	}

	public set gatheringInformationError(error: string | undefined) {
		this._gatheringInformationError = error;
	}

	public get skuRecommendations(): SKURecommendations | undefined {
		return this._skuRecommendations;
	}

	public set skuRecommendations(recommendations: SKURecommendations | undefined) {
		this._skuRecommendations = recommendations;
	}

	public get stateChangeEvent(): vscode.Event<StateChangeEvent> {
		return this._stateChangeEventEmitter.event;
	}

	dispose() {
		this._stateChangeEventEmitter.dispose();
	}

	public getExtensionPath(): string {
		return this._extensionContext.extensionPath;
	}
}
