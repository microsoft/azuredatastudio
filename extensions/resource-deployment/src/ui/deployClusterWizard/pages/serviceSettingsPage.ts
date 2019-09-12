/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { Validator, InputComponents, createSection, createGroupContainer, createLabel, createFlexContainer, createTextInput, createNumberInput, setModelValues, getInputBoxComponent, getCheckboxComponent, isInputBoxEmpty } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
const localize = nls.loadMessageBundle();

const PortInputWidth = '100px';
const inputWidth = '180px';
const labelWidth = '150px';
const spaceBetweenFields = '5px';

export class ServiceSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};
	private dnsSectionHeaderRow!: azdata.FlexContainer;
	private dnsHeader!: azdata.TextComponent;
	private portHeader!: azdata.TextComponent;
	private controllerDNSInput!: azdata.InputBoxComponent;
	private controllerPortInput!: azdata.InputBoxComponent;
	private controllerDNSRow!: azdata.FlexContainer;
	private masterSqlServerDNSInput!: azdata.InputBoxComponent;
	private masterSQLDNSRow!: azdata.FlexContainer;
	private masterSqlServerPortInput!: azdata.InputBoxComponent;
	private gatewayDNSInput!: azdata.InputBoxComponent;
	private gatewayPortInput!: azdata.InputBoxComponent;
	private gatewayDNSRow!: azdata.FlexContainer;
	private readableSecondaryDNSInput!: azdata.InputBoxComponent;
	private readableSecondaryPortInput!: azdata.InputBoxComponent;
	private readableSecondaryDNSRow!: azdata.FlexContainer;
	private nameHeader!: azdata.TextComponent;
	private controllerNameLabel!: azdata.TextComponent;
	private masterSQLNameLabel!: azdata.TextComponent;
	private gatewayNameLabel!: azdata.TextComponent;
	private readableSecondaryNameLabel!: azdata.TextComponent;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ServiceSettingsPageTitle', "Service settings"), '', wizard);
	}
	public initialize(): void {
		const scaleSectionInfo: SectionInfo = {
			title: localize('deployCluster.scaleSectionTitle', "Scale settings"),
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			rows: [{
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
						min: 1,
						max: 9,
						defaultValue: '1',
						useCustomValidator: true,
						variableName: VariableNames.MasterSQLServerScale_VariableName,
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.ComputeText', "Compute"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						variableName: VariableNames.ComputePoolScale_VariableName,
					}
				]
			}, {
				fields: [{
					type: FieldType.Number,
					label: localize('deployCluster.DataText', "Data"),
					min: 1,
					max: 100,
					defaultValue: '1',
					useCustomValidator: true,
					variableName: VariableNames.DataPoolScale_VariableName,
				}]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.HDFSNameNodeText', "HDFS name node"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						variableName: VariableNames.HDFSNameNodeScale_VariableName
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.HDFSText', "HDFS"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						variableName: VariableNames.HDFSPoolScale_VariableName
					}, {
						type: FieldType.Checkbox,
						label: localize('deployCluster.includeSparkInHDFSPool', "Include Spark"),
						defaultValue: 'true',
						variableName: VariableNames.IncludeSpark_VariableName,
						required: false
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.SparkText', "Spark"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						variableName: VariableNames.SparkPoolScale_VariableName
					}
				]
			}
			]
		};

		const hintTextForStorageFields = localize('deployCluster.storageFieldTooltip', "Use controller settings");
		const storageSectionInfo: SectionInfo = {
			title: '',
			labelWidth: '0px',
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			rows: [{
				fields: [
					{
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.DataStorageClassName', "STORAGE CLASS FOR DATA"),
						variableName: '',
						labelWidth: labelWidth
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.DataClaimSize', "CLAIM SIZE FOR DATA (GB)"),
						variableName: ''
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.LogStorageClassName', "STORAGE CLASS FOR LOGS"),
						variableName: '',
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.LogsClaimSize', "CLAIM SIZE FOR LOGS (GB)"),
						variableName: ''
					}
				]
			},
			{
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.ControllerText', "Controller"),
						useCustomValidator: true,
						variableName: VariableNames.ControllerDataStorageClassName_VariableName,
						required: true,
						description: localize('deployCluster.AdvancedStorageDescription', "By default Controller storage settings will be applied to other services as well, you can expand the advanced storage settings to configure storage for other services."),
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						useCustomValidator: true,
						min: 1,
						variableName: VariableNames.ControllerDataStorageSize_VariableName,
					}, {
						type: FieldType.Text,
						label: '',
						useCustomValidator: true,
						min: 1,
						variableName: VariableNames.ControllerLogsStorageClassName_VariableName,
					}, {
						type: FieldType.Number,
						label: '',
						useCustomValidator: true,
						min: 1,
						variableName: VariableNames.ControllerLogsStorageSize_VariableName,
					}
				]
			}
			]
		};
		const advancedStorageSectionInfo: SectionInfo = {
			title: localize('deployCluster.AdvancedStorageSectionTitle', "Advanced storage settings"),
			labelWidth: '0px',
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			collapsible: true,
			collapsed: true,
			rows: [{
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.HDFSText', "HDFS"),
						required: false,
						variableName: VariableNames.HDFSDataStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields,
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.HDFSDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: VariableNames.HDFSLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.HDFSLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.DataText', "Data"),
						required: false,
						variableName: VariableNames.DataPoolDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.DataPoolDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: VariableNames.DataPoolLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.DataPoolLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
						required: false,
						variableName: VariableNames.SQLServerDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.SQLServerDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: VariableNames.SQLServerLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						min: 1,
						variableName: VariableNames.SQLServerLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}]
		};

		this.pageObject.registerContent((view: azdata.ModelView) => {
			const createSectionFunc = (sectionInfo: SectionInfo): azdata.GroupContainer => {
				return createSection({
					view: view,
					container: this.wizard.wizardObject,
					sectionInfo: sectionInfo,
					onNewDisposableCreated: (disposable: vscode.Disposable): void => {
						this.wizard.registerDisposable(disposable);
					},
					onNewInputComponentCreated: (name: string, component: azdata.DropDownComponent | azdata.InputBoxComponent | azdata.CheckBoxComponent): void => {
						this.inputComponents[name] = component;
					},
					onNewValidatorCreated: (validator: Validator): void => {
					}
				});
			};
			const scaleSection = createSectionFunc(scaleSectionInfo);
			const dnsSection = this.createDNSSection(view);
			const storageSection = createSectionFunc(storageSectionInfo);
			const advancedStorageSection = createSectionFunc(advancedStorageSectionInfo);
			const storageContainer = createGroupContainer(view, [storageSection, advancedStorageSection], {
				header: localize('deployCluster.StorageSectionTitle', "Storage settings"),
				collapsible: true
			});
			const form = view.modelBuilder.formContainer().withFormItems([
				{
					title: '',
					component: scaleSection
				}, {
					title: '',
					component: dnsSection
				}, {
					title: '',
					component: storageContainer
				}
			]).withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	private createDNSSection(view: azdata.ModelView): azdata.GroupContainer {
		this.nameHeader = createLabel(view, { text: '', width: labelWidth });
		this.dnsHeader = createLabel(view, { text: localize('deployCluster.DNSNameHeader', "DNS NAME"), width: inputWidth });
		this.portHeader = createLabel(view, { text: localize('deployCluster.PortHeader', "PORT"), width: PortInputWidth });
		this.dnsSectionHeaderRow = createFlexContainer(view, [this.nameHeader, this.dnsHeader, this.portHeader]);

		this.controllerNameLabel = createLabel(view, { text: localize('deployCluster.ControllerText', "Controller"), width: labelWidth, required: true });
		this.controllerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ControllerDNSName', "Controller DNS name"), required: false, width: inputWidth });
		this.controllerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ControllerPortName', "Controller port"), required: true, width: PortInputWidth, min: 1 });
		this.controllerDNSRow = createFlexContainer(view, [this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput]);
		this.inputComponents[VariableNames.ControllerDNSName_VariableName] = this.controllerDNSInput;
		this.inputComponents[VariableNames.ControllerPort_VariableName] = this.controllerPortInput;

		this.masterSQLNameLabel = createLabel(view, { text: localize('deployCluster.MasterSqlText', "Master SQL Server"), width: labelWidth, required: true });
		this.masterSqlServerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerDNSName', "Master SQL Server DNS name"), required: false, width: inputWidth });
		this.masterSqlServerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerPortName', "Master SQL Server port"), required: true, width: PortInputWidth, min: 1 });
		this.masterSQLDNSRow = createFlexContainer(view, [this.masterSQLNameLabel, this.masterSqlServerDNSInput, this.masterSqlServerPortInput]);
		this.inputComponents[VariableNames.SQLServerDNSName_VariableName] = this.masterSqlServerDNSInput;
		this.inputComponents[VariableNames.SQLServerPort_VariableName] = this.masterSqlServerPortInput;

		this.gatewayNameLabel = createLabel(view, { text: localize('deployCluster.GatewayText', "Gateway"), width: labelWidth, required: true });
		this.gatewayDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.GatewayDNSName', "Gateway DNS name"), required: false, width: inputWidth });
		this.gatewayPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.GatewayPortName', "Gateway port"), required: true, width: PortInputWidth, min: 1 });
		this.gatewayDNSRow = createFlexContainer(view, [this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput]);
		this.inputComponents[VariableNames.GatewayDNSName_VariableName] = this.gatewayDNSInput;
		this.inputComponents[VariableNames.GateWayPort_VariableName] = this.gatewayPortInput;

		this.readableSecondaryNameLabel = createLabel(view, { text: localize('deployCluster.ReadableSecondaryText', "Readable secondary"), width: labelWidth, required: true });
		this.readableSecondaryDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryDNSName', "Readable secondary DNS name"), required: false, width: inputWidth });
		this.readableSecondaryPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryPortName', "Readable secondary port"), required: false, width: PortInputWidth, min: 1 });
		this.readableSecondaryDNSRow = createFlexContainer(view, [this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput]);
		this.inputComponents[VariableNames.ReadableSecondaryDNSName_VariableName] = this.readableSecondaryDNSInput;
		this.inputComponents[VariableNames.ReadableSecondaryPort_VariableName] = this.readableSecondaryPortInput;

		return createGroupContainer(view, [this.dnsSectionHeaderRow, this.controllerDNSRow, this.masterSQLDNSRow, this.gatewayDNSRow, this.readableSecondaryDNSRow], {
			header: localize('deployCluster.DNSSectionTitle', "Port settings"),
			collapsible: true
		});
	}

	public onEnter(): void {
		this.setInputBoxValue(VariableNames.MasterSQLServerScale_VariableName);
		this.setInputBoxValue(VariableNames.ComputePoolScale_VariableName);
		this.setInputBoxValue(VariableNames.DataPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.HDFSPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.HDFSNameNodeScale_VariableName);
		this.setInputBoxValue(VariableNames.SparkPoolScale_VariableName);
		this.setCheckboxValue(VariableNames.IncludeSpark_VariableName);

		this.setInputBoxValue(VariableNames.ControllerPort_VariableName);
		this.setInputBoxValue(VariableNames.SQLServerPort_VariableName);
		this.setInputBoxValue(VariableNames.GateWayPort_VariableName);
		this.setInputBoxValue(VariableNames.ReadableSecondaryPort_VariableName);

		this.setInputBoxValue(VariableNames.ControllerDataStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerDataStorageSize_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageSize_VariableName);

		this.dnsSectionHeaderRow.clearItems();
		this.controllerDNSRow.clearItems();
		this.gatewayDNSRow.clearItems();
		this.masterSQLDNSRow.clearItems();
		this.readableSecondaryDNSRow.clearItems();

		this.controllerDNSRow.addItems([this.controllerNameLabel, this.controllerPortInput]);
		this.gatewayDNSRow.addItems([this.gatewayNameLabel, this.gatewayPortInput]);
		this.masterSQLDNSRow.addItems([this.masterSQLNameLabel, this.masterSqlServerPortInput]);
		if (this.wizard.model.hadrEnabled) {
			this.readableSecondaryDNSRow.addItems([this.readableSecondaryNameLabel, this.readableSecondaryPortInput]);
		}

		if (this.wizard.model.getStringValue(VariableNames.AuthenticationMode_VariableName) === VariableNames.ActiveDirectoryAuthentication) {
			const itemLayout: azdata.FlexItemLayout = { CSSStyles: { 'margin-right': '20px' } };
			this.dnsSectionHeaderRow.addItems([this.nameHeader, this.dnsHeader, this.portHeader]);
			this.controllerDNSRow.insertItem(this.controllerDNSInput, 1, itemLayout);
			this.gatewayDNSRow.insertItem(this.gatewayDNSInput, 1, itemLayout);
			this.masterSQLDNSRow.insertItem(this.masterSqlServerDNSInput, 1, itemLayout);
			if (this.wizard.model.hadrEnabled) {
				this.readableSecondaryDNSRow.insertItem(this.readableSecondaryDNSInput, 1, itemLayout);
			}
		}

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const isValid: boolean = !isInputBoxEmpty(getInputBoxComponent(VariableNames.MasterSQLServerScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ComputePoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DataPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.HDFSNameNodeScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.HDFSPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.SparkPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerDataStorageClassName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerDataStorageSize_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerLogsStorageClassName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerLogsStorageSize_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerPort_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.SQLServerPort_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.GateWayPort_VariableName, this.inputComponents))
					&& (!this.wizard.model.hadrEnabled
						|| !isInputBoxEmpty(this.readableSecondaryPortInput))
					&& (!this.wizard.model.adAuthSupported
						|| (!isInputBoxEmpty(this.gatewayDNSInput)
							&& !isInputBoxEmpty(this.controllerDNSInput)
							&& !isInputBoxEmpty(this.masterSqlServerDNSInput)
							&& !isInputBoxEmpty(this.readableSecondaryDNSInput)
						));
				if (!isValid) {
					this.wizard.wizardObject.message = {
						text: localize('deployCluster.MissingRequiredInformation', "Please fill out the required fields."),
						level: azdata.window.MessageLevel.Error
					};
				}
				return isValid;
			}
			return true;
		});
	}

	public onLeave(): void {
		setModelValues(this.inputComponents, this.wizard.model);
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private setInputBoxValue(variableName: string): void {
		getInputBoxComponent(variableName, this.inputComponents).value = this.wizard.model.getStringValue(variableName);
	}

	private setCheckboxValue(variableName: string): void {
		getCheckboxComponent(variableName, this.inputComponents).checked = this.wizard.model.getBooleanValue(variableName);
	}
}
