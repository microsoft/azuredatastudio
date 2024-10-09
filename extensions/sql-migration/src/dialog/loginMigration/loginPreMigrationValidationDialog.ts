/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { LoginMigrationValidationResult, MigrationStateModel, ValidateLoginMigrationValidationState } from '../../models/stateMachine';
import { getSourceConnectionString, getTargetConnectionString } from '../../api/sqlUtils';
import { getTelemetryProps, logError, sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../../telemetry';
import { EOL } from 'os';

const DialogName = 'LoginPreMigrationValidationDialog';

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
	[ValidateLoginMigrationValidationState.Canceled]: constants.VALIDATION_STATE_CANCELED,
	[ValidateLoginMigrationValidationState.Failed]: constants.VALIDATION_STATE_FAILED,
	[ValidateLoginMigrationValidationState.Pending]: constants.VALIDATION_STATE_PENDING,
	[ValidateLoginMigrationValidationState.Running]: constants.VALIDATION_STATE_RUNNING,
	[ValidateLoginMigrationValidationState.Succeeded]: constants.VALIDATION_STATE_SUCCEEDED,
	default: undefined
};

export class LoginPreMigrationValidationDialog {
	private _canceled: boolean = true;
	private _dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;
	private _model!: MigrationStateModel;
	private _resultsTable!: azdata.TableComponent;
	private _startLoader!: azdata.LoadingComponent;
	private _startButton!: azdata.ButtonComponent;
	private _revalidationButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _validationResult: any[][] = [];
	private _disposables: vscode.Disposable[] = [];
	private _valdiationErrors: string[] = [];
	private _onClosed: () => void;

	constructor(
		model: MigrationStateModel,
		onClosed: () => void) {
		this._model = model;
		this._onClosed = onClosed;
	}

