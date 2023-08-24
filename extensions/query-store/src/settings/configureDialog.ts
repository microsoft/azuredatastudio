/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../common/constants';
import { cssStyles } from '../common/uiConstants';
import { ConfigComponentsInfo } from '../common/utils';

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class ConfigureDialog {
	private _view!: azdata.ModelView
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
	private criteriaRadioButtons?: azdata.RadioButtonComponent[]
	private formBuilder?: azdata.FormBuilder;
	private formModel?: azdata.FormContainer;
	private criteriaBasisAvgRadioButton?: azdata.RadioButtonComponent;
	private criteriaBasisMaxRadioButton?: azdata.RadioButtonComponent;
	private criteriaBasisMinRadioButton?: azdata.RadioButtonComponent;
	private criteriaBasisStdDevRadioButton?: azdata.RadioButtonComponent;
	private criteriaBasisTotalRadioButton?: azdata.RadioButtonComponent;
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
	private aggregationSizeComponent?: azdata.FlexContainer;
	private timeIntervalOptions?: string[];
	private returnDataAllRadioButton?: azdata.RadioButtonComponent;
	private returnDataTopRadioButton?: azdata.RadioButtonComponent;
	private returnDataTopInputBox?: azdata.InputBoxComponent;
	private returnComponent?: azdata.FormComponent<azdata.Component>;
	private filtersInputBox?: azdata.InputBoxComponent;
	private filterComponent?: azdata.FormComponent<azdata.Component>;
	private initDialogComplete?: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	constructor() {
		this.dialog = azdata.window.createModelViewDialog(constants.configure);
		this.configureTab = azdata.window.createTab(constants.configure);
		this.dialog.registerCloseValidator(async () => {
			return this.validate();
		});
	}

	async validate(): Promise<boolean> {
		return true;
	}

	public async openDialog(configComponentsInfo: ConfigComponentsInfo[]): Promise<void> {
		await this.initializeDialog(configComponentsInfo);

		this.dialog.okButton.label = constants.okButtonText;
		this.dialog.okButton.enabled = false;
		this.toDispose.push(this.dialog.okButton.onClick(async () => { this.dispose(); }));		// TODO: Add return of settings change and functionality to enable OK Button

		this.dialog.cancelButton.label = constants.cancelButtonText;
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	protected async initializeDialog(configComponentsInfo: ConfigComponentsInfo[]): Promise<void> {
		await this.initializeConfigureTab(configComponentsInfo);
		this.dialog.content = [this.configureTab];
	}

	private async initializeConfigureTab(configComponentsInfo: ConfigComponentsInfo[]): Promise<void> {
		this.configureTab.registerContent(async view => {
			this._view = view;
			let componentGroups: azdata.GroupContainer[] = [];

			if (configComponentsInfo.includes(ConfigComponentsInfo.consumptionCriteriaComponentTopResource)) {
				const consumptionCriteriaComponent = await this.createCriteriaComponent(true);
				const basedOnCriteriaComponent = this.createCriteriaBasedOnComponent();
				const typeGroup = this.createGroup(constants.topConsumersRadioButtonsLabel, [consumptionCriteriaComponent.component, basedOnCriteriaComponent.component]);
				componentGroups.push(typeGroup);
			}

			if (configComponentsInfo.includes(ConfigComponentsInfo.chartComponent)) {
				this.showChartComponent = this.createShowChartComponent();
				const typeGroup = this.createGroup(constants.showChartTitle, [this.showChartComponent.component]);
				componentGroups.push(typeGroup);
			}

			if (configComponentsInfo.includes(ConfigComponentsInfo.timeIntervalComponent)) {
				this.timeIntervalComponent = this.createTimeIntervalComponent();
				const typeGroup = this.createGroup(constants.timeIntervalLabel, [this.timeIntervalComponent.component]);
				componentGroups.push(typeGroup);
			}

			if (configComponentsInfo.includes(ConfigComponentsInfo.timeIntervalComponentOverallResource)) {
				this.timeIntervalComponent = this.createTimeIntervalComponent(true);
				const typeGroup = this.createGroup(constants.timeIntervalLabel, [this.timeIntervalComponent.component]);
				componentGroups.push(typeGroup);
			}

			if (configComponentsInfo.includes(ConfigComponentsInfo.returnComponent)) {
				this.returnComponent = this.createReturnComponent();
				const typeGroup = this.createGroup(constants.returnLabel, [this.returnComponent.component]);
				componentGroups.push(typeGroup);
			}

			if (configComponentsInfo.includes(ConfigComponentsInfo.filterComponent)) {
				this.filterComponent = this.createFilterComponent();
				const typeGroup = this.createGroup(constants.filterLabel, [this.filterComponent.component]);
				componentGroups.push(typeGroup);
			}

			const divContainer = this._view.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
				CSSStyles: { 'padding': '10px' }
			}).withItems(componentGroups).component();

			this.formBuilder = <azdata.FormBuilder>this._view.modelBuilder.flexContainer()
				.withItems([divContainer])
				.withLayout({
					width: '100%',
					flexFlow: 'column'
				});

			this.formModel = this.formBuilder!.component();
			await this._view.initializeModel(this.formModel!);
			this.initDialogComplete!.resolve();
		});
	}

	protected async cancel(): Promise<void> {
		this.dispose();
	}

	private dispose(): void {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	protected createGroup(header: string, items: azdata.Component[], collapsible: boolean = true, collapsed: boolean = false): azdata.GroupContainer {
		return this._view.modelBuilder.groupContainer()
			.withLayout({
				header: header,
				collapsible: collapsible,
				collapsed: collapsed
			}).withItems(items).component();
	}

	private async createCriteriaComponent(isTopResourceReport: boolean = false): Promise<azdata.FormComponent> {
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

		this.criteriaRadioButtons = [this.executionCountRadioButton, this.durationRadioButton, this.CPUTimeRadioButton, this.logicalReadsRadioButton, this.logicalWritesRadioButton, this.physicalReadsRadioButton,
		this.CLRTimeRadioButton, this.DOPRadioButton, this.memoryConsumptionRadioButton, this.rowCountRadioButton, this.logMemoryUsedRadioButton, this.tempDBMermoryUsedRadioButton, this.waitTimeRadioButton];

		if (isTopResourceReport) {
			this.criteriaRadioButtons.unshift(this.executionCountRadioButton);
		}

		let flexRadioButtonsModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(this.criteriaRadioButtons)
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel
		};
	}

	private createCriteriaBasedOnComponent(): azdata.FormComponent {
		this.criteriaBasisAvgRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.basedOnLabel,
				label: constants.avgLabel
			}).component();

		this.criteriaBasisMaxRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.basedOnLabel,
				label: constants.maxLabel
			}).component();

		this.criteriaBasisMinRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.basedOnLabel,
				label: constants.minLabel
			}).component();

		this.criteriaBasisStdDevRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.basedOnLabel,
				label: constants.stdDevLabel
			}).component();

		this.criteriaBasisTotalRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.basedOnLabel,
				label: constants.totalLabel
			}).component();

		const basedOnLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.basedOnLabel
			}).component();

		this.criteriaBasisTotalRadioButton.checked = true;

		let flexRadioButtonsModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([basedOnLabel, this.criteriaBasisAvgRadioButton, this.criteriaBasisMaxRadioButton, this.criteriaBasisMinRadioButton, this.criteriaBasisStdDevRadioButton, this.criteriaBasisTotalRadioButton])
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel
		};
	}

	private createShowChartComponent(): azdata.FormComponent {
		this.executionCountCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.executionCountLabel
			}).component();

		this.durationCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.durationLabel
			}).component();

		this.CPUTimeCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.CPUTimeLabel
			}).component();

		this.logicalReadsCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.logicalReadsLabel
			}).component();

		this.logicalWritesCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.logicalWritesLabel
			}).component();

		this.physicalReadsCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.physicalReadsLabel
			}).component();

		this.CLRTimeCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.CLRTimeLabel
			}).component();

		this.DOPCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.DOPLabel
			}).component();

		this.memoryConsumptionCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.memoryConsumptionLabel
			}).component();

		this.rowCountCheckBox = this._view.modelBuilder.checkBox()
			.withProps({
				label: constants.rowCountLabel
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

	private createTimeIntervalComponent(isOverallResourceReport: boolean = false): azdata.FormComponent {
		let value;
		if (isOverallResourceReport) {
			this.timeIntervalOptions = [constants.lastHourLabel, constants.lastDayLabel, constants.last2DaysLabel, constants.lastWeekLabel, constants.lastMonthLabel, constants.last6MonthsLabel, constants.lastYearLabel, constants.customLabel];
			value = constants.lastMonthLabel;
		} else {
			this.timeIntervalOptions = [constants.last5MinsLabel, constants.last15MinsLabel, constants.last30MinsLabel, constants.lastHourLabel, constants.last12HoursLabel, constants.lastDayLabel, constants.last2DaysLabel,
			constants.lastWeekLabel, constants.last2WeeksLabel, constants.lastMonthLabel, constants.last3MonthsLabel, constants.last6MonthsLabel, constants.lastYearLabel, constants.customLabel];
			value = constants.last5MinsLabel;
		}

		this.timeIntervalOptionsDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				width: cssStyles.configureDialogDropdownWidth,
				editable: false,
				fireOnTextChange: true,
				values: this.timeIntervalOptions,
				value: value
			}).component();

		this.timeIntervalOptionsDropdown.onValueChanged(async () => {
			if (this.timeIntervalOptionsDropdown?.value === constants.customLabel) {
				this.customTimeFromTextBox!.enabled = true;
				await this.customTimeFromTextBox?.updateProperties({
					value: '5/15/2023 11:58 AM'		// TODO: Remove the hardcoded value
				});

				this.customTimeToTextBox!.enabled = true;
				await this.customTimeToTextBox?.updateProperties({
					value: '5/23/2023 11:58 AM'		// TODO: Removed the hardcode value
				});
			} else {
				this.customTimeFromTextBox!.enabled = false;
				await this.customTimeFromTextBox?.updateProperties({
					value: ''
				});

				this.customTimeToTextBox!.enabled = false;
				await this.customTimeToTextBox?.updateProperties({
					value: ''
				});
			}
		});

		const customTimeFromLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.fromLabel,
				width: cssStyles.configureDialogLabelWidth
			}).component();

		this.customTimeFromTextBox = this._view.modelBuilder.inputBox()
			.withProps({
				ariaLabel: constants.fromLabel,
				width: cssStyles.configureDialogTextboxWidth,
				enabled: false
			}).component();

		const customTimeToLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.toLabel,
				width: cssStyles.configureDialogLabelWidth
			}).component();

		this.customTimeToTextBox = this._view.modelBuilder.inputBox()
			.withProps({
				ariaLabel: constants.toLabel,
				width: cssStyles.configureDialogTextboxWidth,
				enabled: false
			}).component();

		this.localTimeFormatRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.localLabel,
				label: constants.localLabel
			}).component();

		this.UTCTimeFormatRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.UTCLabel,
				label: constants.UTCLabel
			}).component();

		const timeFormatLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.timeFormatLabel
			}).component();

		this.localTimeFormatRadioButton.checked = true;

		const aggregationSizeDropdown = this._view.modelBuilder.dropDown()
			.withProps({
				editable: false,
				fireOnTextChange: true,
				values: [constants.minuteLabel, constants.hourLabel, constants.dayLabel, constants.automaticLabel],
				value: constants.automaticLabel,
				width: cssStyles.configureDialogDropdownWidth
			}).component();

		const aggregationSizeLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.aggregationSizeLabel
			}).component();

		const timeIntervalFromRow = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([customTimeFromLabel, this.customTimeFromTextBox])
			.component();

		const timeIntervalToRow = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([customTimeToLabel, this.customTimeToTextBox])
			.component();

		const timeIntervalComponent = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.timeIntervalOptionsDropdown, timeIntervalFromRow, timeIntervalToRow])
			.withProps({ ariaRole: 'timeIntervalGroup' })
			.component();

		const timeFormatRow = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([timeFormatLabel, this.localTimeFormatRadioButton, this.UTCTimeFormatRadioButton])
			.withProps({ ariaRole: 'timeFormatGroup' })
			.component();

		this.aggregationSizeComponent = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([aggregationSizeLabel, aggregationSizeDropdown])
			.withProps({ ariaRole: 'aggregationSizeGroup' })
			.component();

		let items;
		if (isOverallResourceReport) {
			items = [timeIntervalComponent, this.aggregationSizeComponent, timeFormatRow];
		} else {
			items = [timeIntervalComponent, timeFormatRow];
		}

		const timeIntervalModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems(items)
			.withProps({ ariaRole: 'timeIntervalGroup' })
			.component();

		return {
			component: timeIntervalModel,
			title: constants.timeIntervalLabel
		};
	}

	private createReturnComponent(): azdata.FormComponent {
		this.returnDataAllRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.returnLabel,
				label: constants.allLabel
			}).component();

		this.returnDataTopRadioButton = this._view.modelBuilder.radioButton()
			.withProps({
				name: constants.returnLabel,
				label: constants.topLabel
			}).component();

		this.returnDataTopRadioButton.checked = true;

		this.returnDataAllRadioButton.onDidChangeCheckedState((checked) => {
			if (checked) {
				this.returnDataTopInputBox!.enabled = false;
			} else {
				this.returnDataTopInputBox!.enabled = true;
			}
		});

		this.returnDataTopInputBox = this._view.modelBuilder.inputBox()
			.withProps({
				value: '25',
				ariaLabel: constants.returnLabel,
				width: cssStyles.configureDialogTextboxWidth
			}).component();

		this.criteriaRadioButtons = [this.returnDataAllRadioButton, this.returnDataTopRadioButton];

		const returnTopRow = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([this.returnDataTopRadioButton, this.returnDataTopInputBox])
			.withProps({ ariaRole: 'returnFormatGroup' })
			.component();

		let flexRadioButtonsModel = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([this.returnDataAllRadioButton, returnTopRow])
			.withProps({ ariaRole: 'radiogroup' })
			.component();

		return {
			component: flexRadioButtonsModel,
			title: constants.returnLabel
		};
	}

	private createFilterComponent(): azdata.FormComponent {
		const filterMinPlanLabel = this._view.modelBuilder.text()
			.withProps({
				value: constants.filterMinPlanLabel
			}).component();

		this.filtersInputBox = this._view.modelBuilder.inputBox()
			.withProps({
				value: '1',
				ariaLabel: constants.returnLabel,
				width: cssStyles.configureDialogTextboxWidth,
			}).component();

		const filterRow = this._view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row' })
			.withItems([filterMinPlanLabel, this.filtersInputBox])
			.withProps({ ariaRole: 'filterFormatGroup' })
			.component();

		return {
			component: filterRow,
			title: constants.filterLabel
		};
	}
}
