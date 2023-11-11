/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { validateIrDatabaseMigrationSettings, validateIrSqlDatabaseMigrationSettings } from '../../api/azure';
import { MigrationStateModel, NetworkShare, ValidateIrState, ValidationResult } from '../../models/stateMachine';
import { EOL } from 'os';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { getEncryptConnectionValue, getSourceConnectionProfile, getTrustServerCertificateValue } from '../../api/sqlUtils';
import { logError, TelemetryViews } from '../../telemetry';
import { MigrationTargetType } from '../../api/utils';

const DialogName = 'ValidateIrDialog';

enum HttpStatusCodes {
	GatewayTimeout = "504\r\n",
}

enum HttpStatusExceptionCodes {
	ConnectionTimeoutError = "ConnectionTimeoutError",
}

enum ValidationResultIndex {
	message = 0,
	icon = 1,
	status = 2,
	errors = 3,
	state = 4,
}

export const ValidationStatusLookup: constants.LookupTable<string | undefined> = {
	[ValidateIrState.Canceled]: constants.VALIDATION_STATE_CANCELED,
	[ValidateIrState.Failed]: constants.VALIDATION_STATE_FAILED,
	[ValidateIrState.Pending]: constants.VALIDATION_STATE_PENDING,
	[ValidateIrState.Running]: constants.VALIDATION_STATE_RUNNING,
	[ValidateIrState.Succeeded]: constants.VALIDATION_STATE_SUCCEEDED,
	default: undefined
};

export class ValidateIrDialog {
	private _canceled: boolean = true;
	private _dialog: azdata.window.Dialog | undefined;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model!: MigrationStateModel;
	private _resultsTable!: azdata.TableComponent;
	private _startLoader!: azdata.LoadingComponent;
	private _startButton!: azdata.ButtonComponent;
	private _revalidationButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _validationResult: any[][] = [];
	private _valdiationErrors: string[] = [];
	private _onClosed: () => void;

	constructor(
		model: MigrationStateModel,
		onClosed: () => void) {
		this._model = model;
		this._onClosed = onClosed;
	}

	public async openDialog(dialogTitle: string, results?: ValidationResult[]): Promise<void> {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600);

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;

