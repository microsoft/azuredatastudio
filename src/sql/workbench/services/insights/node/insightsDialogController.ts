/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IInsightsConfigDetails } from 'sql/parts/dashboard/widgets/insights/interfaces';
import QueryRunner, { EventType as QREvents } from 'sql/platform/query/common/queryRunner';
import * as Utils from 'sql/platform/connection/common/utils';
import { IInsightsDialogModel, insertValueRegex } from 'sql/workbench/services/insights/common/insightsDialogService';
import { error } from 'sql/base/common/log';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';

import { DbCellValue, IDbColumn, QueryExecuteSubsetResult } from 'sqlops';

import Severity from 'vs/base/common/severity';
import * as types from 'vs/base/common/types';
import * as pfs from 'vs/base/node/pfs';
import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { INotificationService } from 'vs/platform/notification/common/notification';

export class InsightsDialogController {
	private _queryRunner: QueryRunner;
	private _connectionProfile: IConnectionProfile;
	private _connectionUri: string;
	private _columns: IDbColumn[];
	private _rows: DbCellValue[][];

	constructor(
		private _model: IInsightsDialogModel,
		@INotificationService private _notificationService: INotificationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IWorkspaceContextService private _workspaceContextService: IWorkspaceContextService
	) { }

	public update(input: IInsightsConfigDetails, connectionProfile: IConnectionProfile): Thenable<void> {
		// execute string
		if (typeof input === 'object') {
			if (connectionProfile === undefined) {
				this._notificationService.notify({
					severity: Severity.Error,
					message: nls.localize("insightsInputError", "No Connection Profile was passed to insights flyout")
				});
				return Promise.resolve();
			}
			if (types.isStringArray(input.query)) {
				return this.createQuery(input.query.join(' '), connectionProfile).catch(e => {
					this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), e);
				}).then(() => undefined);
			} else if (types.isString(input.query)) {
				return this.createQuery(input.query, connectionProfile).catch(e => {
					this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), e);
				}).then(() => undefined);
			} else if (types.isString(input.queryFile)) {
				let filePath = input.queryFile;
				// check for workspace relative path
				let match = filePath.match(insertValueRegex);
				if (match && match.length > 0 && match[1] === 'workspaceRoot') {
					filePath = filePath.replace(match[0], '');

					switch (this._workspaceContextService.getWorkbenchState()) {
						case WorkbenchState.FOLDER:
							filePath = this._workspaceContextService.getWorkspace().folders[0].toResource(filePath).fsPath;
							break;
						case WorkbenchState.WORKSPACE:
							let filePathArray = filePath.split('/');
							// filter out empty sections
							filePathArray = filePathArray.filter(i => !!i);
							let folder = this._workspaceContextService.getWorkspace().folders.find(i => i.name === filePathArray[0]);
							if (!folder) {
								return Promise.reject(new Error(`Could not find workspace folder ${filePathArray[0]}`));
							}
							// remove the folder name from the filepath
							filePathArray.shift();
							// rejoin the filepath after doing the work to find the right folder
							filePath = '/' + filePathArray.join('/');
							filePath = folder.toResource(filePath).fsPath;
							break;
					}

				}
				return new Promise((resolve, reject) => {
					pfs.readFile(filePath).then(
						buffer => {
							this.createQuery(buffer.toString(), connectionProfile).catch(e => {
								this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), e);
							}).then(() => resolve());
						},
						error => {
							this._notificationService.notify({
								severity: Severity.Error,
								message: nls.localize("insightsFileError", "There was an error reading the query file: ") + error
							});
							resolve();
						}
					);
				});
			} else {
				error('Error reading details Query: ', input);
				this._notificationService.notify({
					severity: Severity.Error,
					message: nls.localize("insightsConfigError", "There was an error parsing the insight config; could not find query array/string or queryfile")
				});
				return Promise.resolve();
			}
		}

		return Promise.resolve();
	}

	private async createQuery(queryString: string, connectionProfile: IConnectionProfile): Promise<void> {
		if (this._queryRunner) {
			if (!this._queryRunner.hasCompleted) {
				await this._queryRunner.cancelQuery();
			}
			try {
				await this.createNewConnection(connectionProfile);
			} catch (e) {
				return Promise.reject(e);
			}
			this._queryRunner.uri = this._connectionUri;
		} else {
			try {
				await this.createNewConnection(connectionProfile);
			} catch (e) {
				return Promise.reject(e);
			}
			this._queryRunner = this._instantiationService.createInstance(QueryRunner, this._connectionUri);
			this.addQueryEventListeners(this._queryRunner);
		}

		return this._queryRunner.runQuery(queryString);
	}

	private async createNewConnection(connectionProfile: IConnectionProfile): Promise<void> {
		// determine if we need to create a new connection
		if (!this._connectionProfile || connectionProfile.getOptionsKey() !== this._connectionProfile.getOptionsKey()) {
			if (this._connectionProfile) {
				try {
					await this._connectionManagementService.disconnect(this._connectionUri);
				} catch (e) {
					return Promise.reject(e);
				}
			}
			this._connectionProfile = connectionProfile;
			this._connectionUri = Utils.generateUri(this._connectionProfile, 'insights');
			return this._connectionManagementService.connect(this._connectionProfile, this._connectionUri).then(result => undefined);
		}
	}

	private addQueryEventListeners(queryRunner: QueryRunner): void {
		queryRunner.addListener(QREvents.COMPLETE, () => {
			this.queryComplete().catch(error => {
				this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), error);
			});
		});
		queryRunner.addListener(QREvents.MESSAGE, message => {
			if (message.isError) {
				this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), message.message);
			}
		});
	}

	private async queryComplete(): Promise<void> {
		let batches = this._queryRunner.batchSets;
		// currently only support 1 batch set 1 resultset
		if (batches.length > 0) {
			let batch = batches[0];
			if (batch.resultSetSummaries.length > 0
				&& batch.resultSetSummaries[0].rowCount > 0
			) {
				let resultset = batch.resultSetSummaries[0];
				this._columns = resultset.columnInfo;
				let rows: QueryExecuteSubsetResult;
				try {
					rows = await this._queryRunner.getQueryRows(0, resultset.rowCount, batch.id, resultset.id);
				} catch (e) {
					return Promise.reject(e);
				}
				this._rows = rows.resultSubset.rows;
				this.updateModel();
			}
		}
		// TODO issue #2746 should ideally show a warning inside the dialog if have no data
	}

	private updateModel(): void {
		let data = this._rows.map(r => r.map(c => c.displayValue));
		let columns = this._columns.map(c => c.columnName);

		this._model.rows = data;
		this._model.columns = columns;
	}
}