	public async openDialog(dialogTitle: string, results?: LoginMigrationValidationResult[]): Promise<void> {
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
					dialog.okButton.label = constants.VALIDATE_LOGIN_MIGRATION_DONE_BUTTON;
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
							value: constants.VALIDATE_LOGIN_MIGRATION_HEADING,
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
							label: constants.VALIDATE_LOGIN_MIGRATION_START_VALIDATION,
						}).component();

					this._cancelButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.stop,
							iconHeight: 18,
							iconWidth: 18,
							width: 100,
							label: constants.VALIDATE_LOGIN_MIGRATION_STOP_VALIDATION,
							enabled: false,
						}).component();

					this._revalidationButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.redo,
							iconHeight: 18,
							iconWidth: 18,
							width: 170,
							label: constants.VALIDATE_LOGIN_MIGRATION_UNSUCCESSFUL_REVALIDATION,
							enabled: false,
						}).component();

					this._copyButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.copy,
							iconHeight: 18,
							iconWidth: 18,
							width: 140,
							label: constants.VALIDATE_LOGIN_MIGRATION_COPY_RESULTS,
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
							value: constants.VALIDATE_LOGIN_MIGRATION_RESULTS_HEADING,
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

	private _copyValidationResults(): any {
		const errorsText = this._valdiationErrors.join(EOL);
		const msg = errorsText.length === 0
			? constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_COMPLETED
			: constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_COMPLETED_ERRORS(errorsText);
		return vscode.env.clipboard.writeText(msg);
	}

	private async _runUnsuccessfulRevalidation(): Promise<any> {
		try {
			this._startLoader.loading = true;
			this._startButton.enabled = false;
			this._revalidationButton.enabled = false;
			this._cancelButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
			if (!this._model.isLoginMigrationTargetValidated) {
				await this._revalidate();
			}
		} finally {
			this._startLoader.loading = false;
			this._startButton.enabled = true;
			this._revalidationButton.enabled = !this._model.isLoginMigrationTargetValidated;
			this._cancelButton.enabled = false;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = this._model.isLoginMigrationTargetValidated;
			this._dialog!.cancelButton.enabled = !this._model.isLoginMigrationTargetValidated;
		}
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
					constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_STATUS(ValidationStatusLookup[status], errors));
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
						name: "Validation steps",
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
						name: "Status",
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

	private _saveResults(): void {
		const results = this._validationResults();
		this._model._validateLoginMigration = results;
	}

	private _validationResults(): LoginMigrationValidationResult[] {
		return this._validationResult.map(result => {
			const state = result[ValidationResultIndex.state];
			const finalState = this._canceled
				? (state === ValidateLoginMigrationValidationState.Running || state === ValidateLoginMigrationValidationState.Pending)
					? ValidateLoginMigrationValidationState.Canceled
					: state
				: state;
			const errors = result[ValidationResultIndex.errors] ?? [];
			return {
				errors: errors,
				state: finalState,
			};
		});
	}

	private async _runValidation(results?: LoginMigrationValidationResult[]): Promise<void> {
		try {
			this._startLoader.loading = true;
			this._startButton.enabled = false;
			this._revalidationButton.enabled = false;
			this._cancelButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;
			this._dialog!.cancelButton.enabled = true;
			await this._validate();
		} finally {
			this._startLoader.loading = false;
			this._startButton.enabled = true;
			this._revalidationButton.enabled = !this._model.isLoginMigrationTargetValidated;
			this._cancelButton.enabled = false;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = this._model.isLoginMigrationTargetValidated;
			this._dialog!.cancelButton.enabled = !this._model.isLoginMigrationTargetValidated;
		}
	}

	private async _validate(): Promise<void> {
		this._canceled = false;
		await this._initializeResults();
		await this._validateLoginMigration();
		this._saveResults();
	}

	private async _revalidate(): Promise<void> {
		await this._initLoginMigrationResultsForRevalidation();
		await this._validateLoginMigration(true);
		this._saveResults();
	}

	private _formatError(error: Error): Error {
		if (error?.message?.startsWith(HttpStatusCodes.GatewayTimeout)) {
			return {
				name: HttpStatusExceptionCodes.ConnectionTimeoutError,
				message: constants.VALIDATE_LOGIN_MIGRATION_ERROR_GATEWAY_TIMEOUT,
			};
		}
		return error;
	}

	private async _validateLoginMigration(skipSuccessfulSteps: boolean = false): Promise<void> {
		this._logLoginMigrationPreValidationStart()
		let testNumber: number = 0;

		const validate = async (
			validationFunction: any,
			loginList: string[],
			aadDomainName: string,
		): Promise<boolean> => {

			try {
				await this._updateValidateLoginMigrationResults(testNumber, ValidateLoginMigrationValidationState.Running);
				const sourceConnectionString: string = await getSourceConnectionString();
				const targetConnectionString: string = await getTargetConnectionString(
					this._model.targetServerName,
					this._model._targetServerInstance.id,
					this._model._targetUserName,
					this._model._targetPassword,
					this._model._targetPort,
					// for login migration, connect to target Azure SQL with true/true
					// to-do: take as input from the user, should be true/false for DB/MI but true/true for VM
					true /* encryptConnection */,
					true /* trustServerCertificate */);
				const validationFunctionName = validationFunction.name.replace('bound ', '');

				var validationResult = await validationFunction(
					sourceConnectionString,
					targetConnectionString,
					loginList,
					aadDomainName);

				if (validationResult !== undefined) {
					if (Object.keys(validationResult.exceptionMap).length > 0) {
						var errors: any[] = []
						Object.keys(validationResult.exceptionMap).forEach(name => {
							const errorList = validationResult?.exceptionMap[name]
							errorList?.forEach((error: any) =>
								errors.push(constants.GET_LOGIN_MIGRATION_VALIDATION_ERROR(
									validationFunctionName,
									name,
									error)))
						});
						await this._updateValidateLoginMigrationResults(testNumber, ValidateLoginMigrationValidationState.Failed, errors);
					} else {
						await this._updateValidateLoginMigrationResults(testNumber, ValidateLoginMigrationValidationState.Succeeded);
						return true;
					}
				}
			} catch (error) {
				const err = this._formatError(error);
				logError(TelemetryViews.LoginMigrationPreValdationDialog, err.message, error);
				await this._updateValidateLoginMigrationResults(
					testNumber,
					ValidateLoginMigrationValidationState.Failed,
					[constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_RESULT_API_ERROR(err)]);
			}
			return false;
		};

		// validate sys admin permissions
		if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateLoginMigrationValidationState.Succeeded) {
			var loginList: string[] = [];
			var aadDomainName = "";
			if (!await validate(this._model.migrationService.validateSysAdminPermission.bind(this._model.migrationService), loginList, aadDomainName)) {
				this._canceled = true;
				await this._updateValidateLoginMigrationResults(testNumber + 1, ValidateLoginMigrationValidationState.Canceled, [constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_CANCELED]);
				return;
			}
		}

		testNumber++;
		if (this._canceled) {
			await this._updateValidateLoginMigrationResults(testNumber, ValidateLoginMigrationValidationState.Canceled, [constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_CANCELED]);
		}
		// validate Entra ID
		else if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateLoginMigrationValidationState.Succeeded) {
			var loginList: string[] = this._model._loginMigrationModel.loginsForMigration.map(row => row.loginName);
			var aadDomainName = this._model._aadDomainName;
			if (!await validate(this._model.migrationService.validateAADDomainName.bind(this._model.migrationService), loginList, aadDomainName)) {
				this._canceled = true;
				await this._updateValidateLoginMigrationResults(testNumber + 1, ValidateLoginMigrationValidationState.Canceled, [constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_CANCELED]);
				return;
			}
		}

		testNumber++;
		if (this._canceled) {
			await this._updateValidateLoginMigrationResults(testNumber, ValidateLoginMigrationValidationState.Canceled, [constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_CANCELED]);
		}
		// validate user mapping
		else if (!skipSuccessfulSteps || this._validationResult[testNumber][ValidationResultIndex.state] !== ValidateLoginMigrationValidationState.Succeeded) {
			var loginList: string[] = this._model._loginMigrationModel.loginsForMigration.map(row => row.loginName);
			var aadDomainName = this._model._aadDomainName;
			if (!await validate(this._model.migrationService.validateUserMapping.bind(this._model.migrationService), loginList, aadDomainName)) {
				this._canceled = true;
				await this._updateValidateLoginMigrationResults(testNumber + 1, ValidateLoginMigrationValidationState.Canceled, [constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_CANCELED]);
				return;
			}
		}
	}

	private async _updateValidateLoginMigrationResults(row: number, state: ValidateLoginMigrationValidationState, errors: string[] = [], updateTable: boolean = true): Promise<void> {
		if (state === ValidateLoginMigrationValidationState.Canceled) {
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

	private async _updateResults(row: number, state: ValidateLoginMigrationValidationState, errors: string[] = []): Promise<void> {
		const result = this._validationResult[row];
		const status = ValidationStatusLookup[state];
		const statusMsg = state === ValidateLoginMigrationValidationState.Failed && errors.length > 0
			? constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_STATUS_ERROR_COUNT(status, errors.length)
			: status;

		const statusMessage = errors.length > 0
			? constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_STATUS_ERROR(status, errors)
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

	private _getValidationStateImage(state: ValidateLoginMigrationValidationState): azdata.IconPath {
		switch (state) {
			case ValidateLoginMigrationValidationState.Canceled:
				return IconPathHelper.cancel;
			case ValidateLoginMigrationValidationState.Failed:
				return IconPathHelper.error;
			case ValidateLoginMigrationValidationState.Running:
				return IconPathHelper.inProgressMigration;
			case ValidateLoginMigrationValidationState.Succeeded:
				return IconPathHelper.completedMigration;
			case ValidateLoginMigrationValidationState.Pending:
			default:
				return IconPathHelper.notStartedMigration;
		}
	}

	private async _initializeResults(results?: LoginMigrationValidationResult[]): Promise<void> {
		this._valdiationErrors = [];
		this._validationResult = [];

		this._addValidationResult(constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_RESULT_LABEL_SYSADMIN);
		this._addValidationResult(constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_RESULT_LABEL_ENTRAID);
		this._addValidationResult(constants.VALIDATE_LOGIN_MIGRATION_VALIDATION_RESULT_LABEL_USERMAPPING);

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				await this._updateValidateLoginMigrationResults(
					row,
					results[row].state,
					results[row].errors,
					false);
			}
		}

		const data = this._validationResult.map(row => [
			row[ValidationResultIndex.message],
			row[ValidationResultIndex.icon],
			"Pending"]);

		await this._resultsTable.updateProperty('data', data);
	}

	private async _initLoginMigrationResultsForRevalidation(): Promise<void> {
		this._valdiationErrors = [];
		this._canceled = false;
		let testNumber: number = 0;

		this._validationResult.forEach(async element => {
			if (element[ValidationResultIndex.state] !== ValidateLoginMigrationValidationState.Succeeded) {
				await this._updateValidateLoginMigrationResults(testNumber++, ValidateLoginMigrationValidationState.Pending);
			}
			else {
				testNumber++;
			}
		});
	}

	private _addValidationResult(message: string): void {
		this._validationResult.push([
			message,
			<azdata.IconColumnCellValue>{
				icon: IconPathHelper.notStartedMigration,
				title: ValidationStatusLookup[ValidateLoginMigrationValidationState.Pending],
			},
			ValidationStatusLookup[ValidateLoginMigrationValidationState.Pending],
			[],
			ValidateLoginMigrationValidationState.Pending]);
	}

	private _logLoginMigrationPreValidationStart(): void {
		sendSqlMigrationActionEvent(
			TelemetryViews.LoginMigrationSelectorPage,
			TelemetryAction.LoginMigrationPreValidationStarted,
			{
				...getTelemetryProps(this._model),
				'loginsAuthType': this._model._loginMigrationModel.loginsAuthType,
			},
			{
				'numberLogins': this._model._loginMigrationModel.loginsForMigration.length,
			}
		);
	}
}
