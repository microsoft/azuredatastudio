/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { EOL } from 'os';
import { IconPathHelper } from '../../constants/iconPathHelper';

const DialogName = 'MultiStepStatusDialog';

enum MultiStepResultIndex {
	message = 0,
	icon = 1,
	status = 2,
	errors = 3,
	state = 4,
}

export enum MultiStepState {
	Pending = 'Pending',
	Running = 'Running',
	Succeeded = 'Succeeded',
	Failed = 'Failed',
	Canceled = 'Canceled',
}

export interface MultiStepResult {
	stepName: string;
	state: MultiStepState;
	errors: string[];
}

export function GetMultiStepStatusString(state: MultiStepState) {
	switch (state) {
		case MultiStepState.Canceled:
			return constants.VALIDATION_STATE_CANCELED;
		case MultiStepState.Failed:
			return constants.VALIDATION_STATE_FAILED;
		case MultiStepState.Pending:
			return constants.VALIDATION_STATE_PENDING;
		case MultiStepState.Running:
			return constants.VALIDATION_STATE_RUNNING;
		case MultiStepState.Succeeded:
			return constants.VALIDATION_STATE_SUCCEEDED;
		default:
			return ""
	}
}

export class MultiStepStatusDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _resultsTable!: azdata.TableComponent;
	private _startLoader!: azdata.LoadingComponent;
	private _copyButton!: azdata.ButtonComponent;
	private _headingText!: azdata.TextComponent;
	private _results: any[][] = [];
	private _errors: string[] = [];
	private _onClosed: () => void;
	private _areStepsComplete = false;

	constructor(
		onClosed: () => void) {
		this._onClosed = onClosed;
	}

	public async openDialog(dialogTitle: string, results?: MultiStepResult[], areStepsComplete: boolean = false): Promise<void> {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600);
			this._dialog.cancelButton.hidden = true;

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;

			this._areStepsComplete = areStepsComplete;
			return this._loadResults(results);
		}
	}

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => {
								this._onClosed();
							}));

					this._disposables.push(
						dialog.okButton.onClick(
							e => this._onClosed()));

					this._headingText = view.modelBuilder.text()
						.withProps({
							value: constants.RUNNING_MULTI_STEPS_HEADING,
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
						.withItems([this._headingText, this._startLoader], { flex: '0 0 auto' })
						.component();

					this._resultsTable = await this._createResultsTable(view);

					this._copyButton = view.modelBuilder.button()
						.withProps({
							iconPath: IconPathHelper.copy,
							iconHeight: 18,
							iconWidth: 18,
							width: 88,
							label: constants.COPY_RESULTS,
						}).component();

					this._disposables.push(
						this._copyButton.onDidClick(
							async (e) => this._copyResults()));

					const resultsHeading = view.modelBuilder.text()
						.withProps({
							value: constants.MULTI_STEP_RESULTS_HEADING,
							CSSStyles: {
								'font-size': '16px',
								'font-weight': '600',
								'margin': '0px 0px 0px 0px'
							},
						})
						.component();

					const toolbar = view.modelBuilder.toolbarContainer()
						.withToolbarItems([
							{ component: resultsHeading, toolbarSeparatorAfter: true },
							{ component: this._copyButton }])
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
							this._resultsTable,
							toolbar,
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

					dialog.okButton.focused = true;

					await view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private async _loadResults(results?: MultiStepResult[]): Promise<void> {
		if (this._areStepsComplete) {
			this._startLoader.loading = false;
			this._headingText.value = constants.COMPLETED_MULTI_STEPS_HEADING;
		} else {
			this._startLoader.loading = true;
			this._headingText.value = constants.RUNNING_MULTI_STEPS_HEADING;
		}

		await this._initializeResults(results);
	}

	private async _copyResults(): Promise<void> {
		const errorsText = this._errors.join(EOL);
		const msg =
			!this._areStepsComplete ? constants.SOME_STEPS_ARE_STILL_RUNNING :
				errorsText.length === 0 ? constants.ALL_STEPS_SUCCEEDED :
					constants.ALL_STEPS_COMPLETED_ERRORS(errorsText);
		return vscode.env.clipboard.writeText(msg);
	}

	private async _updateResultsInfoBox(text: azdata.InputBoxComponent): Promise<void> {
		const selectedRows: number[] = this._resultsTable.selectedRows ?? [];
		const statusMessages: string[] = [];
		if (selectedRows.length > 0) {
			for (let i = 0; i < selectedRows.length; i++) {
				const row = selectedRows[i];
				const results: any[] = this._results[row];
				const status = results[MultiStepResultIndex.status];
				const errors = results[MultiStepResultIndex.errors];
				statusMessages.push(
					constants.RESULTS_INFO_BOX_STATUS(GetMultiStepStatusString(status), errors));
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
						value: 'step',
						name: constants.STEPS_TITLE,
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
						name: constants.STATUS,
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

	private async _initializeResults(results?: MultiStepResult[]): Promise<void> {
		this._results = [];

		if (results && results.length > 0) {
			for (let row = 0; row < results.length; row++) {
				this._addStepResult(results[row].stepName, results[row].state, results[row].errors);
			}
		}

		await this._updateTable();
	}

	private _addStepResult(message: string, state: MultiStepState, errors: string[] = []): void {
		const status = GetMultiStepStatusString(state);
		const statusMsg = state === MultiStepState.Failed && errors.length > 0
			? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR_COUNT(status, errors.length)
			: status;

		const statusMessage = errors.length > 0
			? constants.VALIDATE_IR_VALIDATION_STATUS_ERROR(status, errors)
			: statusMsg;

		this._results.push([
			message,
			<azdata.IconColumnCellValue>{
				icon: this._getValidationStateImage(state),
				title: statusMessage,
			},
			statusMsg,
			errors,
			state]);

		this._errors.push(...errors);
	}

	private _getValidationStateImage(state: MultiStepState): azdata.IconPath {
		switch (state) {
			case MultiStepState.Canceled:
				return IconPathHelper.cancel;
			case MultiStepState.Failed:
				return IconPathHelper.error;
			case MultiStepState.Running:
				return IconPathHelper.inProgressMigration;
			case MultiStepState.Succeeded:
				return IconPathHelper.completedMigration;
			case MultiStepState.Pending:
			default:
				return IconPathHelper.notStartedMigration;
		}
	}

	private async _updateTable() {
		const data = this._results.map(row => [
			row[MultiStepResultIndex.message],
			row[MultiStepResultIndex.icon],
			row[MultiStepResultIndex.status]]);
		await this._resultsTable.updateProperty('data', data);
	}
}
