/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IColumn, ICellValue, ResultSetSubset } from 'sql/workbench/services/query/common/query';
import * as Utils from 'sql/platform/connection/common/utils';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { resolveQueryFilePath } from '../common/insightsUtils';

import Severity from 'vs/base/common/severity';
import * as types from 'vs/base/common/types';
import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IInsightsDialogModel } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { IInsightsConfigDetails } from 'sql/platform/dashboard/browser/insightRegistry';

export class InsightsDialogController {
	private _queryRunner: QueryRunner;
	private _connectionProfile: IConnectionProfile;
	private _connectionUri: string;
	private _columns: IColumn[];
	private _rows: ICellValue[][];

	constructor(
		private readonly _model: IInsightsDialogModel,
		@INotificationService private readonly _notificationService: INotificationService,
		@IErrorMessageService private readonly _errorMessageService: IErrorMessageService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IConnectionManagementService private readonly _connectionManagementService: IConnectionManagementService,
		@ILogService private readonly logService: ILogService,
		@IFileService private readonly fileService: IFileService
	) { }

	public async update(input: IInsightsConfigDetails, connectionProfile: IConnectionProfile): Promise<void> {
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
				let fileUri: URI;
				try {
					fileUri = await this._instantiationService.invokeFunction(resolveQueryFilePath, input.queryFile);
				}
				catch (e) {
					this._notificationService.notify({
						severity: Severity.Error,
						message: e
					});
					return Promise.resolve();
				}

				try {
					let buffer = await this.fileService.readFile(fileUri);
					this.createQuery(buffer.value.toString(), connectionProfile).catch(e => {
						this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), e);
					});
				}
				catch (e) {
					this._notificationService.notify({
						severity: Severity.Error,
						message: nls.localize("insightsFileError", "There was an error reading the query file: ") + e
					});
				}
			} else {
				this.logService.error('Error reading details Query: ', input);
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
		queryRunner.onQueryEnd(() => {
			this.queryComplete().catch(error => {
				this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), error);
			});
		});
		queryRunner.onMessage(messages => {
			const errorMessage = messages.find(m => m.isError);
			if (errorMessage) {
				this._errorMessageService.showDialog(Severity.Error, nls.localize("insightsError", "Insights error"), errorMessage.message);
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
				let rows: ResultSetSubset;
				try {
					rows = await this._queryRunner.getQueryRows(0, resultset.rowCount, batch.id, resultset.id);
				} catch (e) {
					return Promise.reject(e);
				}
				this._rows = rows.rows;
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
