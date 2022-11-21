/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { Kind, validateIrDatabaseMigrationSettings, validateIrSqlDatabaseMigrationSettings, ValidationError } from '../../api/azure';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import { EOL } from 'os';
import { IconPathHelper } from '../../constants/iconPathHelper';

const DialogName = 'ValidateIrDialog';

export enum ValidateIrState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

enum Result {
	message = 0,
	icon = 1,
	status = 2,
	errors = 3,
	state = 4,
}

export interface ValidationResult {
	errors: string[];
	state: ValidateIrState;
}

export class ValidateIrDialog {
	private _canceled: boolean = true;
	private _dialog: azdata.window.Dialog | undefined;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _model!: MigrationStateModel;
	private _resultsTable!: azdata.TableComponent;
	private _startLoader!: azdata.LoadingComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _validationResult: any[][] = [];
	private _valdiationErrors: string[] = [];
	private _onClosed: (result: ValidationResult[]) => void;

	constructor(
		model: MigrationStateModel,
		onClosed: (result: ValidationResult[]) => void) {
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
					dialog.okButton.label = 'Done';
					dialog.okButton.position = 'left';
					dialog.okButton.enabled = false;
					dialog.cancelButton.position = 'left';

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => {
								this._canceled = true;
								this._onClosed(
									this._validationResults());
							}));

					this._disposables.push(
						dialog.okButton.onClick(
							e => this._onClosed(
								this._validationResults())));

					const headingText = view.modelBuilder.text()
						.withProps({
							value: 'We are validating the following',
							CSSStyles: {
								'font-size': '13px',
								'font-weight': '400',
								'margin-bottom': '10px',
							},
						})
						.component();

					this._resultsTable = await this._createResultsTable(view);

					const startButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.restartDataCollection,
							iconHeight: 18,
							iconWidth: 18,
							// height: 24,
							width: 100,
							label: 'Start validation',
						}).component();
					this._startLoader = view.modelBuilder.loadingComponent()
						.withItem(startButton)
						.withProps({
							loading: false,
							CSSStyles: {
								'height': '8px',
								'width': '104px',
								'line-height': '14px',
								// 'line-height': '18px',
								'margin': '4px 0',
							}
						})
						.component();


					this._cancelButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.stop,
							iconHeight: 18,
							iconWidth: 18,
							// height: 24,
							width: 100,
							label: 'Stop validation',
							enabled: false,
						}).component();
					this._copyButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.copy,
							iconHeight: 18,
							iconWidth: 18,
							width: 150,
							label: 'Copy validation results',
							enabled: false,
						}).component();

					this._disposables.push(
						startButton.onDidClick(
							async (e) => await this._runValidation()));
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
							{ component: this._startLoader },
							{ component: this._cancelButton },
							{ component: this._copyButton }])
						.component();

					const resultsHeading = view.modelBuilder.text()
						.withProps({
							value: 'Validation step details',
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
							headingText,
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

	private _validationResults(): ValidationResult[] {
		return this._validationResult.map(
			result => {
				const state = result[Result.state];
				const finalState = this._canceled
					? state === ValidateIrState.Running || state === ValidateIrState.Pending
						? ValidateIrState.Canceled
						: state
					: state;
				const errors = result[Result.errors] ?? [];
				return {
					errors: errors,
					state: finalState,
				};
			});
	}

	private async _runValidation(results?: ValidationResult[]): Promise<void> {
		try {
			this._startLoader.loading = true;
			this._cancelButton.enabled = true;
			this._copyButton.enabled = false;
			this._dialog!.okButton.enabled = false;

			if (results && results.length > 0) {
				await this._initializeResults(results);
			} else {
				await this._validate();
			}
		} finally {
			this._startLoader.loading = false;
			this._cancelButton.enabled = false;
			this._copyButton.enabled = true;
			this._dialog!.okButton.enabled = this._valdiationErrors.length === 0;
		}
	}

	private async _copyValidationResults(): Promise<void> {
		const errorsText = this._valdiationErrors.join(EOL);
		const msg = errorsText.length === 0
			? `Validation completed successfully.`
			: `Validation completed with the following error(s):${EOL}${errorsText}`;
		return vscode.env.clipboard.writeText(msg);
	}

	private async _updateResultsInfoBox(text: azdata.InputBoxComponent): Promise<void> {
		const selectedRows: number[] = this._resultsTable.selectedRows ?? [];
		const statusMessages: string[] = [];
		if (selectedRows.length > 0) {
			for (let i = 0; i < selectedRows.length; i++) {
				const row = selectedRows[i];
				const results: any[] = this._validationResult[row];
				const errors = results[Result.errors];
				const status = results[Result.status];
				const msg = errors.length > 0
					? `Validation status: ${status}${EOL}${errors.join(EOL)}`
					: `Validation status: ${status}`;
				statusMessages.push(msg);
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
						name: 'Validation steps',
						type: azdata.ColumnType.text,
						width: 420,
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
						name: 'Status',
						type: azdata.ColumnType.text,
						width: 110,
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
		if (this._model._targetType === MigrationTargetType.SQLDB) {
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

		if (this._model._targetType === MigrationTargetType.SQLDB) {
			await this._validateSqlDbMigration();
		} else {
			await this._validateDatabaseMigration();
		}
	}

	private async _validateDatabaseMigration(): Promise<void> {
		const sqlConnections = await azdata.connection.getConnections();
		const currentConnection = sqlConnections.find(
			value => value.connectionId === this._model.sourceConnectionId);
		const sourceServerName = currentConnection?.serverName!;
		const trustServerCertificate = currentConnection?.options?.trustServerCertificate === true;
		const databaseCount = this._model._databasesForMigration.length;
		const sourceDatabaseName = this._model._databasesForMigration[0];
		const networkShare = this._model._databaseBackup.networkShares[0];
		const startTimer = Date.now();

		try {
			await this._updateValidateIrResults(0, ValidateIrState.Running);
			// valdiate IR is online
			const response = await validateIrDatabaseMigrationSettings(
				this._model,
				sourceServerName,
				trustServerCertificate,
				sourceDatabaseName,
				networkShare,
				true,
				false,
				false,
				false);
			if (response?.errors?.length > 0) {
				const errors = response.errors.map(
					error => this._formatValidationError(
						sourceDatabaseName,
						networkShare.networkShareLocation,
						error));
				await this._updateValidateIrResults(0, ValidateIrState.Failed, errors);
			} else {
				await this._updateValidateIrResults(0, ValidateIrState.Succeeded);
			}
		} catch (error) {
			await this._updateValidateIrResults(0, ValidateIrState.Failed, [this._formatValidationApiError(sourceDatabaseName, error)]);
		} finally {
			console.log(` ** Validate ${this._model._targetType === MigrationTargetType.SQLMI ? Kind.SQLMI : Kind.SQLVM
				} IR response TIME: ${((Date.now() - startTimer) / 1000)} `);
		}
		const startTimer2 = Date.now();
		try {
			await this._updateValidateIrResults(1, ValidateIrState.Running);

			// validate blob container connectivity
			const response = await validateIrDatabaseMigrationSettings(
				this._model,
				sourceServerName,
				trustServerCertificate,
				sourceDatabaseName,
				networkShare,
				false,
				false,
				false,
				true);
			if (response?.errors?.length > 0) {
				const errors = response.errors.map(
					error => this._formatValidationError(
						sourceDatabaseName,
						networkShare.networkShareLocation,
						error));
				await this._updateValidateIrResults(1, ValidateIrState.Failed, errors);
			} else {
				await this._updateValidateIrResults(1, ValidateIrState.Succeeded);
			}
		} catch (error) {
			await this._updateValidateIrResults(1, ValidateIrState.Failed, [this._formatValidationApiError(sourceDatabaseName, error)]);
		} finally {
			console.log(` ** Validate ${this._model._targetType === MigrationTargetType.SQLMI ? Kind.SQLMI : Kind.SQLVM} blob container access response TIME: ${((Date.now() - startTimer2) / 1000)} `);
		}

		for (let i = 0; i < databaseCount; i++) {
			if (this._canceled) {
				await this._updateValidateIrResults(i + 2, ValidateIrState.Canceled, [`Validation check canceled`])
				break;
			}

			const sourceDatabaseName = this._model._databasesForMigration[i];
			const networkShare = this._model._databaseBackup.networkShares[i];
			const startTimer2 = Date.now();
			try {
				await this._updateValidateIrResults(i + 2, ValidateIrState.Running);
				// validate source connectivity
				// validate network share path connectivity
				const response = await validateIrDatabaseMigrationSettings(
					this._model,
					sourceServerName,
					trustServerCertificate,
					sourceDatabaseName,
					networkShare,
					false,
					true,
					true,
					false);
				if (response?.errors?.length > 0) {
					const errors = response.errors.map(
						error => this._formatValidationError(
							sourceDatabaseName,
							networkShare.networkShareLocation,
							error));
					await this._updateValidateIrResults(i + 2, ValidateIrState.Failed, errors);
				} else {
					await this._updateValidateIrResults(i + 2, ValidateIrState.Succeeded);
				}
			} catch (error) {
				await this._updateValidateIrResults(i + 2, ValidateIrState.Failed, [this._formatValidationApiError(sourceDatabaseName, error)]);
			} finally {
				console.log(` ** Validate ${this._model._targetType === MigrationTargetType.SQLMI ? Kind.SQLMI : Kind.SQLVM} no - IR response TIME: ${((Date.now() - startTimer2) / 1000)} `);
			}
		}
	}

	private async _validateSqlDbMigration(): Promise<void> {
		const sqlConnections = await azdata.connection.getConnections();
		const currentConnection = sqlConnections.find(
			value => value.connectionId === this._model.sourceConnectionId);
		const sourceServerName = currentConnection?.serverName!;
		const trustServerCertificate = currentConnection?.options['trustServerCertificate'] === true;
		const databaseCount = this._model._databasesForMigration.length;
		const sourceDatabaseName = this._model._databasesForMigration[0];
		const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';

		// validate IR is online
		await this._updateValidateIrResults(0, ValidateIrState.Running);
		const startTimer = Date.now();
		try {
			const response = await validateIrSqlDatabaseMigrationSettings(
				this._model,
				sourceServerName,
				trustServerCertificate,
				sourceDatabaseName,
				targetDatabaseName,
				true,
				false,
				false);
			if (response?.errors?.length > 0) {
				const errors = response.errors.map(
					error => this._formatSqlDbValidationError(
						sourceDatabaseName,
						targetDatabaseName,
						error));
				await this._updateValidateIrResults(0, ValidateIrState.Failed, errors);
				return;
			} else {
				await this._updateValidateIrResults(0, ValidateIrState.Succeeded);
			}
		} catch (error) {
			await this._updateValidateIrResults(0, ValidateIrState.Failed, [this._formatValidationApiError(sourceDatabaseName, error)]);
			return;
		} finally {
			console.log(` ** validate SQLDB IR response TIME: ${(Date.now() - startTimer) / 1000} `);
		}

		for (let i = 0; i < databaseCount; i++) {
			if (this._canceled) {
				break;
			}

			const sourceDatabaseName = this._model._databasesForMigration[i];
			const targetDatabaseName = this._model._sourceTargetMapping.get(sourceDatabaseName)?.databaseName ?? '';
			await this._updateValidateIrResults(i + 1, ValidateIrState.Running);
			const startTimer2 = Date.now();
			try {
				// validate source connectivity
				// validate target connectivity
				const response = await validateIrSqlDatabaseMigrationSettings(
					this._model,
					sourceServerName,
					trustServerCertificate,
					sourceDatabaseName,
					targetDatabaseName,
					false,
					true,
					true);
				if (response?.errors?.length > 0) {
					const errors = response.errors.map(
						error => this._formatSqlDbValidationError(
							sourceDatabaseName,
							targetDatabaseName,
							error));

					await this._updateValidateIrResults(i + 1, ValidateIrState.Failed, errors);
				} else {
					await this._updateValidateIrResults(i + 1, ValidateIrState.Succeeded);
				}
			} catch (error) {
				await this._updateValidateIrResults(i + 1, ValidateIrState.Failed, [this._formatValidationApiError(sourceDatabaseName, error)]);
			} finally {
				console.log(` ** validate SQLDB no - IR response TIME: ${(Date.now() - startTimer2) / 1000} `);
			}
		}
	}

	private async _initTestIrResults(results?: ValidationResult[]): Promise<void> {
		this._validationResult = [];

		this._addValidationResult('Validating SHIR connectivity');
		this._addValidationResult('Validating Azure storage connectivity');

		this._model._databasesForMigration
			.forEach(sourceDatabaseName =>
				this._addValidationResult(`Database configuration '${sourceDatabaseName}'`));

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				await this._updateValidateIrResults(
					row,
					results[row].state,
					results[row].errors,
					false);
			}
		}

		const data = this._validationResult.map(row => [row[Result.message], row[Result.icon], row[Result.status]]);
		await this._resultsTable.updateProperty('data', data);
	}

	private async _initSqlDbIrResults(results?: ValidationResult[]): Promise<void> {
		this._validationResult = [];
		this._addValidationResult('Validating SHIR connectivity');

		this._model._databasesForMigration
			.forEach(sourceDatabaseName =>
				this._addValidationResult(`Validating database '${sourceDatabaseName}' configration`));

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				await this._updateValidateIrResults(
					row,
					results[row].state,
					results[row].errors,
					false);
			}
		}

		const data = this._validationResult.map(row => [row[Result.message], row[Result.icon], row[Result.status]]);
		await this._resultsTable.updateProperty('data', data);
	}

	private _addValidationResult(message: string): void {
		this._validationResult.push([
			message,
			<azdata.IconColumnCellValue>{
				icon: IconPathHelper.notStartedMigration,
				title: ValidateIrState.Pending,
			},
			ValidateIrState.Pending,
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
			const data = this._validationResult.map(row => [row[Result.message], row[Result.icon], row[Result.status]]);
			await this._resultsTable.updateProperty('data', data);
		}

		this._valdiationErrors.push(...errors);
	}

	private async _updateResults(row: number, state: ValidateIrState, errors: string[] = []): Promise<void> {
		const result = this._validationResult[row];
		const statusMsg = state === ValidateIrState.Failed && errors.length > 0
			? `${state.toString()} - error(s) ${errors.length} `
			: state.toString();

		const statusMessage = errors.length > 0
			? `${statusMsg}${EOL}${errors.join(EOL)} `
			: statusMsg;

		this._validationResult[row] = [
			result[Result.message],
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

	private _formatValidationApiError(sourceDatabaseName: string, error: Error): string {
		const message = `Validation check error${EOL}Database:${sourceDatabaseName}${EOL} Error: ${error.name}${EOL}${error.message} `;
		console.log(` ** validation error:  ${message} `);
		return message;
	}

	private _formatValidationError(sourceDatabaseName: string, networkShareLocation: string, error: ValidationError): string {
		const message = `Validation check error${EOL}Source database: ${sourceDatabaseName}${EOL}File share path: ${networkShareLocation}${EOL} Error: ${error.code}${EOL}${error.message} `;
		console.log(` ** validation error:  ${message} `);
		return message;
	}

	private _formatSqlDbValidationError(sourceDatabaseName: string, targetDatabaseName: string, error: ValidationError,): string {
		const message = `Validation check error${EOL}Source database: ${sourceDatabaseName}${EOL}Target database: ${targetDatabaseName}${EOL} Error: ${error.code}${EOL}${error.message} `;
		console.log(` ** validation error:  ${message} `);
		return message;
	}
}
