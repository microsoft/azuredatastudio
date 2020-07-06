/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { FieldType, SectionInfo } from '../../../interfaces';
import { createFlexContainer, createGroupContainer, createLabel, createNumberInput, createSection, createTextInput, getCheckboxComponent, getDropdownComponent, getInputBoxComponent, InputComponentInfo, InputComponents, setModelValues, Validator } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
import { AuthenticationMode } from '../deployClusterWizardModel';
const localize = nls.loadMessageBundle();

const NumberInputWidth = '100px';
const inputWidth = '180px';
const labelWidth = '200px';

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
	private serviceProxyDNSInput!: azdata.InputBoxComponent;
	private serviceProxyPortInput!: azdata.InputBoxComponent;
	private serviceProxyEndpointRow!: azdata.FlexContainer;
	private appServiceProxyDNSInput!: azdata.InputBoxComponent;
	private appServiceProxyPortInput!: azdata.InputBoxComponent;
	private appServiceProxyEndpointRow!: azdata.FlexContainer;
	private readableSecondaryDNSInput!: azdata.InputBoxComponent;
	private readableSecondaryPortInput!: azdata.InputBoxComponent;
	private readableSecondaryEndpointRow!: azdata.FlexContainer;
	private endpointNameColumnHeader!: azdata.TextComponent;
	private controllerNameLabel!: azdata.TextComponent;
	private SqlServerNameLabel!: azdata.TextComponent;
	private gatewayNameLabel!: azdata.TextComponent;
	private serviceProxyNameLabel!: azdata.TextComponent;
	private appServiceProxyNameLabel!: azdata.TextComponent;
	private readableSecondaryNameLabel!: azdata.TextComponent;
	private endpointSection!: azdata.GroupContainer;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ServiceSettingsPageTitle', "Service settings"), '', wizard);
	}
	public initialize(): void {
		const scaleSectionInfo: SectionInfo = {
			title: localize('deployCluster.scaleSectionTitle', "Scale settings"),
			labelWidth: labelWidth,
			inputWidth: NumberInputWidth,
			spaceBetweenFields: '40px',
			rows: [{
				items: [{
					type: FieldType.Options,
					label: localize('deployCluster.MasterSqlServerInstances', "SQL Server master instances"),
					options: ['1', '3', '4', '5', '6', '7', '8', '9'],
					defaultValue: '1',
					variableName: VariableNames.SQLServerScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.ComputePoolInstances', "Compute pool instances"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: VariableNames.ComputePoolScale_VariableName,
				}]
			}, {
				items: [{
					type: FieldType.Number,
					label: localize('deployCluster.DataPoolInstances', "Data pool instances"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: VariableNames.DataPoolScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.SparkPoolInstances', "Spark pool instances"),
					min: 0,
					max: 100,
					defaultValue: '0',
					required: true,
					variableName: VariableNames.SparkPoolScale_VariableName
				}]
			}, {
				items: [
					{
						type: FieldType.Number,
						label: localize('deployCluster.StoragePoolInstances', "Storage pool (HDFS) instances"),
						min: 1,
						max: 100,
						defaultValue: '1',
						required: true,
						variableName: VariableNames.HDFSPoolScale_VariableName
					}, {
						type: FieldType.Checkbox,
						label: localize('deployCluster.IncludeSparkInStoragePool', "Include Spark in storage pool"),
						defaultValue: 'true',
						variableName: VariableNames.IncludeSpark_VariableName,
						required: false
					}
				]
			}
			]
		};

		this.pageObject.registerContent(async (view: azdata.ModelView) => {
			const createSectionFunc = async (sectionInfo: SectionInfo): Promise<azdata.GroupContainer> => {
				return await createSection({
					view: view,
					container: this.wizard.wizardObject,
					inputComponents: this.inputComponents,
					sectionInfo: sectionInfo,
					onNewDisposableCreated: (disposable: vscode.Disposable): void => {
						this.wizard.registerDisposable(disposable);
					},
					onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo): void => {
						this.inputComponents[name] = { component: inputComponentInfo.component };
					},
					onNewValidatorCreated: (validator: Validator): void => {
					}
				});
			};
			const scaleSection = await createSectionFunc(scaleSectionInfo);
			this.endpointSection = this.createEndpointSection(view);
			const storageSection = this.createStorageSection(view);

			this.handleSparkSettingEvents();
			const form = view.modelBuilder.formContainer().withFormItems([
				{
					title: '',
					component: scaleSection
				}, {
					title: '',
					component: this.endpointSection
				}, {
					title: '',
					component: storageSection
				}
			]).withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	private handleSparkSettingEvents(): void {
		const sparkInstanceInput = getInputBoxComponent(VariableNames.SparkPoolScale_VariableName, this.inputComponents);
		const includeSparkCheckbox = getCheckboxComponent(VariableNames.IncludeSpark_VariableName, this.inputComponents);
		this.wizard.registerDisposable(includeSparkCheckbox.onChanged(() => {
			if (!includeSparkCheckbox.checked && !(sparkInstanceInput.value && Number.parseInt(sparkInstanceInput.value) > 0)) {
				sparkInstanceInput.value = '1';
			}
		}));
	}

	private createEndpointSection(view: azdata.ModelView): azdata.GroupContainer {
		this.endpointNameColumnHeader = createLabel(view, { text: '', width: labelWidth });
		this.dnsColumnHeader = createLabel(view, { text: localize('deployCluster.DNSNameHeader', "DNS name"), width: inputWidth });
		this.portColumnHeader = createLabel(view, { text: localize('deployCluster.PortHeader', "Port"), width: NumberInputWidth });
		this.endpointHeaderRow = createFlexContainer(view, [this.endpointNameColumnHeader, this.dnsColumnHeader, this.portColumnHeader]);

		this.controllerNameLabel = createLabel(view, { text: localize('deployCluster.ControllerText', "Controller"), width: labelWidth, required: true });
		this.controllerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ControllerDNSName', "Controller DNS name"), required: false, width: inputWidth });
		this.controllerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ControllerPortName', "Controller port"), required: true, width: NumberInputWidth, min: 1 });
		this.controllerEndpointRow = createFlexContainer(view, [this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput]);
		this.inputComponents[VariableNames.ControllerDNSName_VariableName] = { component: this.controllerDNSInput };
		this.inputComponents[VariableNames.ControllerPort_VariableName] = { component: this.controllerPortInput };

		this.SqlServerNameLabel = createLabel(view, { text: localize('deployCluster.MasterSqlText', "SQL Server Master"), width: labelWidth, required: true });
		this.sqlServerDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerDNSName', "SQL Server Master DNS name"), required: false, width: inputWidth });
		this.sqlServerPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.MasterSQLServerPortName', "SQL Server Master port"), required: true, width: NumberInputWidth, min: 1 });
		this.sqlServerEndpointRow = createFlexContainer(view, [this.SqlServerNameLabel, this.sqlServerDNSInput, this.sqlServerPortInput]);
		this.inputComponents[VariableNames.SQLServerDNSName_VariableName] = { component: this.sqlServerDNSInput };
		this.inputComponents[VariableNames.SQLServerPort_VariableName] = { component: this.sqlServerPortInput };

		this.gatewayNameLabel = createLabel(view, { text: localize('deployCluster.GatewayText', "Gateway"), width: labelWidth, required: true });
		this.gatewayDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.GatewayDNSName', "Gateway DNS name"), required: false, width: inputWidth });
		this.gatewayPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.GatewayPortName', "Gateway port"), required: true, width: NumberInputWidth, min: 1 });
		this.gatewayEndpointRow = createFlexContainer(view, [this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput]);
		this.inputComponents[VariableNames.GatewayDNSName_VariableName] = { component: this.gatewayDNSInput };
		this.inputComponents[VariableNames.GateWayPort_VariableName] = { component: this.gatewayPortInput };

		this.serviceProxyNameLabel = createLabel(view, { text: localize('deployCluster.ServiceProxyText', "Management proxy"), width: labelWidth, required: true });
		this.serviceProxyDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ServiceProxyDNSName', "Management proxy DNS name"), required: false, width: inputWidth });
		this.serviceProxyPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ServiceProxyPortName', "Management proxy port"), required: true, width: NumberInputWidth, min: 1 });
		this.serviceProxyEndpointRow = createFlexContainer(view, [this.serviceProxyNameLabel, this.serviceProxyDNSInput, this.serviceProxyPortInput]);
		this.inputComponents[VariableNames.ServiceProxyDNSName_VariableName] = { component: this.serviceProxyDNSInput };
		this.inputComponents[VariableNames.ServiceProxyPort_VariableName] = { component: this.serviceProxyPortInput };

		this.appServiceProxyNameLabel = createLabel(view, { text: localize('deployCluster.AppServiceProxyText', "Application proxy"), width: labelWidth, required: true });
		this.appServiceProxyDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.AppServiceProxyDNSName', "Application proxy DNS name"), required: false, width: inputWidth });
		this.appServiceProxyPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.AppServiceProxyPortName', "Application proxy port"), required: true, width: NumberInputWidth, min: 1 });
		this.appServiceProxyEndpointRow = createFlexContainer(view, [this.appServiceProxyNameLabel, this.appServiceProxyDNSInput, this.appServiceProxyPortInput]);
		this.inputComponents[VariableNames.AppServiceProxyDNSName_VariableName] = { component: this.appServiceProxyDNSInput };
		this.inputComponents[VariableNames.AppServiceProxyPort_VariableName] = { component: this.appServiceProxyPortInput };

		this.readableSecondaryNameLabel = createLabel(view, { text: localize('deployCluster.ReadableSecondaryText', "Readable secondary"), width: labelWidth, required: true });
		this.readableSecondaryDNSInput = createTextInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryDNSName', "Readable secondary DNS name"), required: false, width: inputWidth });
		this.readableSecondaryPortInput = createNumberInput(view, { ariaLabel: localize('deployCluster.ReadableSecondaryPortName', "Readable secondary port"), required: false, width: NumberInputWidth, min: 1 });
		this.readableSecondaryEndpointRow = createFlexContainer(view, [this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput]);
		this.inputComponents[VariableNames.ReadableSecondaryDNSName_VariableName] = { component: this.readableSecondaryDNSInput };
		this.inputComponents[VariableNames.ReadableSecondaryPort_VariableName] = { component: this.readableSecondaryPortInput };

		return createGroupContainer(view, [this.endpointHeaderRow, this.controllerEndpointRow, this.sqlServerEndpointRow, this.gatewayEndpointRow, this.serviceProxyEndpointRow, this.appServiceProxyEndpointRow, this.readableSecondaryEndpointRow], {
			header: localize('deployCluster.EndpointSettings', "Endpoint settings"),
			collapsible: true
		});
	}

	private createStorageSection(view: azdata.ModelView): azdata.GroupContainer {
		const hintTextForStorageFields = localize('deployCluster.storageFieldTooltip', "Use controller settings");
		const controllerLabel = createLabel(view,
			{
				text: localize('deployCluster.ControllerText', "Controller"),
				width: inputWidth,
				required: true,
				description: localize('deployCluster.AdvancedStorageDescription', "By default Controller storage settings will be applied to other services as well, you can expand the advanced storage settings to configure storage for other services.")
			});
		const controllerDataStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.controllerDataStorageClass', "Controller's data storage class"), width: inputWidth, required: true });
		const controllerDataStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.controllerDataStorageClaimSize', "Controller's data storage claim size"), width: inputWidth, required: true, min: 1 });
		const controllerLogsStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.controllerLogsStorageClass', "Controller's logs storage class"), width: inputWidth, required: true });
		const controllerLogsStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.controllerLogsStorageClaimSize', "Controller's logs storage claim size"), width: inputWidth, required: true, min: 1 });

		const storagePoolLabel = createLabel(view,
			{
				text: localize('deployCluster.StoragePool', "Storage pool (HDFS)"),
				width: inputWidth,
				required: false
			});
		const storagePoolDataStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.storagePoolDataStorageClass', "Storage pool's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const storagePoolDataStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.storagePoolDataStorageClaimSize', "Storage pool's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const storagePoolLogsStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.storagePoolLogsStorageClass', "Storage pool's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const storagePoolLogsStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.storagePoolLogsStorageClaimSize', "Storage pool's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });

		const dataPoolLabel = createLabel(view,
			{
				text: localize('deployCluster.DataPool', "Data pool"),
				width: inputWidth,
				required: false
			});
		const dataPoolDataStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.dataPoolDataStorageClass', "Data pool's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const dataPoolDataStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.dataPoolDataStorageClaimSize', "Data pool's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const dataPoolLogsStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.dataPoolLogsStorageClass', "Data pool's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const dataPoolLogsStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.dataPoolLogsStorageClaimSize', "Data pool's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });


		const sqlServerMasterLabel = createLabel(view,
			{
				text: localize('deployCluster.MasterSqlText', "SQL Server Master"),
				width: inputWidth,
				required: false
			});
		const sqlServerMasterDataStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.sqlServerMasterDataStorageClass', "SQL Server master's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const sqlServerMasterDataStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.sqlServerMasterDataStorageClaimSize', "SQL Server master's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const sqlServerMasterLogsStorageClassInput = createTextInput(view, { ariaLabel: localize('deployCluster.sqlServerMasterLogsStorageClass', "SQL Server master's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const sqlServerMasterLogsStorageClaimSizeInput = createNumberInput(view, { ariaLabel: localize('deployCluster.sqlServerMasterLogsStorageClaimSize', "SQL Server master's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });

		this.inputComponents[VariableNames.ControllerDataStorageClassName_VariableName] = { component: controllerDataStorageClassInput };
		this.inputComponents[VariableNames.ControllerDataStorageSize_VariableName] = { component: controllerDataStorageClaimSizeInput };
		this.inputComponents[VariableNames.ControllerLogsStorageClassName_VariableName] = { component: controllerLogsStorageClassInput };
		this.inputComponents[VariableNames.ControllerLogsStorageSize_VariableName] = { component: controllerLogsStorageClaimSizeInput };
		this.inputComponents[VariableNames.HDFSDataStorageClassName_VariableName] = { component: storagePoolDataStorageClassInput };
		this.inputComponents[VariableNames.HDFSDataStorageSize_VariableName] = { component: storagePoolDataStorageClaimSizeInput };
		this.inputComponents[VariableNames.HDFSLogsStorageClassName_VariableName] = { component: storagePoolLogsStorageClassInput };
		this.inputComponents[VariableNames.HDFSLogsStorageSize_VariableName] = { component: storagePoolLogsStorageClaimSizeInput };
		this.inputComponents[VariableNames.DataPoolDataStorageClassName_VariableName] = { component: dataPoolDataStorageClassInput };
		this.inputComponents[VariableNames.DataPoolDataStorageSize_VariableName] = { component: dataPoolDataStorageClaimSizeInput };
		this.inputComponents[VariableNames.DataPoolLogsStorageClassName_VariableName] = { component: dataPoolLogsStorageClassInput };
		this.inputComponents[VariableNames.DataPoolLogsStorageSize_VariableName] = { component: dataPoolLogsStorageClaimSizeInput };
		this.inputComponents[VariableNames.SQLServerDataStorageClassName_VariableName] = { component: sqlServerMasterDataStorageClassInput };
		this.inputComponents[VariableNames.SQLServerDataStorageSize_VariableName] = { component: sqlServerMasterDataStorageClaimSizeInput };
		this.inputComponents[VariableNames.SQLServerLogsStorageClassName_VariableName] = { component: sqlServerMasterLogsStorageClassInput };
		this.inputComponents[VariableNames.SQLServerLogsStorageSize_VariableName] = { component: sqlServerMasterLogsStorageClaimSizeInput };

		const storageSettingTable = view.modelBuilder.declarativeTable()
			.withProperties<azdata.DeclarativeTableProperties>(
				{
					columns: [
						this.createStorageSettingColumn(localize('deployCluster.ServiceName', "Service name"), false),
						this.createStorageSettingColumn(localize('deployCluster.DataStorageClassName', "Storage class for data")),
						this.createStorageSettingColumn(localize('deployCluster.DataClaimSize', "Claim size for data (GB)")),
						this.createStorageSettingColumn(localize('deployCluster.LogStorageClassName', "Storage class for logs")),
						this.createStorageSettingColumn(localize('deployCluster.LogsClaimSize', "Claim size for logs (GB)"))
					],
					data: [[controllerLabel, controllerDataStorageClassInput, controllerDataStorageClaimSizeInput, controllerLogsStorageClassInput, controllerLogsStorageClaimSizeInput],
					[storagePoolLabel, storagePoolDataStorageClassInput, storagePoolDataStorageClaimSizeInput, storagePoolLogsStorageClassInput, storagePoolLogsStorageClaimSizeInput],
					[dataPoolLabel, dataPoolDataStorageClassInput, dataPoolDataStorageClaimSizeInput, dataPoolLogsStorageClassInput, dataPoolLogsStorageClaimSizeInput],
					[sqlServerMasterLabel, sqlServerMasterDataStorageClassInput, sqlServerMasterDataStorageClaimSizeInput, sqlServerMasterLogsStorageClassInput, sqlServerMasterLogsStorageClaimSizeInput]],
					ariaLabel: localize('deployCluster.StorageSettings', "Storage settings")
				})
			.component();
		return createGroupContainer(view, [storageSettingTable], {
			header: localize('deployCluster.StorageSectionTitle', "Storage settings"),
			collapsible: true,
			collapsed: false
		});
	}

	private createStorageSettingColumn(title: string, showText: boolean = true): azdata.DeclarativeTableColumn {
		return {
			displayName: showText ? title : '',
			ariaLabel: title,
			valueType: azdata.DeclarativeDataType.component,
			isReadOnly: true,
			width: inputWidth,
			headerCssStyles: {
				'border': 'none',
				'font-weight': 'inherit'
			},
			rowCssStyles: {
				'border': 'none'
			}
		};
	}

	public async onEnter(): Promise<void> {
		this.setInputBoxValue(VariableNames.ComputePoolScale_VariableName);
		this.setInputBoxValue(VariableNames.DataPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.HDFSPoolScale_VariableName);
		this.setInputBoxValue(VariableNames.SparkPoolScale_VariableName);
		this.setCheckboxValue(VariableNames.IncludeSpark_VariableName);
		this.setInputBoxValue(VariableNames.ControllerPort_VariableName);
		this.setInputBoxValue(VariableNames.SQLServerPort_VariableName);
		this.setInputBoxValue(VariableNames.GateWayPort_VariableName);
		this.setInputBoxValue(VariableNames.ServiceProxyPort_VariableName);
		this.setInputBoxValue(VariableNames.AppServiceProxyPort_VariableName);
		this.setInputBoxValue(VariableNames.ReadableSecondaryPort_VariableName);
		this.setInputBoxValue(VariableNames.GatewayDNSName_VariableName);
		this.setInputBoxValue(VariableNames.AppServiceProxyDNSName_VariableName);
		this.setInputBoxValue(VariableNames.SQLServerDNSName_VariableName);
		this.setInputBoxValue(VariableNames.ReadableSecondaryDNSName_VariableName);
		this.setInputBoxValue(VariableNames.ServiceProxyDNSName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerDNSName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerDataStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerDataStorageSize_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageClassName_VariableName);
		this.setInputBoxValue(VariableNames.ControllerLogsStorageSize_VariableName);
		this.endpointHeaderRow.clearItems();
		const adAuth = this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory;
		const sqlServerScale = this.wizard.model.getIntegerValue(VariableNames.SQLServerScale_VariableName);

		this.endpointSection.collapsed = !adAuth;
		if (adAuth) {
			this.endpointHeaderRow.addItems([this.endpointNameColumnHeader, this.dnsColumnHeader, this.portColumnHeader]);
		} else {
			this.endpointHeaderRow.addItems([this.endpointNameColumnHeader, this.portColumnHeader]);
		}

		getInputBoxComponent(VariableNames.ControllerDNSName_VariableName, this.inputComponents).required = adAuth;
		getInputBoxComponent(VariableNames.GatewayDNSName_VariableName, this.inputComponents).required = adAuth;
		getInputBoxComponent(VariableNames.AppServiceProxyDNSName_VariableName, this.inputComponents).required = adAuth;
		getInputBoxComponent(VariableNames.ServiceProxyDNSName_VariableName, this.inputComponents).required = adAuth;
		getInputBoxComponent(VariableNames.SQLServerDNSName_VariableName, this.inputComponents).required = adAuth;
		getInputBoxComponent(VariableNames.ReadableSecondaryDNSName_VariableName, this.inputComponents).required = adAuth && sqlServerScale > 1;
		getInputBoxComponent(VariableNames.ReadableSecondaryPort_VariableName, this.inputComponents).required = sqlServerScale > 1;
		this.loadEndpointRow(this.controllerEndpointRow, this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput);
		this.loadEndpointRow(this.gatewayEndpointRow, this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput);
		this.loadEndpointRow(this.sqlServerEndpointRow, this.SqlServerNameLabel, this.sqlServerDNSInput, this.sqlServerPortInput);
		this.loadEndpointRow(this.appServiceProxyEndpointRow, this.appServiceProxyNameLabel, this.appServiceProxyDNSInput, this.appServiceProxyPortInput);
		this.loadEndpointRow(this.serviceProxyEndpointRow, this.serviceProxyNameLabel, this.serviceProxyDNSInput, this.serviceProxyPortInput);
		const sqlServerScaleDropdown = getDropdownComponent(VariableNames.SQLServerScale_VariableName, this.inputComponents);
		if (sqlServerScale > 1) {
			sqlServerScaleDropdown.values = ['3', '4', '5', '6', '7', '8', '9'];
			this.loadEndpointRow(this.readableSecondaryEndpointRow, this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput);
		} else {
			this.readableSecondaryEndpointRow.clearItems();
			sqlServerScaleDropdown.values = ['1'];
		}
		sqlServerScaleDropdown.value = sqlServerScale.toString();

		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const sparkEnabled = Number.parseInt(getInputBoxComponent(VariableNames.SparkPoolScale_VariableName, this.inputComponents).value!) !== 0
					|| getCheckboxComponent(VariableNames.IncludeSpark_VariableName, this.inputComponents).checked!;

				let errorMessage: string | undefined;
				if (!sparkEnabled) {
					errorMessage = localize('deployCluster.SparkMustBeIncluded', "Invalid Spark configuration, you must check the 'Include Spark' checkbox or set the 'Spark pool instances' to at least 1.");
				}
				if (errorMessage) {
					this.wizard.wizardObject.message = {
						text: errorMessage,
						level: azdata.window.MessageLevel.Error
					};
				}
				return sparkEnabled;
			}
			return true;
		});
	}

	public onLeave(): void {
		setModelValues(this.inputComponents, this.wizard.model);
		Object.assign(this.wizard.inputComponents, this.inputComponents);
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
