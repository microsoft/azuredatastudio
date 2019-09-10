/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { Validator, InputComponents, createSection, createGroupContainer, createLabel, createFlexContainer, createTextInput, createNumberInput, setModelValues, getInputBoxComponent, getCheckboxComponent } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { MasterSQLServerScale_VariableName, ComputePoolScale_VariableName, DataPoolScale_VariableName, HDFSPoolScale_VariableName, SparkPoolScale_VariableName, ControllerDataStorageClassName_VariableName, ControllerLogsStorageClassName_VariableName, ControllerLogsStorageSize_VariableName, HDFSDataStorageClassName_VariableName, HDFSDataStorageSize_VariableName, HDFSLogsStorageClassName_VariableName, HDFSLogsStorageSize_VariableName, DataPoolDataStorageClassName_VariableName, DataPoolDataStorageSize_VariableName, DataPoolLogsStorageClassName_VariableName, DataPoolLogsStorageSize_VariableName, SQLServerDataStorageClassName_VariableName, SQLServerDataStorageSize_VariableName, SQLServerLogsStorageClassName_VariableName, SQLServerLogsStorageSize_VariableName, ControllerDNSName_VariableName, ControllerPort_VariableName, SQLServerDNSName_VariableName, SQLServerPort_VariableName, GatewayDNSName_VariableName, GateWayPort_VariableName, ReadableSecondaryDNSName_VariableName, ReadableSecondaryPort_VariableName, IncludeSpark_VariableName, HDFSNameNodeScale_VariableName, ControllerDataStorageSize_VariableName } from '../constants';
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
						required: true,
						variableName: MasterSQLServerScale_VariableName,
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
						required: true,
						variableName: ComputePoolScale_VariableName,
					}
				]
			}, {
				fields: [{
					type: FieldType.Number,
					label: localize('deployCluster.DataText', "Data"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: DataPoolScale_VariableName,
				}]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.HDFSNameNodeText', "HDFS name node"),
						min: 1,
						max: 100,
						defaultValue: '1',
						required: true,
						variableName: HDFSNameNodeScale_VariableName
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
						required: true,
						variableName: HDFSPoolScale_VariableName
					}, {
						type: FieldType.Checkbox,
						label: localize('deployCluster.includeSparkInHDFSPool', "Include Spark"),
						defaultValue: 'true',
						variableName: IncludeSpark_VariableName,
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
						required: true,
						variableName: SparkPoolScale_VariableName
					}
				]
			}
			]
		};

		const hintTextForStorageFields = localize('deployCluster.storageFieldTooltip', "Use controller settings");
		const fullDescriptionForStorageFields = localize('deployCluster.storageFieldDescription', "Optional fields, you can leave them blank to use controller settings");
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
						required: true,
						variableName: ControllerDataStorageClassName_VariableName,
						description: localize('deployCluster.AdvancedStorageDescription', "By default Controller storage settings will be applied to other services as well, you can expand the advanced storage settings to configure storage for other services."),
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						required: true,
						variableName: ControllerDataStorageSize_VariableName,
					}, {
						type: FieldType.Text,
						label: '',
						required: true,
						variableName: ControllerLogsStorageClassName_VariableName,
					}, {
						type: FieldType.Number,
						label: '',
						required: true,
						variableName: ControllerLogsStorageSize_VariableName,
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
						description: fullDescriptionForStorageFields,
						variableName: HDFSDataStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields,
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: HDFSDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: HDFSLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: HDFSLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.DataText', "Data"),
						required: false,
						description: fullDescriptionForStorageFields,
						variableName: DataPoolDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: DataPoolDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: DataPoolLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: DataPoolLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
						description: fullDescriptionForStorageFields,
						required: false,
						variableName: SQLServerDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: SQLServerDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: SQLServerLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: SQLServerLogsStorageSize_VariableName,
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

		this.controllerNameLabel = createLabel(view, { text: localize('deployCluster.ControllerText', "Controller"), width: labelWidth });
		this.controllerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ControllerDNSName', "Controller DNS name"), required: false, width: inputWidth });
		this.controllerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ControllerPortName', "Controller port"), required: false, width: PortInputWidth });
		this.controllerDNSRow = createFlexContainer(view, [this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput]);
		this.inputComponents[ControllerDNSName_VariableName] = this.controllerDNSInput;
		this.inputComponents[ControllerPort_VariableName] = this.controllerPortInput;

		this.masterSQLNameLabel = createLabel(view, { text: localize('deployCluster.MasterSqlText', "Master SQL Server"), width: labelWidth });
		this.masterSqlServerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerDNSName', "Master SQL Server DNS name"), required: false, width: inputWidth });
		this.masterSqlServerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerPortName', "Master SQL Server port"), required: false, width: PortInputWidth });
		this.masterSQLDNSRow = createFlexContainer(view, [this.masterSQLNameLabel, this.masterSqlServerDNSInput, this.masterSqlServerPortInput]);
		this.inputComponents[SQLServerDNSName_VariableName] = this.masterSqlServerDNSInput;
		this.inputComponents[SQLServerPort_VariableName] = this.masterSqlServerPortInput;

		this.gatewayNameLabel = createLabel(view, { text: localize('deployCluster.GatewayText', "Gateway"), width: labelWidth });
		this.gatewayDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.GatewayDNSName', "Gateway DNS name"), required: false, width: inputWidth });
		this.gatewayPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.GatewayPortName', "Gateway port"), required: false, width: PortInputWidth });
		this.gatewayDNSRow = createFlexContainer(view, [this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput]);
		this.inputComponents[GatewayDNSName_VariableName] = this.gatewayDNSInput;
		this.inputComponents[GateWayPort_VariableName] = this.gatewayPortInput;

		this.readableSecondaryNameLabel = createLabel(view, { text: localize('deployCluster.ReadableSecondaryText', "Readable secondary"), width: labelWidth });
		this.readableSecondaryDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryDNSName', "Readable secondary DNS name"), required: false, width: inputWidth });
		this.readableSecondaryPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryPortName', "Controller port"), required: false, width: PortInputWidth });
		this.readableSecondaryDNSRow = createFlexContainer(view, [this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput]);
		this.inputComponents[ReadableSecondaryDNSName_VariableName] = this.readableSecondaryDNSInput;
		this.inputComponents[ReadableSecondaryPort_VariableName] = this.readableSecondaryPortInput;

		return createGroupContainer(view, [this.dnsSectionHeaderRow, this.controllerDNSRow, this.masterSQLDNSRow, this.gatewayDNSRow, this.readableSecondaryDNSRow], {
			header: localize('deployCluster.DNSSectionTitle', "Ports settings"),
			collapsible: true
		});
	}

	public onEnter(): void {
		getInputBoxComponent(MasterSQLServerScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(MasterSQLServerScale_VariableName);
		getInputBoxComponent(MasterSQLServerScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(MasterSQLServerScale_VariableName);
		getInputBoxComponent(ComputePoolScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ComputePoolScale_VariableName);
		getInputBoxComponent(DataPoolScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(DataPoolScale_VariableName);
		getInputBoxComponent(HDFSPoolScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSPoolScale_VariableName);
		getInputBoxComponent(HDFSNameNodeScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSNameNodeScale_VariableName);
		getInputBoxComponent(SparkPoolScale_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SparkPoolScale_VariableName);
		getCheckboxComponent(IncludeSpark_VariableName, this.inputComponents).checked = this.wizard.model.getBooleanValue(IncludeSpark_VariableName);
		getInputBoxComponent(ControllerPort_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ControllerPort_VariableName);
		getInputBoxComponent(SQLServerPort_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SQLServerPort_VariableName);
		getInputBoxComponent(GateWayPort_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(GateWayPort_VariableName);

		getInputBoxComponent(ControllerDataStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ControllerDataStorageClassName_VariableName);
		getInputBoxComponent(ControllerDataStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ControllerDataStorageSize_VariableName);
		getInputBoxComponent(ControllerLogsStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ControllerLogsStorageClassName_VariableName);
		getInputBoxComponent(ControllerLogsStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(ControllerLogsStorageSize_VariableName);

		getInputBoxComponent(HDFSDataStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSDataStorageClassName_VariableName);
		getInputBoxComponent(HDFSDataStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSDataStorageSize_VariableName);
		getInputBoxComponent(HDFSLogsStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSLogsStorageClassName_VariableName);
		getInputBoxComponent(HDFSLogsStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(HDFSLogsStorageSize_VariableName);

		getInputBoxComponent(DataPoolDataStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(DataPoolDataStorageClassName_VariableName);
		getInputBoxComponent(DataPoolDataStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(DataPoolDataStorageSize_VariableName);
		getInputBoxComponent(DataPoolLogsStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(DataPoolLogsStorageClassName_VariableName);
		getInputBoxComponent(DataPoolLogsStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(DataPoolLogsStorageSize_VariableName);

		getInputBoxComponent(SQLServerDataStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SQLServerDataStorageClassName_VariableName);
		getInputBoxComponent(SQLServerDataStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SQLServerDataStorageSize_VariableName);
		getInputBoxComponent(SQLServerLogsStorageClassName_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SQLServerLogsStorageClassName_VariableName);
		getInputBoxComponent(SQLServerLogsStorageSize_VariableName, this.inputComponents).value = this.wizard.model.getStringValue(SQLServerLogsStorageSize_VariableName);

		this.dnsSectionHeaderRow.clearItems();
		this.controllerDNSRow.clearItems();
		this.gatewayDNSRow.clearItems();
		this.masterSQLDNSRow.clearItems();
		this.readableSecondaryDNSRow.clearItems();
		this.dnsSectionHeaderRow.addItems([this.nameHeader, this.portHeader]);
		this.controllerDNSRow.addItems([this.controllerNameLabel, this.controllerPortInput]);
		this.gatewayDNSRow.addItems([this.gatewayNameLabel, this.gatewayPortInput]);
		this.masterSQLDNSRow.addItems([this.masterSQLNameLabel, this.masterSqlServerPortInput]);
		this.readableSecondaryDNSRow.addItems([this.readableSecondaryNameLabel, this.readableSecondaryPortInput]);
		if (this.wizard.model.supportActiveDirectory) {
			const itemLayout: azdata.FlexItemLayout = { CSSStyles: { 'margin-right': '20px' } };
			this.dnsSectionHeaderRow.insertItem(this.dnsHeader, 1, itemLayout);
			this.controllerDNSRow.insertItem(this.controllerDNSInput, 1, itemLayout);
			this.gatewayDNSRow.insertItem(this.gatewayDNSInput, 1, itemLayout);
			this.masterSQLDNSRow.insertItem(this.masterSqlServerDNSInput, 1, itemLayout);
			this.readableSecondaryDNSRow.insertItem(this.readableSecondaryDNSInput, 1, itemLayout);
		}
	}

	public onLeave(): void {
		setModelValues(this.inputComponents, this.wizard.model);
	}
}