			return this._runValidation(results);
		}
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					dialog.okButton.label = constants.VALIDATE_IR_DONE_BUTTON;
					dialog.okButton.position = 'left';
					dialog.okButton.enabled = false;
					dialog.cancelButton.position = 'left';

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => {
								this._canceled = true;
								this._saveResults();
								this._onClosed();
							}));

					this._disposables.push(
						dialog.okButton.onClick(
							e => this._onClosed()));

					const headingText = view.modelBuilder.text()
						.withProps({
							value: constants.VALIDATE_IR_HEADING,
							CSSStyles: {
								'font-size': '13px',
								'font-weight': '400',
								'margin-bottom': '10px',
							},
						})
						.component();
					this._startLoader = view.modelBuilder.loadingComponent()
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
						.withItems([headingText, this._startLoader], { flex: '0 0 auto' })
						.component();

					this._resultsTable = await this._createResultsTable(view);

					this._startButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.restartDataCollection,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.VALIDATE_IR_START_VALIDATION,
						}).component();

					this._cancelButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.stop,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.VALIDATE_IR_STOP_VALIDATION,
							enabled: false,
						}).component();

					this._revalidationButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.redo,
							iconHeight: 18,
							iconWidth: 18,
							width: 170,
							label: constants.VALIDATE_IR_UNSUCCESSFUL_REVALIDATION,
							enabled: false,
						}).component();

					this._copyButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.copy,
							iconHeight: 18,
							iconWidth: 18,
							width: 140,
							label: constants.VALIDATE_IR_COPY_RESULTS,
							enabled: false,
						}).component();

					this._disposables.push(
						this._startButton.onDidClick(
							async (e) => await this._runValidation()));

					this._disposables.push(
						this._revalidationButton.onDidClick(
							async (e) => await this._runUnsuccessfulRevalidation()));
					this._disposables.push(
						this._cancelButton.onDidClick(
							e => {
								this._cancelButton.enabled = false;
								this._canceled = true;
							}));

					this._disposables.push(
						this._copyButton.onDidClick(
							async (e) => this._copyValidationResults()));

					const toolbar = view.modelBuilder.toolbarContainer()
						.withToolbarItems([
							{ component: this._startButton },
							{ component: this._cancelButton },
							{ component: this._revalidationButton },
							{ component: this._copyButton }])
						.component();

					const resultsHeading = view.modelBuilder.text()
						.withProps({
							value: constants.VALIDATE_IR_RESULTS_HEADING,
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

	private _saveResults(): void {
		const results = this._validationResults();
		switch (this._model._targetType) {
			case MigrationTargetType.SQLDB:
				this._model._validateIrSqlDb = results;
				break;
			case MigrationTargetType.SQLMI:
				this._model._validateIrSqlMi = results;
				break;
			case MigrationTargetType.SQLVM:
				this._model._validateIrSqlVm = results;
				break;
		}
	}

	private _validationResults(): ValidationResult[] {
		return this._validationResult.map(result => {
			const state = result[ValidationResultIndex.state];
			const finalState = this._canceled
				? state === ValidateIrState.Running || state === ValidateIrState.Pending
					? ValidateIrState.Canceled
					: state
				: state;
			const errors = result[ValidationResultIndex.errors] ?? [];
			return {
				errors: errors,
				state: finalState,
			};
		});
	}

	private async _runValidation(results?: ValidationResult[]): Promise<void> {
		try {
			this._startLoader.loading = true;
			this._startButton.enabled = false;
			this._revalidationButton.enabled = false;
			this._cancelButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
			if (this._model.isIrTargetValidated && results) {
				await this._initializeResults(results);
			} else {
				await this._validate();
			}
		} finally {
			this._startLoader.loading = false;
			this._startButton.enabled = true;
			this._revalidationButton.enabled = !this._model.isIrTargetValidated;
			this._cancelButton.enabled = false;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = this._model.isIrTargetValidated;
			this._dialog!.cancelButton.enabled = !this._model.isIrTargetValidated;
		}
	}

	private async _runUnsuccessfulRevalidation(results?: ValidationResult[]): Promise<void> {
		try {
			this._startLoader.loading = true;
			this._startButton.enabled = false;
			this._revalidationButton.enabled = false;
			this._cancelButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
			if (!this._model.isIrTargetValidated) {
				await this._revalidate();
			}
		} finally {
			this._startLoader.loading = false;
			this._startButton.enabled = true;
			this._revalidationButton.enabled = !this._model.isIrTargetValidated;
			this._cancelButton.enabled = false;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = this._model.isIrTargetValidated;
			this._dialog!.cancelButton.enabled = !this._model.isIrTargetValidated;
		}
	}

	private async _copyValidationResults(): Promise<void> {
		const errorsText = this._valdiationErrors.join(EOL);
		const msg = errorsText.length === 0
			? constants.VALIDATE_IR_VALIDATION_COMPLETED
			: constants.VALIDATE_IR_VALIDATION_COMPLETED_ERRORS(errorsText);
		return vscode.env.clipboard.writeText(msg);
	}

	private async _updateResultsInfoBox(text: azdata.InputBoxComponent): Promise<void> {
		const selectedRows: number[] = this._resultsTable.selectedRows ?? [];
		const statusMessages: string[] = [];
		if (selectedRows.length > 0) {
			for (let i = 0; i < selectedRows.length; i++) {
				const row = selectedRows[i];
				const results: any[] = this._validationResult[row];
				const status = results[ValidationResultIndex.status];
				const errors = results[ValidationResultIndex.errors];
				statusMessages.push(
					constants.VALIDATE_IR_VALIDATION_STATUS(ValidationStatusLookup[status], errors));
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
						name: constants.VALIDATE_IR_COLUMN_VALIDATION_STEPS,
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
						name: constants.VALIDATE_IR_COLUMN_STATUS,
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

	private async _initializeResults(results?: ValidationResult[]): Promise<void> {
		this._valdiationErrors = [];
		if (this._model.isSqlDbTarget) {
			// initialize validation results view for sqldb target
			await this._initSqlDbIrResults(results);
		} else {
			// initialize validation results view for sqlmi, sqlvm targets
			await this._initTestIrResults(results);
		}
	}

	private async _validate(): Promise<void> {
		this._canceled = false;
		await this._initializeResults();

		if (this._model.isSqlDbTarget) {
			await this._validateSqlDbMigration();
		} else {
			await this._validateDatabaseMigration();
		}

		this._saveResults();
	}

	private async _revalidate(): Promise<void> {
		await this._initIrResultsForRevalidation();

		if (this._model.isSqlDbTarget) {
			await this._validateSqlDbMigration(true);
		} else {
			await this._validateDatabaseMigration(true);
		}

		this._saveResults();
	}

	private async _validateDatabaseMigration(skipSuccessfulSteps: boolean = false): Promise<void> {
		const currentConnection = await getSourceConnectionProfile();
		const sourceServerName = currentConnection?.serverName!;
		const encryptConnection = getEncryptConnectionValue(currentConnection);
		const trustServerCertificate = getTrustServerCertificateValue(currentConnection);
		const databaseCount = this._model._databasesForMigration.length;
		const sourceDatabaseName = this._model._databasesForMigration[0];
		const networkShare = this._model._databaseBackup.networkShares[0];
		let testNumber: number = 0;

		const validate = async (
			sourceDatabase: string,
			network: NetworkShare,
			testIrOnline: boolean,
			testSourceLocationConnectivity: boolean,
			testSourceConnectivity: boolean,
			testBlobConnectivity: boolean): Promise<boolean> => {
			try {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Running);
				const response = await validateIrDatabaseMigrationSettings(
					this._model,
					sourceServerName,
					encryptConnection,
					trustServerCertificate,
					sourceDatabase,
					network,
					testIrOnline,
					testSourceLocationConnectivity,
					testSourceConnectivity,
					testBlobConnectivity);
				if (response?.errors?.length > 0) {
					const errors = response.errors.map(
						error => constants.VALIDATE_IR_VALIDATION_RESULT_ERROR(
							sourceDatabase,
							network.networkShareLocation,
							error));
					await this._updateValidateIrResults(testNumber, ValidateIrState.Failed, errors);
				} else {
					await this._updateValidateIrResults(testNumber, ValidateIrState.Succeeded);
					return true;
				}
			} catch (error) {
				const err = this._formatError(error);
				logError(TelemetryViews.ValidIrDialog, err.message, error);
				await this._updateValidateIrResults(
					testNumber,
					ValidateIrState.Failed,
					[constants.VALIDATE_IR_VALIDATION_RESULT_API_ERROR(sourceDatabase, err)]);
			}
			return false;
		};

		// validate integration runtime (IR) is online
		if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
			if (!await validate(sourceDatabaseName, networkShare, true, false, false, false)) {
				this._canceled = true;
				await this._updateValidateIrResults(testNumber + 1, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
				return;
			}
		}
		testNumber++;

		// validate blob container connectivity
		if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
			if (!await validate(sourceDatabaseName, networkShare, false, false, false, true)) {
				await this._updateValidateIrResults(testNumber + 1, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
				return;
			}
		}

		for (let i = 0; i < databaseCount; i++) {
			const sourceDatabaseName = this._model._databasesForMigration[i];
			const networkShare = this._model._databaseBackup.networkShares[i];
			testNumber++;
			if (this._canceled) {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
				break;
			}
			// validate source connectivity
			if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
				await validate(sourceDatabaseName, networkShare, false, false, true, false);
			}
			testNumber++;
			if (this._canceled) {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED])
				break;
			}
			// valdiate source location / network share connectivity
			if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
				await validate(sourceDatabaseName, networkShare, false, true, false, false);
			}
		}
	}

	private _formatError(error: Error): Error {
		if (error?.message?.startsWith(HttpStatusCodes.GatewayTimeout)) {
			return {
				name: HttpStatusExceptionCodes.ConnectionTimeoutError,
				message: constants.VALIDATE_IR_ERROR_GATEWAY_TIMEOUT,
			};
		}
		return error;
	}

	private async _validateSqlDbMigration(skipSuccessfulSteps: boolean = false): Promise<void> {
		const currentConnection = await getSourceConnectionProfile();
		const sourceServerName = currentConnection?.serverName!;
		const encryptConnection = getEncryptConnectionValue(currentConnection);
		const trustServerCertificate = getTrustServerCertificateValue(currentConnection);
		const databaseCount = this._model._databasesForMigration.length;
		const sourceDatabaseName = this._model._databasesForMigration[0];
		const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';
		let testNumber: number = 0;

		const validate = async (
			sourceDatabase: string,
			targetDatabase: string,
			testIrOnline: boolean,
			testSourceConnectivity: boolean,
			testTargetConnectivity: boolean): Promise<boolean> => {

			try {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Running);
				const response = await validateIrSqlDatabaseMigrationSettings(
					this._model,
					sourceServerName,
					encryptConnection,
					trustServerCertificate,
					sourceDatabase,
					targetDatabase,
					testIrOnline,
					testSourceConnectivity,
					testTargetConnectivity);
				if (response?.errors?.length > 0) {
					const errors = response.errors.map(
						error => constants.VALIDATE_IR_SQLDB_VALIDATION_RESULT_ERROR(
							sourceDatabase,
							targetDatabase,
							error));
					await this._updateValidateIrResults(testNumber, ValidateIrState.Failed, errors);
				} else {
					await this._updateValidateIrResults(testNumber, ValidateIrState.Succeeded);
					return true;
				}
			} catch (error) {
				const err = this._formatError(error);
				logError(TelemetryViews.ValidIrDialog, err.message, error);
				await this._updateValidateIrResults(
					testNumber,
					ValidateIrState.Failed,
					[constants.VALIDATE_IR_VALIDATION_RESULT_API_ERROR(sourceDatabase, err)]);
			}
			return false;
		};

		// validate IR is online
		if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
			if (!await validate(sourceDatabaseName, targetDatabaseName, true, false, false)) {
				this._canceled = true;
				await this._updateValidateIrResults(testNumber + 1, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
				return;
			}
		}

		for (let i = 0; i < databaseCount; i++) {
			const sourceDatabaseName = this._model._databasesForMigration[i];
			const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';

			testNumber++;
			if (this._canceled) {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
				break;
			}
			// validate source connectivity
			if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
				await validate(sourceDatabaseName, targetDatabaseName, false, true, false);
			}

			testNumber++;
			if (this._canceled) {
				await this._updateValidateIrResults(testNumber, ValidateIrState.Canceled, [constants.VALIDATE_IR_VALIDATION_CANCELED]);
				break;
			}
			// validate target connectivity
			if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
				await validate(sourceDatabaseName, targetDatabaseName, false, false, true);
			}
		}
	}

	private async _initTestIrResults(results?: ValidationResult[]): Promise<void> {
		this._validationResult = [];

		this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SHIR);
		this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_STORAGE);

		for (let i = 0; i < this._model._databasesForMigration.length; i++) {
			const sourceDatabaseName = this._model._databasesForMigration[i];
			const networkShare = this._model._databaseBackup.networkShares[i];

			this._addValidationResult(
				constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SOURCE_DATABASE(
					sourceDatabaseName));
			this._addValidationResult(
				constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_NETWORK_SHARE(
					networkShare.networkShareLocation));
		}

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				await this._updateValidateIrResults(
					row,
					results[row].state,
					results[row].errors,
					false);
			}
		}

		const data = this._validationResult.map(row => [
			row[ValidationResultIndex.message],
			row[ValidationResultIndex.icon],
			row[ValidationResultIndex.status]]);
		await this._resultsTable.updateProperty('data', data);
	}

	private async _initIrResultsForRevalidation(results?: ValidationResult[]): Promise<void> {
		this._valdiationErrors = [];
		this._canceled = false;
		let testNumber: number = 0;

		this._validationResult.forEach(async element => {
			if (element[ValidationResultIndex.state] !== ValidateIrState.Succeeded) {
				await this._updateValidateIrResults(testNumber++, ValidateIrState.Pending);
			}
			else {
				testNumber++;
			}
		});
	}

	private async _initSqlDbIrResults(results?: ValidationResult[]): Promise<void> {
		this._validationResult = [];
		this._addValidationResult(constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SHIR);

		this._model._databasesForMigration
			.forEach(sourceDatabaseName => {
				this._addValidationResult(
					constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_SOURCE_DATABASE(
						sourceDatabaseName));

				const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';
				this._addValidationResult(
					constants.VALIDATE_IR_VALIDATION_RESULT_LABEL_TARGET_DATABASE(
						targetDatabaseName));
			});

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				await this._updateValidateIrResults(
					row,
					results[row].state,
					results[row].errors,
					false);
			}
		}

		const data = this._validationResult.map(row => [
			row[ValidationResultIndex.message],
			row[ValidationResultIndex.icon],
			row[ValidationResultIndex.status]]);
		await this._resultsTable.updateProperty('data', data);
	}

	private _addValidationResult(message: string): void {
		this._validationResult.push([
			message,
			<azdata.IconColumnCellValue>{
				icon: IconPathHelper.notStartedMigration,
				title: ValidationStatusLookup[ValidateIrState.Pending],
			},
			ValidationStatusLookup[ValidateIrState.Pending],
			[],
			ValidateIrState.Pending]);
	}

	private async _updateValidateIrResults(row: number, state: ValidateIrState, errors: string[] = [], updateTable: boolean = true): Promise<void> {
		if (state === ValidateIrState.Canceled) {
			for (let cancelRow = row; cancelRow < this._validationResult.length; cancelRow++) {
				await this._updateResults(cancelRow, state, errors);
			}
		} else {
			await this._updateResults(row, state, errors);
		}

		if (updateTable) {
			const data = this._validationResult.map(row => [
				row[ValidationResultIndex.message],
				row[ValidationResultIndex.icon],
				row[ValidationResultIndex.status]]);
			await this._resultsTable.updateProperty('data', data);
		}

		this._valdiationErrors.push(...errors);
	}

	private async _updateResults(row: number, state: ValidateIrState, errors: string[] = []): Promise<void> {
		const result = this._validationResult[row];
		const status = ValidationStatusLookup[state];
		const statusMsg = state === ValidateIrState.Failed && errors.length > 0
			? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR_COUNT(status, errors.length)
			: status;

		const statusMessage = errors.length > 0
			? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR(status, errors)
			: statusMsg;

		this._validationResult[row] = [
			result[ValidationResultIndex.message],
			<azdata.IconColumnCellValue>{
				icon: this._getValidationStateImage(state),
				title: statusMessage,
			},
			statusMsg,
			errors,
			state];
	}

	private _getValidationStateImage(state: ValidateIrState): azdata.IconPath {
		switch (state) {
			case ValidateIrState.Canceled:
				return IconPathHelper.cancel;
			case ValidateIrState.Failed:
				return IconPathHelper.error;
			case ValidateIrState.Running:
				return IconPathHelper.inProgressMigration;
			case ValidateIrState.Succeeded:
				return IconPathHelper.completedMigration;
			case ValidateIrState.Pending:
			default:
				return IconPathHelper.notStartedMigration;
		}
	}
}
