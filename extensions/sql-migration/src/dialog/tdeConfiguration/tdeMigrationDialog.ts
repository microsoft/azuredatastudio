/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { logError, TelemetryErrorName, TelemetryViews } from '../../telemtery';
import { EOL } from 'os';
import { MigrationStateModel, OperationResult } from '../../models/stateMachine';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { TdeMigrationState, TdeMigrationResult, TdeMigrationDbState, TdeDatabaseMigrationState, TdeMigrationDbResult } from '../../models/tdeModels';

const DialogName = 'TdeMigrationDialog';

export enum TdeValidationResultIndex {
	name = 0,
	icon = 1,
	status = 2,
	errors = 3,
	state = 4,
	updated = 5
}

export const ValidationStatusLookup: constants.LookupTable<string | undefined> = {
	[TdeMigrationState.Canceled]: constants.STATE_CANCELED,
	[TdeMigrationState.Failed]: constants.STATE_FAILED,
	[TdeMigrationState.Pending]: constants.STATE_PENDING,
	[TdeMigrationState.Running]: constants.STATE_RUNNING,
	[TdeMigrationState.Succeeded]: constants.STATE_SUCCEEDED,
	default: undefined
};


export class TdeMigrationDialog {

	//private _canceled: boolean = true;
	private _dialog: azdata.window.Dialog | undefined;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model!: MigrationStateModel;
	private _resultsTable!: azdata.TableComponent;
	private _startMigrationLoader!: azdata.LoadingComponent;
	private _retryMigrationButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _headingText!: azdata.TextComponent;
	private _progressReportText!: azdata.TextComponent;
	private _validationResult: any[][] = [];
	private _dbRowsMap: Map<string, number> = new Map<string, number>();
	private _tdeMigrationResult: TdeMigrationResult = {
		state: TdeMigrationState.Pending,
		dbList: []
	};
	private _valdiationErrors: string[] = [];
	private _completedDatabasesCount: number = 0;

	constructor(
		model: MigrationStateModel) {
		this._model = model;
	}

	public async openDialog(): Promise<void> {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				constants.TDE_MIGRATEDIALOG_TITLE,
				DialogName,
				600);

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;

			await this._loadMigrationResults();

