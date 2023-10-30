/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as azdata from 'azdata';
import { createHistoryFileName, readHistoryFileNames, getAssessmentDate, TargetWithChildren } from './utils';
import { promises as fs } from 'fs';
import { TelemetryReporter, SqlAssessmentTelemetryView, SqlTelemetryActions } from './telemetry';

export enum AssessmentType {
	AvailableRules = 1,
	InvokeAssessment = 2
}

export type OnResultCallback = (result: azdata.SqlAssessmentResult, assessmentType: AssessmentType, append: boolean) => void;

export interface SqlAssessmentRecord {
	result: azdata.SqlAssessmentResult;
	dateUpdated: number;
}


interface SqlAssessmentResultInfo extends SqlAssessmentRecord {
	connectionInfo: azdata.connection.ConnectionProfile
}


export class AssessmentEngine {
	private sqlAssessment!: mssql.ISqlAssessmentService;
	private connectionUri: string = '';
	private connectionProfile!: azdata.connection.ConnectionProfile;
	private lastInvokedResults!: SqlAssessmentResultInfo;
	private historicalRecords!: SqlAssessmentRecord[] | undefined;


	constructor(service: mssql.ISqlAssessmentService) {
		this.sqlAssessment = service;
	}

	public get isServerConnection(): boolean {
		return !this.connectionProfile.databaseName || this.connectionProfile.databaseName === 'master';
	}
	public get databaseName(): string {
		return this.connectionProfile.databaseName;
	}
	public get recentResult(): SqlAssessmentResultInfo {
		return this.lastInvokedResults;
	}
	public get targetName(): string {
		return this.isServerConnection ? this.connectionProfile.serverName : this.connectionProfile.databaseName;
	}


	public async initialize(connectionId: string) {
		this.connectionUri = await azdata.connection.getUriForConnection(connectionId);
		this.connectionProfile = await azdata.connection.getCurrentConnection();
		this.historicalRecords = undefined;
	}

	public async performAssessment(asmtType: AssessmentType, onResult: OnResultCallback): Promise<void> {
		if (this.isServerConnection) {
			await this.performServerAssessment(asmtType, onResult);
		} else {
			if (asmtType === AssessmentType.AvailableRules) {
				TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.GetDatabaseAssessmentRules);
				onResult(await this.sqlAssessment.getAssessmentItems(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Database), asmtType, false);
			} else {
				TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.InvokeDatabaseAssessment);
				const result = await this.sqlAssessment.assessmentInvoke(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Database);

				this.lastInvokedResults = {
					connectionInfo: this.connectionProfile,
					dateUpdated: Date.now(),
					result: result
				};

				onResult(result, asmtType, false);

				this.saveAssessment(this.databaseName, result);
			}
		}

		if (asmtType === AssessmentType.InvokeAssessment && this.historicalRecords !== undefined) {
			this.historicalRecords.push({
				result: this.lastInvokedResults.result,
				dateUpdated: this.lastInvokedResults.dateUpdated
			});
		}
	}

	public generateAssessmentScript(): Promise<azdata.ResultStatus> {
		TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.ExportAssessmentResults);
		return this.sqlAssessment.generateAssessmentScript(this.lastInvokedResults.result.items, '', '', azdata.TaskExecutionMode.script);
	}

	public async readHistory(): Promise<SqlAssessmentRecord[]> {
		if (this.historicalRecords === undefined) {
			await this.loadHistory();
		}

		return this.historicalRecords ?? [];
	}

	private async loadHistory(): Promise<void> {
		this.historicalRecords = [];
		const files: TargetWithChildren[] = await readHistoryFileNames(this.targetName);

		for (let nFileName = 0; nFileName < files.length; nFileName++) {
			const file: TargetWithChildren = files[nFileName];
			const content: string = await fs.readFile(file.target, 'utf8');
			const result: azdata.SqlAssessmentResult = JSON.parse(content);

			if (this.isServerConnection) {
				for (let nChild = 0; nChild < file.children.length; nChild++) {
					const childResult: azdata.SqlAssessmentResult = JSON.parse(await fs.readFile(file.children[nChild], 'utf8'));
					result.items.push(...childResult.items);
				}
			}

			const date = getAssessmentDate(file.target);

			this.historicalRecords.push({
				dateUpdated: date,
				result: result
			});
		}
	}

	private async performServerAssessment(asmtType: AssessmentType, onResult: OnResultCallback): Promise<void> {
		let databaseListRequest = azdata.connection.listDatabases(this.connectionProfile.connectionId);

		let assessmentResult: azdata.SqlAssessmentResult;
		if (asmtType === AssessmentType.InvokeAssessment) {
			TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.InvokeServerAssessment);
			assessmentResult = await this.sqlAssessment.assessmentInvoke(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Server);

			this.lastInvokedResults = {
				connectionInfo: this.connectionProfile,
				dateUpdated: Date.now(),
				result: assessmentResult
			};
			this.saveAssessment(this.connectionProfile.serverName, assessmentResult);
		} else {
			TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.GetServerAssessmentRules);
			assessmentResult = await this.sqlAssessment.getAssessmentItems(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Server);
		}

		onResult(assessmentResult, asmtType, false);

		let connectionProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(
			this.connectionProfile.providerId, azdata.DataProviderType.ConnectionProvider);

		const dbList = await databaseListRequest;

		for (let nDbName = 0; nDbName < dbList.length; nDbName++) {
			const db = dbList[nDbName];

			if (await connectionProvider.changeDatabase(this.connectionUri, db)) {
				let assessmentResult = asmtType === AssessmentType.InvokeAssessment
					? await this.sqlAssessment.assessmentInvoke(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Database)
					: await this.sqlAssessment.getAssessmentItems(this.connectionUri, azdata.sqlAssessment.SqlAssessmentTargetType.Database);

				if (assessmentResult?.items) {
					if (asmtType === AssessmentType.InvokeAssessment) {
						this.lastInvokedResults.result.items.push(...assessmentResult?.items);
						this.saveAssessment(db, assessmentResult);
					}
					onResult(assessmentResult, asmtType, true);
				}
			}
		}
	}

	private async saveAssessment(target: string, assessment: azdata.SqlAssessmentResult): Promise<void> {
		try {
			const fileName = await createHistoryFileName(target, this.lastInvokedResults.dateUpdated);
			return fs.writeFile(fileName, JSON.stringify(assessment));
		}
		catch (err) {
			console.error(`error saving sql assessment history file: ${err}`);
		}
	}
}
