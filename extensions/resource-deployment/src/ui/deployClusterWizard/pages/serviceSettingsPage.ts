/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { Validator, InputComponents, createSection, createGroupContainer, createLabel, createFlexContainer, createTextInput, createNumberInput, setModelValues, getInputBoxComponent, getCheckboxComponent, isInputBoxEmpty, getDropdownComponent, MissingRequiredInformationErrorMessage } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { AuthenticationMode } from '../deployClusterWizardModel';
const localize = nls.loadMessageBundle();

const PortInputWidth = '100px';
const inputWidth = '180px';
const labelWidth = '150px';
const spaceBetweenFields = '5px';

export class ServiceSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};
	private endpointHeaderRow!: azdata.FlexContainer;
	private dnsColumnHeader!: azdata.TextComponent;
	private portColumnHeader!: azdata.TextComponent;
	private controllerDNSInput!: azdata.InputBoxComponent;
	private controllerPortInput!: azdata.InputBoxComponent;
	private controllerEndpointRow!: azdata.FlexContainer;
	private sqlServerDNSInput!: azdata.InputBoxComponent;
	private sqlServerEndpointRow!: azdata.FlexContainer;
	private sqlServerPortInput!: azdata.InputBoxComponent;
	private gatewayDNSInput!: azdata.InputBoxComponent;
	private gatewayPortInput!: azdata.InputBoxComponent;
	private gatewayEndpointRow!: azdata.FlexContainer;
	private readableSecondaryDNSInput!: azdata.InputBoxComponent;
	private readableSecondaryPortInput!: azdata.InputBoxComponent;
	private readableSecondaryEndpointRow!: azdata.FlexContainer;
	private endpointNameColumnHeader!: azdata.TextComponent;
	private controllerNameLabel!: azdata.TextComponent;
	private SqlServerNameLabel!: azdata.TextComponent;
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
						label: localize('deployCluster.ComputeText', "Compute"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						required: true,
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
					required: true,
					variableName: VariableNames.DataPoolScale_VariableName,
				}]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.HDFSText', "HDFS"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						required: true,
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
						min: 0,
						max: 100,
						defaultValue: '0',
						useCustomValidator: true,
						required: true,
						variableName: VariableNames.SparkPoolScale_VariableName
					}
				]
			}
			]
		};

		const hadrSectionInfo: SectionInfo = {
			title: localize('deployCluster.HadrSection', "High availability settings"),
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			rows: [{
				fields: [
					{
						type: FieldType.Options,
						label: localize('deployCluster.MasterSqlText', "SQL Server Master"),
						options: ['1', '3', '4', '5', '6', '7', '8', '9'],
						defaultValue: '1',
						required: true,
						variableName: VariableNames.SQLServerScale_VariableName,
					}, {
						type: FieldType.Checkbox,
						label: localize('deployCluster.EnableHADR', "Enable Availability Groups"),
						defaultValue: 'false',
						variableName: VariableNames.EnableHADR_VariableName,
						required: false
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.HDFSNameNodeText', "HDFS name node"),
						min: 1,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						required: true,
						variableName: VariableNames.HDFSNameNodeScale_VariableName
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.SparkHeadText', "SparkHead"),
						min: 0,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						required: true,
						variableName: VariableNames.SparkHeadScale_VariableName
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.ZooKeeperText', "ZooKeeper"),
						min: 0,
						max: 100,
						defaultValue: '1',
						useCustomValidator: true,
						required: true,
						variableName: VariableNames.ZooKeeperScale_VariableName
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
						defaultValue: localize('deployCluster.DataStorageClassName', "Storage class for data"),
						variableName: '',
						labelWidth: labelWidth
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.DataClaimSize', "Claim size for data (GB)"),
						variableName: ''
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.LogStorageClassName', "Storage class for logs"),
						variableName: '',
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.LogsClaimSize', "Claim size for logs (GB)"),
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
						label: localize('deployCluster.MasterSqlText', "SQL Server Master"),
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
			const hadrSection = createSectionFunc(hadrSectionInfo);
			const endpointSection = this.createEndpointSection(view);
			const storageSection = createSectionFunc(storageSectionInfo);
			const advancedStorageSection = createSectionFunc(advancedStorageSectionInfo);
			const storageContainer = createGroupContainer(view, [storageSection, advancedStorageSection], {
				header: localize('deployCluster.StorageSectionTitle', "Storage settings"),
				collapsible: true
			});
			this.setSQLServerMasterFieldEventHandler();
			const form = view.modelBuilder.formContainer().withFormItems([
				{
					title: '',
					component: scaleSection
				}, {
					title: '',
					component: hadrSection
				}, {
					title: '',
					component: endpointSection
				}, {
					title: '',
					component: storageContainer
				}
			]).withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	private createEndpointSection(view: azdata.ModelView): azdata.GroupContainer {
		this.endpointNameColumnHeader = createLabel(view, { text: '', width: labelWidth });
		this.dnsColumnHeader = createLabel(view, { text: localize('deployCluster.DNSNameHeader', "DNS name"), width: inputWidth });
		this.portColumnHeader = createLabel(view, { text: localize('deployCluster.PortHeader', "Port"), width: PortInputWidth });
		this.endpointHeaderRow = createFlexContainer(view, [this.endpointNameColumnHeader, this.dnsColumnHeader, this.portColumnHeader]);

		this.controllerNameLabel = createLabel(view, { text: localize('deployCluster.ControllerText', "Controller"), width: labelWidth, required: true });
		this.controllerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ControllerDNSName', "Controller DNS name"), required: false, width: inputWidth });
		this.controllerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ControllerPortName', "Controller port"), required: true, width: PortInputWidth, min: 1 });
		this.controllerEndpointRow = createFlexContainer(view, [this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput]);
		this.inputComponents[VariableNames.ControllerDNSName_VariableName] = this.controllerDNSInput;
		this.inputComponents[VariableNames.ControllerPort_VariableName] = this.controllerPortInput;

		this.SqlServerNameLabel = createLabel(view, { text: localize('deployCluster.MasterSqlText', "SQL Server Master"), width: labelWidth, required: true });
		this.sqlServerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerDNSName', "SQL Server Master DNS name"), required: false, width: inputWidth });
		this.sqlServerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerPortName', "SQL Server Master port"), required: true, width: PortInputWidth, min: 1 });
		this.sqlServerEndpointRow = createFlexContainer(view, [this.SqlServerNameLabel, this.sqlServerDNSInput, this.sqlServerPortInput]);
		this.inputComponents[VariableNames.SQLServerDNSName_VariableName] = this.sqlServerDNSInput;
		this.inputComponents[VariableNames.SQLServerPort_VariableName] = this.sqlServerPortInput;

		this.gatewayNameLabel = createLabel(view, { text: localize('deployCluster.GatewayText', "Gateway"), width: labelWidth, required: true });
		this.gatewayDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.GatewayDNSName', "Gateway DNS name"), required: false, width: inputWidth });
		this.gatewayPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.GatewayPortName', "Gateway port"), required: true, width: PortInputWidth, min: 1 });
		this.gatewayEndpointRow = createFlexContainer(view, [this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput]);
		this.inputComponents[VariableNames.GatewayDNSName_VariableName] = this.gatewayDNSInput;
		this.inputComponents[VariableNames.GateWayPort_VariableName] = this.gatewayPortInput;

		this.readableSecondaryNameLabel = createLabel(view, { text: localize('deployCluster.ReadableSecondaryText', "Readable secondary"), width: labelWidth, required: true });
		this.readableSecondaryDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryDNSName', "Readable secondary DNS name"), required: false, width: inputWidth });
		this.readableSecondaryPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryPortName', "Readable secondary port"), required: false, width: PortInputWidth, min: 1 });
		this.readableSecondaryEndpointRow = createFlexContainer(view, [this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput]);
		this.inputComponents[VariableNames.ReadableSecondaryDNSName_VariableName] = this.readableSecondaryDNSInput;
		this.inputComponents[VariableNames.ReadableSecondaryPort_VariableName] = this.readableSecondaryPortInput;

		return createGroupContainer(view, [this.endpointHeaderRow, this.controllerEndpointRow, this.sqlServerEndpointRow, this.gatewayEndpointRow, this.readableSecondaryEndpointRow], {
			header: localize('deployCluster.EndpointSettings', "Endpoint settings"),
			collapsible: true
		});
	}

	public onEnter(): void {
		this.setDropdownValue(VariableNames.SQLServerScale_VariableName);
		this.setCheckboxValue(VariableNames.EnableHADR_VariableName);
		this.setInputBoxValue(VariableNames.ComputePoolScale_VariableName);
		this.setInputBoxValue(VariableNames.DataPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.HDFSPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.HDFSNameNodeScale_VariableName);
		this.setInputBoxValue(VariableNames.SparkPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.SparkHeadScale_VariableName);
		this.setInputBoxValue(VariableNames.ZooKeeperScale_VariableName);
		this.setCheckboxValue(VariableNames.IncludeSpark_VariableName);
		this.setEnableHadrCheckboxState(this.wizard.model.getIntegerValue(VariableNames.SQLServerScale_VariableName));
		this.setInputBoxValue(VariableNames.ControllerPort_VariableName);
		this.setInputBoxValue(VariableNames.SQLServerPort_VariableName);
		this.setInputBoxValue(VariableNames.GateWayPort_VariableName);
		this.setInputBoxValue(VariableNames.ReadableSecondaryPort_VariableName);

		this.setInputBoxValue(VariableNames.ControllerDataStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerDataStorageSize_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageSize_VariableName);

		this.endpointHeaderRow.clearItems();
		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			this.endpointHeaderRow.addItems([this.endpointNameColumnHeader, this.dnsColumnHeader, this.portColumnHeader]);
		}
		this.loadEndpointRow(this.controllerEndpointRow, this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput);
		this.loadEndpointRow(this.gatewayEndpointRow, this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput);
		this.loadEndpointRow(this.sqlServerEndpointRow, this.SqlServerNameLabel, this.sqlServerDNSInput, this.sqlServerPortInput);
		this.updateReadableSecondaryEndpointComponents(this.wizard.model.hadrEnabled);
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const isValid: boolean = !isInputBoxEmpty(getInputBoxComponent(VariableNames.ComputePoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.DataPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.HDFSNameNodeScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.HDFSPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.SparkPoolScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.SparkHeadScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ZooKeeperScale_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerDataStorageClassName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerDataStorageSize_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerLogsStorageClassName_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerLogsStorageSize_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.ControllerPort_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.SQLServerPort_VariableName, this.inputComponents))
					&& !isInputBoxEmpty(getInputBoxComponent(VariableNames.GateWayPort_VariableName, this.inputComponents))
					&& (!getCheckboxComponent(VariableNames.EnableHADR_VariableName, this.inputComponents).checked
						|| !isInputBoxEmpty(this.readableSecondaryPortInput))
					&& (this.wizard.model.authenticationMode !== AuthenticationMode.ActiveDirectory
						|| (!isInputBoxEmpty(this.gatewayDNSInput)
							&& !isInputBoxEmpty(this.controllerDNSInput)
							&& !isInputBoxEmpty(this.sqlServerDNSInput)
							&& !isInputBoxEmpty(this.readableSecondaryDNSInput)
						));
				if (!isValid) {
					this.wizard.wizardObject.message = {
						text: MissingRequiredInformationErrorMessage,
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

	private setDropdownValue(variableName: string): void {
		getDropdownComponent(variableName, this.inputComponents).value = this.wizard.model.getStringValue(variableName);
	}

	private setSQLServerMasterFieldEventHandler() {
		const sqlScaleDropdown = getDropdownComponent(VariableNames.SQLServerScale_VariableName, this.inputComponents);
		const enableHadrCheckbox = getCheckboxComponent(VariableNames.EnableHADR_VariableName, this.inputComponents);
		this.wizard.registerDisposable(sqlScaleDropdown.onValueChanged(() => {
			const selectedValue = typeof sqlScaleDropdown.value === 'string' ? sqlScaleDropdown.value : sqlScaleDropdown.value!.name;
			this.setEnableHadrCheckboxState(Number.parseInt(selectedValue));
		}));
		this.wizard.registerDisposable(enableHadrCheckbox.onChanged(() => {
			this.updateReadableSecondaryEndpointComponents(!!enableHadrCheckbox.checked);
		}));
	}

	private setEnableHadrCheckboxState(sqlInstances: number) {
		// 1. it is ok to enable HADR when there is only 1 replica
		// 2. if there are multiple replicas, the hadr.enabled switch must be set to true.
		const enableHadrCheckbox = getCheckboxComponent(VariableNames.EnableHADR_VariableName, this.inputComponents);
		const hadrEnabled = sqlInstances === 1 ? !!enableHadrCheckbox.checked : true;
		if (sqlInstances === 1) {
			enableHadrCheckbox.enabled = true;
		} else {
			enableHadrCheckbox.enabled = false;
		}
		enableHadrCheckbox.checked = hadrEnabled;
		this.updateReadableSecondaryEndpointComponents(hadrEnabled);
	}

	private updateReadableSecondaryEndpointComponents(hadrEnabled: boolean) {
		this.readableSecondaryEndpointRow.clearItems();
		if (hadrEnabled) {
			this.loadEndpointRow(this.readableSecondaryEndpointRow, this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput);
		}
	}

	private loadEndpointRow(row: azdata.FlexContainer, label: azdata.TextComponent, dnsInput: azdata.InputBoxComponent, portInput: azdata.InputBoxComponent): void {
		row.clearItems();
		const itemLayout: azdata.FlexItemLayout = { CSSStyles: { 'margin-right': '20px' } };
		row.addItem(label);
		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			row.addItem(dnsInput, itemLayout);
		}
		row.addItem(portInput);
	}
}
