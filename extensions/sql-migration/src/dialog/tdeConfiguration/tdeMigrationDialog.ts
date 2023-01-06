/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
//import { logError, TelemetryErrorName, TelemetryViews } from '../../telemtery';
import { EOL } from 'os';
import { MigrationStateModel } from '../../models/stateMachine';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { TdeMigrationState, TdeMigrationResult, TdeMigrationDbState, TdeDatabaseMigrationState } from '../../models/tdeModels';

const DialogName = 'TdeMigrationDialog';

export enum TdeValidationResultIndex {
	name = 0,
	icon = 1,
	status = 2,
	errors = 3,
	state = 4
}

export const ValidationStatusLookup: constants.LookupTable<string | undefined> = {
	[TdeMigrationState.Canceled]: constants.TDE_MIGRATE_STATE_CANCELED,
	[TdeMigrationState.Failed]: constants.TDE_MIGRATE_STATE_FAILED,
	[TdeMigrationState.Pending]: constants.TDE_MIGRATE_STATE_PENDING,
	[TdeMigrationState.Running]: constants.TDE_MIGRATE_STATE_RUNNING,
	[TdeMigrationState.Succeeded]: constants.TDE_MIGRATE_STATE_SUCCEEDED,
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
	private _startMigrationButton!: azdata.ButtonComponent;
	private _cancelMigrationButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _headingText!: azdata.TextComponent;
	private _validationResult: any[][] = [];
	private _tdeMigrationResult: TdeMigrationResult = {
		state: TdeMigrationState.Pending,
		dbList: []
	};
	private _valdiationErrors: string[] = [];
	private _onClosed: () => void;

	constructor(
		model: MigrationStateModel,
		onClosed: () => void) {
		this._model = model;
		this._onClosed = onClosed;
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

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => {
								//this._canceled = true;
								//this._saveResults();
								this._onClosed();
							}));

					this._disposables.push(
						dialog.okButton.onClick(
							e => this._onClosed()));

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
					const headingContainer = view.modelBuilder.flexContainer()
						.withLayout({
							flexFlow: 'row',
							justifyContent: 'flex-start',
						})
						.withItems([this._headingText, this._startMigrationLoader], { flex: '0 0 auto' })
						.component();

					this._resultsTable = await this._createResultsTable(view);

					this._startMigrationButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.restartDataCollection,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.TDE_MIGRATE_START_VALIDATION,
						}).component();

					this._cancelMigrationButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.stop,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.TDE_MIGRATE_STOP_VALIDATION,
							enabled: false,
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

					// this._disposables.push(
					// 	this._startMigrationButton.onDidClick(
					// 		async (e) => await this._runValidation()));
					this._disposables.push(
						this._cancelMigrationButton.onDidClick(
							e => {
								this._cancelMigrationButton.enabled = false;
								//this._canceled = true;
							}));

					this._disposables.push(
						this._copyButton.onDidClick(
							async (e) => this._copyValidationResults()));

					const toolbar = view.modelBuilder.toolbarContainer()
						.withToolbarItems([
							{ component: this._startMigrationButton },
							{ component: this._cancelMigrationButton },
							{ component: this._copyButton }])
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

	// private _saveResults(): void {
	// 	const results = this._validationResults();
	// 	switch (this._model._targetType) {
	// 		case MigrationTargetType.SQLDB:
	// 			this._model._validateIrSqlDb = results;
	// 			break;
	// 		case MigrationTargetType.SQLMI:
	// 			this._model._validateIrSqlMi = results;
	// 			break;
	// 		case MigrationTargetType.SQLVM:
	// 			this._model._validateIrSqlVm = results;
	// 			break;
	// 	}
	// }

	// private _validationResults(): TdeMigrationResult[] {
	// 	return this._validationResult.map(result => {
	// 		const state = result[ValidationResultIndex.state];
	// 		const finalState = this._canceled
	// 			? state === TdeMigrationState.Running || state === TdeMigrationState.Pending
	// 				? TdeMigrationState.Canceled
	// 				: state
	// 			: state;
	// 		const errors = result[ValidationResultIndex.errors] ?? [];
	// 		return {
	// 			errors: errors,
	// 			state: finalState,
	// 		};
	// 	});
	// }

	private async _loadMigrationResults(): Promise<void> {
		const tdeMigrationResult = this._model.tdeMigrationConfig.lastTdeMigrationResult();

		if (this._tdeMigrationResult.state === TdeMigrationState.Pending) {
			//First time it is called. Should auto start.
			this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING;

			//Initialize results using the tde enabled databases;
			tdeMigrationResult.dbList = this._model.tdeMigrationConfig.getTdeEnabledDatabases().map<TdeMigrationDbState>(
				db => ({
					name: db,
					dbState: TdeDatabaseMigrationState.Running,
					error: ''
				}
				));

			this._startMigrationLoader.loading = true;
			this._startMigrationButton.enabled = false;
			this._cancelMigrationButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
		} else {
			//It already ran. Just load the previous status.
			this._headingText.value = constants.TDE_MIGRATE_RESULTS_HEADING_PREVIOUS;
			this._startMigrationLoader.loading = false;
			this._startMigrationButton.enabled = true;
			this._cancelMigrationButton.enabled = true;
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

	private async _runTdeMigration(): Promise<void> {
		//Update the UI buttons

		//Send the external command

		//Catch any exception and failed any pending table.
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


	// private async _validate(): Promise<void> {
	// 	this._canceled = false;
	// 	await this._initializeResults();

	// 	await this._validateDatabaseMigration();

	// 	this._saveResults();
	// }

	// private async _updateTableResultRow(dbName: string, succeeded: boolean, error: string) {
	// 	//Update the model
	// 	//Update the local result

	// 	//Update the table
	// }

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

		//Update the table.
		await this._updateTableData();

		//_tdeMigrationResult


		// const sqlConnections = await azdata.connection.getConnections();
		// const currentConnection = sqlConnections.find(
		// 	value => value.connectionId === this._model.sourceConnectionId);
		// const sourceServerName = currentConnection?.serverName!;
		// const trustServerCertificate = currentConnection?.options?.trustServerCertificate === true;
		// const databaseCount = this._model._databasesForMigration.length;
		// const sourceDatabaseName = this._model._databasesForMigration[0];
		// const networkShare = this._model._databaseBackup.networkShares[0];
		// let testNumber: number = 0;

		// const validate = async (
		// 	sourceDatabase: string,
		// 	network: NetworkShare,
		// 	testIrOnline: boolean,
		// 	testSourceLocationConnectivity: boolean,
		// 	testSourceConnectivity: boolean,
		// 	testBlobConnectivity: boolean): Promise<boolean> => {
		// 	try {
		// 		await this._updateValidateIrResults(testNumber, TdeMigrationState.Running);
		// 		const response = await validateIrDatabaseMigrationSettings(
		// 			this._model,
		// 			sourceServerName,
		// 			trustServerCertificate,
		// 			sourceDatabase,
		// 			network,
		// 			testIrOnline,
		// 			testSourceLocationConnectivity,
		// 			testSourceConnectivity,
		// 			testBlobConnectivity);
		// 		if (response?.errors?.length > 0) {
		// 			const errors = response.errors.map(
		// 				error => constants.VALIDATE_IR_VALIDATION_RESULT_ERROR(
		// 					sourceDatabase,
		// 					network.networkShareLocation,
		// 					error));
		// 			await this._updateValidateIrResults(testNumber, TdeMigrationState.Failed, errors);
		// 		} else {
		// 			await this._updateValidateIrResults(testNumber, TdeMigrationState.Succeeded);
		// 			return true;
		// 		}
		// 	} catch (error) {
		// 		await this._updateValidateIrResults(
		// 			testNumber,
		// 			TdeMigrationState.Failed,
		// 			[constants.VALIDATE_IR_VALIDATION_RESULT_API_ERROR(sourceDatabase, error)]);
		// 	}
		// 	return false;
		// };


		// for (let i = 0; i < databaseCount; i++) {
		// 	const sourceDatabaseName = this._model._databasesForMigration[i];
		// 	const networkShare = this._model._databaseBackup.networkShares[i];
		// 	testNumber++;
		// 	if (this._canceled) {
		// 		await this._updateValidateIrResults(testNumber, TdeMigrationState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
		// 		break;
		// 	}
		// 	// validate source connectivity
		// 	await validate(sourceDatabaseName, networkShare, false, false, true, false);
		// 	testNumber++;
		// 	if (this._canceled) {
		// 		await this._updateValidateIrResults(testNumber, TdeMigrationState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
		// 		break;
		// 	}
		// 	// valdiate source location / network share connectivity
		// 	await validate(sourceDatabaseName, networkShare, false, true, false, false);
		// }
	}

	private _buildRow(db: TdeMigrationDbState): any[] {

		const statusMsg = ValidationStatusLookup[db.dbState];

		const statusMessage = (db.dbState === TdeDatabaseMigrationState.Failed || db.dbState === TdeDatabaseMigrationState.Canceled)
			? constants.TDE_MIGRATE_STATUS_ERROR(db.dbState, db.error)
			: statusMsg;

		const row: any[] = [
			db.name,
			<azdata.IconColumnCellValue>{
				icon: this._getValidationStateImage(db.dbState),
				title: statusMessage,
			},
			ValidationStatusLookup[db.dbState],
			db.error,
			statusMsg
		];

		return row;
	}

	// private async _validateSqlDbMigration(): Promise<void> {
	// 	const sqlConnections = await azdata.connection.getConnections();
	// 	const currentConnection = sqlConnections.find(
	// 		value => value.connectionId === this._model.sourceConnectionId);
	// 	const sourceServerName = currentConnection?.serverName!;
	// 	const trustServerCertificate = currentConnection?.options['trustServerCertificate'] === true;
	// 	const databaseCount = this._model._databasesForMigration.length;
	// 	const sourceDatabaseName = this._model._databasesForMigration[0];
	// 	const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';
	// 	let testNumber: number = 0;

	// 	const validate = async (
	// 		sourceDatabase: string,
	// 		targetDatabase: string,
	// 		testIrOnline: boolean,
	// 		testSourceConnectivity: boolean,
	// 		testTargetConnectivity: boolean): Promise<boolean> => {

	// 		await this._updateValidateIrResults(testNumber, TdeMigrationState.Running);
	// 		try {
	// 			const response = await validateIrSqlDatabaseMigrationSettings(
	// 				this._model,
	// 				sourceServerName,
	// 				trustServerCertificate,
	// 				sourceDatabase,
	// 				targetDatabase,
	// 				testIrOnline,
	// 				testSourceConnectivity,
	// 				testTargetConnectivity);
	// 			if (response?.errors?.length > 0) {
	// 				const errors = response.errors.map(
	// 					error => constants.VALIDATE_IR_SQLDB_VALIDATION_RESULT_ERROR(
	// 						sourceDatabase,
	// 						targetDatabase,
	// 						error));
	// 				await this._updateValidateIrResults(testNumber, TdeMigrationState.Failed, errors);
	// 			} else {
	// 				await this._updateValidateIrResults(testNumber, TdeMigrationState.Succeeded);
	// 				return true;
	// 			}
	// 		} catch (error) {
	// 			await this._updateValidateIrResults(
	// 				testNumber,
	// 				TdeMigrationState.Failed,
	// 				[constants.VALIDATE_IR_VALIDATION_RESULT_API_ERROR(sourceDatabase, error)]);
	// 		}
	// 		return false;
	// 	};

	// 	// validate IR is online
	// 	if (!await validate(sourceDatabaseName, targetDatabaseName, true, false, false)) {
	// 		this._canceled = true;
	// 		await this._updateValidateIrResults(testNumber + 1, TdeMigrationState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
	// 		return;
	// 	}

	// 	for (let i = 0; i < databaseCount; i++) {
	// 		const sourceDatabaseName = this._model._databasesForMigration[i];
	// 		const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';

	// 		testNumber++;
	// 		if (this._canceled) {
	// 			await this._updateValidateIrResults(testNumber, TdeMigrationState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
	// 			break;
	// 		}
	// 		// validate source connectivity
	// 		await validate(sourceDatabaseName, targetDatabaseName, false, true, false);

	// 		testNumber++;
	// 		if (this._canceled) {
	// 			await this._updateValidateIrResults(testNumber, TdeMigrationState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
	// 			break;
	// 		}
	// 		// validate target connectivity
	// 		await validate(sourceDatabaseName, targetDatabaseName, false, false, true);
	// 	}
	// }

	// private async _initTestIrResults(results?: TdeMigrationResult[]): Promise<void> {
	// 	this._validationResult = [];

	// 	this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SHIR);
	// 	this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_STORAGE);

	// 	for (let i = 0; i < this._model._databasesForMigration.length; i++) {
	// 		const sourceDatabaseName = this._model._databasesForMigration[i];
	// 		const networkShare = this._model._databaseBackup.networkShares[i];

	// 		this._addValidationResult(
	// 			constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SOURCE_DATABASE(
	// 				sourceDatabaseName));
	// 		this._addValidationResult(
	// 			constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_NETWORK_SHARE(
	// 				networkShare.networkShareLocation));
	// 	}

	// 	if (results && results.length > 0) {
	// 		for (let row = 0; row < results.length; row++) {
	// 			await this._updateValidateIrResults(
	// 				row,
	// 				results[row].state,
	// 				results[row].errors,
	// 				false);
	// 		}
	// 	}
	// 	//const data = this._tdeMigrationResult.dbList.map(row => [
	// 	const data = this._validationResult.map(row => [
	// 		row[ValidationResultIndex.message],
	// 		row[ValidationResultIndex.icon],
	// 		row[ValidationResultIndex.status]]);
	// 	await this._resultsTable.updateProperty('data', data);
	// }

	// private async _initSqlDbIrResults(results?: TdeMigrationResult[]): Promise<void> {
	// 	this._validationResult = [];
	// 	this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SHIR);

	// 	this._model._databasesForMigration
	// 		.forEach(sourceDatabaseName => {
	// 			this._addValidationResult(
	// 				constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SOURCE_DATABASE(
	// 					sourceDatabaseName));

	// 			const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';
	// 			this._addValidationResult(
	// 				constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_TARGET_DATABASE(
	// 					targetDatabaseName));
	// 		});

	// 	if (results && results.length > 0) {
	// 		for (let row = 0; row < results.length; row++) {
	// 			await this._updateValidateIrResults(
	// 				row,
	// 				results[row].state,
	// 				results[row].errors,
	// 				false);
	// 		}
	// 	}

	// 	const data = this._validationResult.map(row => [
	// 		row[ValidationResultIndex.message],
	// 		row[ValidationResultIndex.icon],
	// 		row[ValidationResultIndex.status]]);
	// 	await this._resultsTable.updateProperty('data', data);
	// }

	// private _addValidationResult(message: string): void {
	// 	this._validationResult.push([
	// 		message,
	// 		<azdata.IconColumnCellValue>{
	// 			icon: IconPathHelper.notStartedMigration,
	// 			title: ValidationStatusLookup[TdeMigrationState.Pending],
	// 		},
	// 		ValidationStatusLookup[TdeMigrationState.Pending],
	// 		[],
	// 		TdeMigrationState.Pending]);
	// }

	// private async _updateValidateIrResults(row: number, state: TdeMigrationState, errors: string[] = [], updateTable: boolean = true): Promise<void> {
	// 	if (state === TdeMigrationState.Canceled) {
	// 		for (let cancelRow = row; cancelRow < this._validationResult.length; cancelRow++) {
	// 			await this._updateResults(cancelRow, state, errors);
	// 		}
	// 	} else {
	// 		await this._updateResults(row, state, errors);
	// 	}

	// 	if (updateTable) {
	// 		const data = this._validationResult.map(row => [
	// 			row[ValidationResultIndex.message],
	// 			row[ValidationResultIndex.icon],
	// 			row[ValidationResultIndex.status]]);
	// 		await this._resultsTable.updateProperty('data', data);
	// 	}

	// 	this._valdiationErrors.push(...errors);
	// }

	// private async _updateResults(row: number, state: TdeMigrationState, errors: string[] = []): Promise<void> {
	// 	const result = this._validationResult[row];
	// 	const status = ValidationStatusLookup[state];
	// 	const statusMsg = state === TdeMigrationState.Failed && errors.length > 0
	// 		? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR_COUNT(status, errors.length)
	// 		: status;

	// 	const statusMessage = errors.length > 0
	// 		? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR(status, errors)
	// 		: statusMsg;

	// 	this._validationResult[row] = [
	// 		result[ValidationResultIndex.message],
	// 		<azdata.IconColumnCellValue>{
	// 			icon: this._getValidationStateImage(state),
	// 			title: statusMessage,
	// 		},
	// 		statusMsg,
	// 		errors,
	// 		state];
	// }

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


	// private async _startTdeMigration(): Promise<any> {
	// 	return;
	// 	if (this.migrationStateModel.tdeMigrationConfig.shouldAdsMigrateCertificates()) {

	// 		const operationResult = await this.migrationStateModel.startTdeMigration();

	// 		if (!operationResult.success) {
	// 			const errorDetails = operationResult.errors.join(EOL);

	// 			logError(TelemetryViews.MigrationLocalStorage, TelemetryErrorName.StartMigrationFailed, errorDetails);

	// 			this.wizard.message = {
	// 				text: errorDetails,
	// 				level: azdata.window.MessageLevel.Error
	// 			};
	// 			return false;
	// 		}
	// 	}
	// }
}
