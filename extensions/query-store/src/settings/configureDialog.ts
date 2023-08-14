/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { isNullOrUndefined } from 'util';

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class ConfigureDialog {
	public dialog: azdata.window.Dialog;
	private configureTab: azdata.window.DialogTab;
	private toDispose: vscode.Disposable[] = [];
	private executionCountRadioButton?: azdata.RadioButtonComponent;
	private durationRadioButton?: azdata.RadioButtonComponent;
	private CPUTimeRadioButton?: azdata.RadioButtonComponent;
	private logicalReadsRadioButton?: azdata.RadioButtonComponent;
	private logicalWritesRadioButton?: azdata.RadioButtonComponent;
	private physicalReadsRadioButton?: azdata.RadioButtonComponent;
	private CLRTimeRadioButton?: azdata.RadioButtonComponent;
	private DOPRadioButton?: azdata.RadioButtonComponent;
	private memoryConsumptionRadioButton?: azdata.RadioButtonComponent;
	private rowCountRadioButton?: azdata.RadioButtonComponent;
	private logMemoryUsedRadioButton?: azdata.RadioButtonComponent;
	private tempDBMermoryUsedRadioButton?: azdata.RadioButtonComponent;
	private waitTimeRadioButton?: azdata.RadioButtonComponent;
	private consumptionCriteriaComponent?: azdata.FormComponent<azdata.Component>;
	private formBuilder?: azdata.FormBuilder;
	private formModel?: azdata.FormContainer;
	/*private criteriaBasisAvgRadioButton: azdata.RadioButtonComponent;
	private criteriaBasisMaxRadioButton: azdata.RadioButtonComponent;
	private criteriaBasisMinRadioButton: azdata.RadioButtonComponent;
	private criteriaBasisStdDevRadioButton: azdata.RadioButtonComponent;
	private criteriaBasisTotalRadioButton: azdata.RadioButtonComponent;*/
	private executionCountCheckBox?: azdata.CheckBoxComponent;
	private durationCheckBox?: azdata.CheckBoxComponent;
	private CPUTimeCheckBox?: azdata.CheckBoxComponent;
	private logicalReadsCheckBox?: azdata.CheckBoxComponent;
	private logicalWritesCheckBox?: azdata.CheckBoxComponent;
	private physicalReadsCheckBox?: azdata.CheckBoxComponent;
	private CLRTimeCheckBox?: azdata.CheckBoxComponent;
	private DOPCheckBox?: azdata.CheckBoxComponent;
	private memoryConsumptionCheckBox?: azdata.CheckBoxComponent;
	private rowCountCheckBox?: azdata.CheckBoxComponent;
	private showChartComponent?: azdata.FormComponent<azdata.Component>;
	private timeIntervalOptionsDropdown?: azdata.DropDownComponent;
	private customTimeFromTextBox?: azdata.InputBoxComponent;
	private customTimeToTextBox?: azdata.InputBoxComponent;
	private localTimeFormatRadioButton?: azdata.RadioButtonComponent;
	private UTCTimeFormatRadioButton?: azdata.RadioButtonComponent;
	private timeIntervalComponent?: azdata.FormComponent<azdata.Component>;
	private initDialogComplete?: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });


	/*private timeIntervalDropdown: azdata.DropDownComponent;
	private timeIntervalCustomFromInputBox: azdata.InputBoxComponent;
	private timeIntervalCustomToInputBox: azdata.InputBoxComponent;
	private timeIntervalAggregationDropdown: azdata.DropDownComponent;
	private timeIntervalFormatRadioButton: azdata.RadioButtonComponent;
	private timeIntervalHistoryDropdown: azdata.DropDownComponent;
	private timeIntervalHistoryFromInputBox: azdata.InputBoxComponent;
	private timeIntervalHistoryToInputBox: azdata.InputBoxComponent;
	private timeIntervalAutoRefreshInputBox: azdata.InputBoxComponent;
	private returnDataRadioButton: azdata.RadioButtonComponent;
	private returnDataInputBox: azdata.InputBoxComponent;
	private filtersInputBox: azdata.InputBoxComponent;
	private showChartCheckbox: azdata.CheckBoxComponent;
	private yAxisColumnDropdown: azdata.DropDownComponent;
	private queryToTrackInputBox: azdata.InputBoxComponent;
*/
	constructor(private _view: azdata.ModelView) {
		this.dialog = azdata.window.createModelViewDialog(constants.configure);
		this.configureTab = azdata.window.createTab(constants.configure);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	async validate(): Promise<boolean> {
		return true;
	}

	public async openDialog(): Promise<void> {
		await this.initializeDialog();

		this.dialog.okButton.label = constants.okButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => { }));		// TODO: Add return of settings change to appropriate query report

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	protected async initializeDialog(): Promise<void> {
		await this.initializeConfigureTab();
		this.dialog.content = [this.configureTab];
	}

	private async initializeConfigureTab(): Promise<void> {
		this.configureTab.registerContent(async view => {
			if (isNullOrUndefined(this._view)) {
				this._view = view;
			}

			this.consumptionCriteriaComponent = await this.createConsumptionCriteriaComponent();
			this.showChartComponent = this.createShowChartComponent();
			this.timeIntervalComponent = this.createTimeIntervalComponent();
			console.log("initializeConfigureTab:", this.consumptionCriteriaComponent.component);
			this.formBuilder = <azdata.FormBuilder>this._view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: constants.resourceConsumptionCriteriaTitle,
						components: [this.consumptionCriteriaComponent]
					}
				], {
					horizontal: true
				})
				.withLayout({
					width: '100%',
					//padding: '10px 10px 0 30px'
				});

			this.formModel = this.formBuilder.component();
			await this._view.initializeModel(this.formModel);
			console.log("initializeConfigureTab22222:", this.consumptionCriteriaComponent.component);
			this.initDialogComplete!.resolve();
			console.log("initializeConfigureTab33333:");
		});
		console.log("initializeConfigureTab44444:");
	}

	protected async cancel(): Promise<void> {
		this.dispose();
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private async createConsumptionCriteriaComponent(): Promise<azdata.FormComponent> {
		this.executionCountRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.executionCountLabel
			}).component();

		this.durationRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.durationLabel
			}).component();

		this.CPUTimeRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.CPUTimeLabel
			}).component();

		this.logicalReadsRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.logicalReadsLabel
			}).component();

		this.logicalWritesRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.logicalWritesLabel
			}).component();

		this.physicalReadsRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.physicalReadsLabel
			}).component();

		this.CLRTimeRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.CLRTimeLabel
			}).component();

		this.DOPRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.DOPLabel
			}).component();

		this.memoryConsumptionRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.memoryConsumptionLabel
			}).component();

		this.rowCountRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.rowCountLabel
			}).component();

		this.logMemoryUsedRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.logMemoryUsedLabel
			}).component();

		this.tempDBMermoryUsedRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.tempDBMermoryUsedLabel
			}).component();

		this.waitTimeRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.criteria,
				label: constants.waitTimeLabel
			}).component();

		this.durationRadioButton.checked = true;
		await this.durationRadioButton.focus();

		let criteriaRadioButtons = [this.executionCountRadioButton, this.durationRadioButton, this.CPUTimeRadioButton, this.logicalReadsRadioButton, this.logicalWritesRadioButton, this.physicalReadsRadioButton,
		this.CLRTimeRadioButton, this.DOPRadioButton, this.memoryConsumptionRadioButton, this.rowCountRadioButton, this.logMemoryUsedRadioButton, this.tempDBMermoryUsedRadioButton, this.waitTimeRadioButton];

		/*if (this._callerReport === Reports.OverallResourceConsumption) {
			criteriaRadioButtons.push(this.waitTimeRadioButton);
		}*/

		let flexRadioButtonsModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(criteriaRadioButtons)
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: constants.topConsumersRadioButtonsLabel
		};
	}

	private createShowChartComponent(): azdata.FormComponent {
		this.executionCountCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.durationCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.CPUTimeCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.logicalReadsCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.logicalWritesCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.physicalReadsCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.CLRTimeCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.DOPCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.memoryConsumptionCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.rowCountCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.executionCountCheckBox.checked = true;
		this.durationCheckBox.checked = true;
		this.CPUTimeCheckBox.checked = true;
		this.logicalReadsCheckBox.checked = true;

		const showChartCheckBoxes = [this.executionCountCheckBox, this.durationCheckBox, this.CPUTimeCheckBox, this.logicalReadsCheckBox, this.logicalWritesCheckBox, this.physicalReadsCheckBox,
		this.CLRTimeCheckBox, this.DOPCheckBox, this.memoryConsumptionCheckBox, this.rowCountCheckBox];

		const flexCheckBoxesModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(showChartCheckBoxes)
			.withProps({ ariaRole: 'checkBoxgroup' })
			.component();

		return {
			component: flexCheckBoxesModel,
			title: constants.showChartTitle
		};
	}

	private createTimeIntervalComponent(): azdata.FormComponent {
		let timeIntervalOptions = [constants.last5MinsLabel, constants.last15MinsLabel, constants.last30MinsLabel, constants.lastHourLabel, constants.last12HoursLabel, constants.lastDayLabel, constants.last2DaysLabel,
		constants.lastWeekLabel, constants.last2WeeksLabel, constants.lastMonthLabel, constants.last3MonthsLabel, constants.last6MonthsLabel, constants.lastYearLabel, constants.customLabel];

		this.timeIntervalOptionsDropdown = this._view.modelBuilder.dropDown().withProps({
			editable: false,
			fireOnTextChange: true,
			values: timeIntervalOptions,
			value: constants.lastHourLabel
		}).component();

		this.timeIntervalOptionsDropdown.onValueChanged(async (value) => {
			if (value === constants.customLabel) {
				this.customTimeFromTextBox!.enabled = true;
				this.customTimeToTextBox!.enabled = true;
			}
		});

		this.customTimeFromTextBox = this._view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.fromLabel,
			placeHolder: constants.fromLabel,
			value: '5/15/2023 11:58 AM',
			enabled: false
		}).component();

		this.customTimeToTextBox = this._view.modelBuilder.inputBox().withProps({
			ariaLabel: constants.toLabel,
			placeHolder: constants.toLabel,
			value: '5/23/2023 11:58 AM',
			enabled: false
		}).component();

		this.localTimeFormatRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.localLabel,
				label: constants.timeFormatLabel
			}).component();

		this.UTCTimeFormatRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.UTCLabel,
				label: constants.timeFormatLabel
			}).component();

		const timeFormatLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.timeFormatLabel
			}).component();

		const timIntervalModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.timeIntervalOptionsDropdown, this.customTimeFromTextBox, this.customTimeToTextBox, timeFormatLabel, this.localTimeFormatRadioButton, this.UTCTimeFormatRadioButton])
			.withProps({ ariaRole: 'checkBoxgroup' })
			.component();

		return {
			component: timIntervalModel,
			title: constants.timeIntervalLabel
		};
	}

	public async addConsumptionCriteriaComponent() {
		//await this.openDialog();
		console.log("addConsumptionCriteriaComponent:", this.consumptionCriteriaComponent!.title);
		/*let formBuilder = <azdata.FormBuilder>this._view.modelBuilder.formContainer()
			.withFormItems([
				{
					title: constants.resourceConsumptionCriteriaTitle,
					components: [this.consumptionCriteriaComponent]
				}/*, {
			title: loc.TargetTitle,
			components: targetComponents
		}
			], {
				horizontal: true,
				//titleFontSize: titleFontSize
			})
			.withLayout({
				width: '100%',
				//padding: '10px 10px 0 30px'
			});

		let formModel = formBuilder.component();
		await this._view.initializeModel(formModel);*/
		//this.formBuilder.removeFormItem(this.consumptionCriteriaComponent);
		//this.formBuilder.addFormItem(this.consumptionCriteriaComponent);
		console.log("addConsumptionCriteriaComponent2:", this.consumptionCriteriaComponent!.title);
		//this.formBuilder.insertFormItem(this.consumptionCriteriaComponent);//, 1/*, { horizontal: true, titleFontSize: titleFontSize }*/);
		//this.initDialogComplete.resolve();
	}

	public async addShowChartComponent() {
		this.formBuilder!.addFormItem(this.showChartComponent!);
	}

	public async addTimeIntervalComponent() {
		this.formBuilder!.addFormItem(this.timeIntervalComponent!);
	}
}
