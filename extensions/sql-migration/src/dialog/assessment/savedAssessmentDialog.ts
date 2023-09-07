/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../constants/strings';
import { MigrationStateModel } from '../../models/stateMachine';
import { WizardController } from '../../wizard/wizardController';
import * as styles from '../../constants/styles';
import { ServiceContextChangeEvent } from '../../dashboard/tabBase';

export class SavedAssessmentDialog {

	private static readonly OkButtonText: string = constants.NEXT_LABEL;
	private static readonly CancelButtonText: string = constants.CANCEL_LABEL;

	private dialog: azdata.window.Dialog | undefined;
	private stateModel: MigrationStateModel;
	private context: vscode.ExtensionContext;
	private _serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>;
	private _disposables: vscode.Disposable[] = [];
	private _isOpen: boolean = false;
	private _rootContainer!: azdata.FlexContainer;

	constructor(
		context: vscode.ExtensionContext,
		stateModel: MigrationStateModel,
		serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>) {
		this.stateModel = stateModel;
		this.context = context;
		this._serviceContextChangedEvent = serviceContextChangedEvent;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					this._rootContainer = this.initializePageContent(view);
					await view.initializeModel(this._rootContainer);
					this._disposables.push(
						dialog.okButton.onClick(
							async e => await this.execute()));

					this._disposables.push(
						dialog.cancelButton.onClick(
							e => this.cancel()));
					this._disposables.push(
						view.onClosed(
							e => this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					resolve();
				} catch (ex) {
					reject(ex);
				}
			});

			dialog.registerCloseValidator(async () => {
				if (this.stateModel.resumeAssessment) {
					if (!this.stateModel.loadSavedInfo()) {
						void vscode.window.showInformationMessage(constants.OPEN_SAVED_INFO_ERROR);
						return false;
					}
				}
				return true;
			});
		});
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(constants.SAVED_ASSESSMENT_RESULT, constants.SAVED_ASSESSMENT_RESULT, '60%');
			this.dialog.okButton.label = SavedAssessmentDialog.OkButtonText;
			this.dialog.okButton.position = 'left';
			this.dialog.cancelButton.label = SavedAssessmentDialog.CancelButtonText;
			this.dialog.cancelButton.position = 'left';

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		const wizardController = new WizardController(
			this.context,
			this.stateModel,
			this._serviceContextChangedEvent);

		await wizardController.openWizard();
		this._isOpen = false;
	}

	protected cancel() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public initializePageContent(view: azdata.ModelView): azdata.FlexContainer {
		const buttonGroup = 'resumeMigration';

		const radioStart = view.modelBuilder.radioButton()
			.withProps({
				label: constants.START_NEW_SESSION,
				name: buttonGroup,
				CSSStyles: { ...styles.BODY_CSS, 'margin-bottom': '8px' },
				checked: true
			}).component();

		this._disposables.push(
			radioStart.onDidChangeCheckedState(checked => {
				if (checked) {
					this.stateModel.resumeAssessment = false;
				}
			}));
		const radioContinue = view.modelBuilder.radioButton()
			.withProps({
				label: constants.RESUME_SESSION,
				name: buttonGroup,
				CSSStyles: { ...styles.BODY_CSS },
				checked: false
			}).component();

		this._disposables.push(
			radioContinue.onDidChangeCheckedState(checked => {
				if (checked) {
					this.stateModel.resumeAssessment = true;
				}
			}));

		const chartConfig: azdata.BarChartConfiguration = {
			chartTitle: 'Test Chart Please Ignore',
			datasets: [
				{
					data: [2, 3, 4],
					backgroundColor: '#FFFF88',
					borderColor: '#FFFF00',
					seriesLabel: 'by one'
				},
				{
					data: [3.5, 4, 4.5],
					backgroundColor: '#88FFFF',
					borderColor: '#00FFFF',
					seriesLabel: 'by half'
				},
				{
					data: [1, 3, 5],
					backgroundColor: '#FF88FF',
					borderColor: '#FF00FF',
					seriesLabel: 'by two'
				}
			],
			// only data that aligns with a label is shown.  If fewer labels than data, then data is truncated; if more labels than data, then there's an empty entry
			labels: ['uno', 'dos', 'tres', 'quatro'],
			options: {
				scales: {
					x: {
						max: 8
					}
				}
			}
		};

		const chart = view.modelBuilder.chart<azdata.BarChartProperties>()
			.withProps({
				chartType: 'bar',
				chartConfig: {
					datasets: [{
						datasetLabel: 'First',
						data: [
							{
								value: 1,
								xLabel: 'Mon'
							},
							{
								value: 2,
								xLabel: 'Tue'
							},
							{
								value: 3,
								xLabel: 'Wed'
							},
						]
					},
					{
						datasetLabel: 'Second',
						data: [
							{
								value: 6,
								xLabel: 'Mon'
							},
							{
								value: 7,
								xLabel: 'Tue'
							},
							{
								value: 8,
								xLabel: 'Wed'
							},
						]
					}],
					options: {
						scales: {
							x: {
								max: 8
							}
						}
					}
				},
				configuration: chartConfig
			}).component();

		const flex = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column', })
			.withProps({ CSSStyles: { 'padding': '20px 15px', } })
			.component();
		flex.addItem(radioStart, { flex: '0 0 auto' });
		flex.addItem(radioContinue, { flex: '0 0 auto' });
		flex.addItem(chart, { flex: '0 0 auto' });

		return flex;
	}
}