			// This will prevent that it tryes to auto run when the last execution was successful, fails don't get persisted on the ui, only reported in the events.
			if (this._tdeMigrationResult.state === TdeMigrationState.Pending) {
				await this._runTdeMigration();
			}
		}
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					dialog.okButton.label = constants.TDE_MIGRATE_DONE_BUTTON;
					dialog.okButton.position = 'left';
					dialog.okButton.enabled = false;
					dialog.cancelButton.position = 'left';

					this._headingText = view.modelBuilder.text()
						.withProps({
							value: constants.TDE_MIGRATE_HEADING,
							CSSStyles: {
								'font-size': '13px',
								'font-weight': '400',
								'margin-bottom': '10px',
							},
						})
						.component();
					this._startMigrationLoader = view.modelBuilder.loadingComponent()
						.withProps({
							loading: false,
							CSSStyles: { 'margin': '5px 0 0 10px' }
						})
						.component();
					this._progressReportText = view.modelBuilder.text()
						.withProps({
							value: '',
							CSSStyles: {
								'font-size': '13px',
								'font-weight': '400',
								'margin-bottom': '10px',
								'margin-left': '5px'
							},
						})
						.component();

					const headingContainer = view.modelBuilder.flexContainer()
						.withLayout({
							flexFlow: 'row',
							justifyContent: 'flex-start',
						})
						.withItems([this._headingText, this._progressReportText, this._startMigrationLoader], { flex: '0 0 auto' })
						.component();

					this._resultsTable = await this._createResultsTable(view);

					this._retryMigrationButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.restartDataCollection,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.TDE_MIGRATE_RETRY_VALIDATION,
						}).component();
					this._copyButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.copy,
							iconHeight: 18,
							iconWidth: 18,
							width: 150,
							label: constants.TDE_MIGRATE_COPY_RESULTS,
							enabled: false,
						}).component();

					this._disposables.push(
						this._retryMigrationButton.onDidClick(
							async (e) => await this._retryTdeMigration()));

					this._disposables.push(
						this._copyButton.onDidClick(
							async (e) => this._copyValidationResults()));

					const toolbar = view.modelBuilder.toolbarContainer()
						.withToolbarItems([
							{ component: this._retryMigrationButton }
							//{ component: this._copyButton }
						])
						.component();

					const resultsHeading = view.modelBuilder.text()
						.withProps({
							value: constants.TDE_MIGRATE_RESULTS_HEADING,
							CSSStyles: {
								'font-size': '16px',
								'font-weight': '600',
								'margin-bottom': '10px'
							},
						})
						.component();
					const resultsText = view.modelBuilder.inputBox()
						.withProps({
							inputType: 'text',
							height: 200,
							multiline: true,
							CSSStyles: { 'overflow': 'none auto' }
						})
						.component();

					this._disposables.push(
						this._resultsTable.onRowSelected(
							async (e) => await this._updateResultsInfoBox(resultsText)));

					const flex = view.modelBuilder.flexContainer()
						.withItems([
							headingContainer,
							toolbar,
							this._resultsTable,
							resultsHeading,
							resultsText],
							{ flex: '0 0 auto' })
						.withProps({ CSSStyles: { 'margin': '0 0 0 15px' } })
						.withLayout({
							flexFlow: 'column',
							height: '100%',
							width: 565,
						}).component();

					this._disposables.push(
						view.onClosed(e =>
							this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					await view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}



	private async _loadMigrationResults(): Promise<void> {
		const tdeMigrationResult = this._model.tdeMigrationConfig.lastTdeMigrationResult();
		this._progressReportText.value = '';

		if (tdeMigrationResult.state === TdeMigrationState.Pending) {
			//First time it is called. Should auto start.
			this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING;

			//Initialize results using the tde enabled databases;
			tdeMigrationResult.dbList = this._model.tdeMigrationConfig.getTdeEnabledDatabases().map<TdeMigrationDbState>(
				db => ({
					name: db,
					dbState: TdeDatabaseMigrationState.Running,
					message: ''
				}
				));

			this._startMigrationLoader.loading = true;
			this._retryMigrationButton.enabled = false;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
		} else {
			//It already ran. Just load the previous status.
			this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING_PREVIOUS;
			this._startMigrationLoader.loading = false;
			this._retryMigrationButton.enabled = true;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = true;
			this._dialog!.cancelButton.enabled = true;
		}

		//Grab copy of data with a different result reference. Done here because it is closer to the assigment on the true path.
		this._tdeMigrationResult = {
			state: tdeMigrationResult.state,
			dbList: tdeMigrationResult.dbList
		};

		await this._populateTableResults();
	}

	private async _retryTdeMigration(): Promise<void> {
		const tdeMigrationResult = this._model.tdeMigrationConfig.lastTdeMigrationResult();
		tdeMigrationResult.dbList = this._model.tdeMigrationConfig.getTdeEnabledDatabases().map<TdeMigrationDbState>(
			db => ({
				name: db,
				dbState: TdeDatabaseMigrationState.Running,
				message: ''
			}
			));

		this._tdeMigrationResult = {
			state: tdeMigrationResult.state,
			dbList: tdeMigrationResult.dbList
		};

		await this._populateTableResults();

		await this._runTdeMigration();
	}

	private _updateProgressText(): void {
		this._progressReportText.value = constants.TDE_COMPLETED_STATUS(this._completedDatabasesCount, this._model.tdeMigrationConfig.getTdeEnabledDatabasesCount());
	}

	private async _runTdeMigration(): Promise<void> {
		//Update the UI buttons
		this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING;
		this._startMigrationLoader.loading = true;
		this._retryMigrationButton.enabled = false;
		this._copyButton.enabled = false;
		this._dialog!.okButton.enabled = false;
		this._dialog!.cancelButton.enabled = true;


		//Send the external command
		try {
			this._completedDatabasesCount = 0;
			this._updateProgressText();

			//Get access token
			const accessToken = await azdata.accounts.getAccountSecurityToken(this._model._azureAccount, this._model._azureAccount.properties.tenants[0].id, azdata.AzureResource.ResourceManagement);

			const operationResult = await this._model.startTdeMigration(accessToken!.token, this._updateTableResultRow.bind(this));

			await this._updateTableFromOperationResult(operationResult);

			if (operationResult.success) {
				this._dialog!.okButton.enabled = true;

				this._tdeMigrationResult = {
					state: TdeMigrationState.Succeeded,
					dbList: operationResult.result.map<TdeMigrationDbState>(
						db => ({
							name: db.name,
							dbState: TdeDatabaseMigrationState.Succeeded,
							message: db.message
						}
						))
				};

				this._model.tdeMigrationConfig.setTdeMigrationResult(this._tdeMigrationResult); // Set value on success.
			}
			else {
				this._dialog!.okButton.enabled = false;
				const errorDetails = operationResult.errors.join(EOL);

				logError(TelemetryViews.MigrationLocalStorage, TelemetryErrorName.StartMigrationFailed, errorDetails);
			}

			this._startMigrationLoader.loading = false;
			this._retryMigrationButton.enabled = true;
			this._copyButton.enabled = true;

			this._completedDatabasesCount = this._model.tdeMigrationConfig.getTdeEnabledDatabasesCount(); //Force the total to match
			this._updateProgressText();

		} catch (error) {
			//Catch any exception and failed any pending table.
			this._startMigrationLoader.loading = false;
			this._retryMigrationButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._progressReportText.value = '';
		}

		this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING_COMPLETED;
	}

	private async _copyValidationResults(): Promise<void> {
		const errorsText = this._valdiationErrors.join(EOL);
		const msg = errorsText.length === 0
			? constants.TDE_MIGRATE_VALIDATION_COMPLETED
			: constants.TDE_MIGRATE_VALIDATION_COMPLETED_ERRORS(errorsText);
		return vscode.env.clipboard.writeText(msg);
	}

	private async _updateResultsInfoBox(text: azdata.InputBoxComponent): Promise<void> {
		const selectedRows: number[] = this._resultsTable.selectedRows ?? [];
		const statusMessages: string[] = [];
		if (selectedRows.length > 0) {
			for (let i = 0; i < selectedRows.length; i++) {
				const row = selectedRows[i];
				const results: any[] = this._validationResult[row];
				const status = results[TdeValidationResultIndex.status];
				const errors = results[TdeValidationResultIndex.errors];
				statusMessages.push(
					constants.TDE_MIGRATE_VALIDATION_STATUS(ValidationStatusLookup[status], errors));
			}
		}

		const msg = statusMessages.length > 0
			? statusMessages.join(EOL)
			: '';
		text.value = msg;
	}

	private async _createResultsTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		return view.modelBuilder.table()
			.withProps({
				columns: [
					{
						value: 'test',
						name: constants.TDE_MIGRATE_COLUMN_DATABASES,
						type: azdata.ColumnType.text,
						width: 380,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'image',
						name: '',
						type: azdata.ColumnType.icon,
						width: 20,
						headerCssClass: 'no-borders display-none',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'message',
						name: constants.TDE_MIGRATE_COLUMN_STATUS,
						type: azdata.ColumnType.text,
						width: 150,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
				],
				data: [],
				width: 580,
				height: 300,
				CSSStyles: {
					'margin-top': '10px',
					'margin-bottom': '10px',
				},
			})
			.component();
	}



	private async _updateTableFromOperationResult(operationResult: OperationResult<TdeMigrationDbResult[]>): Promise<void> {
		let anyRowUpdated = false;

		operationResult.result.forEach((element) => {
			const rowResultsIndex = this._dbRowsMap.get(element.name)!; //Checked already at the beginning of the method
			const currentRow = this._validationResult[rowResultsIndex];

			if (!currentRow[TdeValidationResultIndex.updated]) {
				anyRowUpdated = true;
				this._updateValidationResultRow(element.name, element.success, element.message);
			}
		});

		if (anyRowUpdated) {
			// Update the table
			await this._updateTableData();
		}
	}

	private async _updateTableResultRow(dbName: string, succeeded: boolean, message: string): Promise<void> {
		if (!this._dbRowsMap.has(dbName)) {
			return; //Table not found
		}

		this._updateValidationResultRow(dbName, succeeded, message);

		// Update the table
		await this._updateTableData();

		// When the updates come after the method finished. Thread related, out of our control.
		if (this._completedDatabasesCount < this._model.tdeMigrationConfig.getTdeEnabledDatabasesCount()) {
			this._completedDatabasesCount++; // Increase the completed count
			this._updateProgressText();
		}
	}

	private _updateValidationResultRow(dbName: string, succeeded: boolean, message: string) {
		const rowResultsIndex = this._dbRowsMap.get(dbName)!; //Checked already at the beginning of the method
		const tmpRow = this._buildRow({
			name: dbName,
			dbState: (succeeded) ? TdeDatabaseMigrationState.Succeeded : TdeDatabaseMigrationState.Failed,
			message: message
		},
			true);

		// Update the local result
		this._validationResult[rowResultsIndex] = tmpRow;
	}

	private async _updateTableData() {
		const data = this._validationResult.map(row => [
			row[TdeValidationResultIndex.name],
			row[TdeValidationResultIndex.icon],
			row[TdeValidationResultIndex.status]]);

		await this._resultsTable.updateProperty('data', data);
	}

	private async _populateTableResults(): Promise<void> {
		//Create the local result from the model.
		this._validationResult = this._tdeMigrationResult.dbList.map(db => this._buildRow(db));
		this._dbRowsMap = this._validationResult.reduce(function (map: Map<string, number>, row: any[], currentIndex) {
			const dbName = row[TdeValidationResultIndex.name];
			map.set(dbName, currentIndex);
			return map;
		}, new Map<string, number>());

		//Update the table.
		await this._updateTableData();
	}

	private _buildRow(db: TdeMigrationDbState, updated: boolean = false): any[] {

		const statusMsg = ValidationStatusLookup[db.dbState];

		const statusMessage = (db.dbState === TdeDatabaseMigrationState.Failed || db.dbState === TdeDatabaseMigrationState.Canceled)
			? constants.TDE_MIGRATE_STATUS_ERROR(db.dbState, db.message)
			: statusMsg;

		const row: any[] = [
			db.name,
			<azdata.IconColumnCellValue>{
				icon: this._getValidationStateImage(db.dbState),
				title: statusMessage,
			},
			ValidationStatusLookup[db.dbState],
			db.message,
			statusMsg,
			updated
		];

		return row;
	}

	private _getValidationStateImage(state: TdeDatabaseMigrationState): azdata.IconPath {
		switch (state) {
			case TdeDatabaseMigrationState.Canceled:
				return IconPathHelper.cancel;
			case TdeDatabaseMigrationState.Failed:
				return IconPathHelper.error;
			case TdeDatabaseMigrationState.Running:
				return IconPathHelper.inProgressMigration;
			case TdeDatabaseMigrationState.Succeeded:
				return IconPathHelper.completedMigration;
			default:
				return IconPathHelper.notStartedMigration;
		}
	}



}
