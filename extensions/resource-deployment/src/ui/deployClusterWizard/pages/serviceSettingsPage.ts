/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { FieldType, SectionInfo } from '../../../interfaces';
import { createFlexContainer, createGroupContainer, createLabel, createNumberInputBoxInputInfo, createSection, createInputBoxInputInfo, getCheckboxComponent, getDropdownComponent, getInputBoxComponent, InputComponentInfo, InputComponents, setModelValues, Validator, InputComponent } from '../../modelViewUtils';
import { ResourceTypePage } from '../../resourceTypePage';
import * as VariableNames from '../constants';
import { AuthenticationMode, DeployClusterWizardModel } from '../deployClusterWizardModel';
const localize = nls.loadMessageBundle();

const NumberInputWidth = '100px';
const inputWidth = '180px';
const labelWidth = '200px';

export class ServiceSettingsPage extends ResourceTypePage {
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

	constructor(private _model: DeployClusterWizardModel) {
		super(localize('deployCluster.ServiceSettingsPageTitle', "Service settings"), '', _model.wizard);
	}
	public initialize(): void {
		const self = this;
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
					inputComponents: this._model.inputComponents,
					sectionInfo: sectionInfo,
					onNewDisposableCreated: (disposable: vscode.Disposable): void => {
						self.wizard.registerDisposable(disposable);
					},
					onNewInputComponentCreated: (name: string, inputComponentInfo: InputComponentInfo<InputComponent>): void => {
						self.onNewInputComponentCreated(name, inputComponentInfo);
					},
					onNewValidatorCreated: (validator: Validator): void => {
					},
					toolsService: this.wizard.toolsService
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

	private onNewInputComponentCreated(name: string, inputComponentInfo: InputComponentInfo<InputComponent>) {
		this.inputComponents[name] = inputComponentInfo;
		this._model.inputComponents[name] = inputComponentInfo;
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
		const controllerDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ControllerDNSName', "Controller DNS name"), required: false, width: inputWidth });
		this.controllerDNSInput = controllerDNSInput.component;
		const controllerPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ControllerPortName', "Controller port"), required: true, width: NumberInputWidth, min: 1 });
		this.controllerPortInput = controllerPortInput.component;
		this.controllerEndpointRow = createFlexContainer(view, [this.controllerNameLabel, this.controllerDNSInput, this.controllerPortInput]);
		this.onNewInputComponentCreated(VariableNames.ControllerDNSName_VariableName, controllerDNSInput);
		this.onNewInputComponentCreated(VariableNames.ControllerPort_VariableName, controllerPortInput);

		this.SqlServerNameLabel = createLabel(view, { text: localize('deployCluster.MasterSqlText', "SQL Server Master"), width: labelWidth, required: true });
		const sqlServerDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.MasterSQLServerDNSName', "SQL Server Master DNS name"), required: false, width: inputWidth });
		this.sqlServerDNSInput = sqlServerDNSInput.component;
		const sqlServerPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.MasterSQLServerPortName', "SQL Server Master port"), required: true, width: NumberInputWidth, min: 1 });
		this.sqlServerPortInput = sqlServerPortInput.component;
		this.sqlServerEndpointRow = createFlexContainer(view, [this.SqlServerNameLabel, this.sqlServerDNSInput, this.sqlServerPortInput]);
		this.onNewInputComponentCreated(VariableNames.SQLServerDNSName_VariableName, sqlServerDNSInput);
		this.onNewInputComponentCreated(VariableNames.SQLServerPort_VariableName, sqlServerPortInput);

		this.gatewayNameLabel = createLabel(view, { text: localize('deployCluster.GatewayText', "Gateway"), width: labelWidth, required: true });
		const gatewayDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.GatewayDNSName', "Gateway DNS name"), required: false, width: inputWidth });
		this.gatewayDNSInput = gatewayDNSInput.component;
		const gatewayPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.GatewayPortName', "Gateway port"), required: true, width: NumberInputWidth, min: 1 });
		this.gatewayPortInput = gatewayPortInput.component;
		this.gatewayEndpointRow = createFlexContainer(view, [this.gatewayNameLabel, this.gatewayDNSInput, this.gatewayPortInput]);
		this.onNewInputComponentCreated(VariableNames.GatewayDNSName_VariableName, gatewayDNSInput);
		this.onNewInputComponentCreated(VariableNames.GateWayPort_VariableName, gatewayPortInput);

		this.serviceProxyNameLabel = createLabel(view, { text: localize('deployCluster.ServiceProxyText', "Management proxy"), width: labelWidth, required: true });
		const serviceProxyDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ServiceProxyDNSName', "Management proxy DNS name"), required: false, width: inputWidth });
		this.serviceProxyDNSInput = serviceProxyDNSInput.component;
		const serviceProxyPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ServiceProxyPortName', "Management proxy port"), required: true, width: NumberInputWidth, min: 1 });
		this.serviceProxyPortInput = serviceProxyPortInput.component;
		this.serviceProxyEndpointRow = createFlexContainer(view, [this.serviceProxyNameLabel, this.serviceProxyDNSInput, this.serviceProxyPortInput]);
		this.onNewInputComponentCreated(VariableNames.ServiceProxyDNSName_VariableName, serviceProxyDNSInput);
		this.onNewInputComponentCreated(VariableNames.ServiceProxyPort_VariableName, serviceProxyPortInput);

		this.appServiceProxyNameLabel = createLabel(view, { text: localize('deployCluster.AppServiceProxyText', "Application proxy"), width: labelWidth, required: true });
		const appServiceProxyDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.AppServiceProxyDNSName', "Application proxy DNS name"), required: false, width: inputWidth });
		this.appServiceProxyDNSInput = appServiceProxyDNSInput.component;
		const appServiceProxyPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.AppServiceProxyPortName', "Application proxy port"), required: true, width: NumberInputWidth, min: 1 });
		this.appServiceProxyPortInput = appServiceProxyPortInput.component;
		this.appServiceProxyEndpointRow = createFlexContainer(view, [this.appServiceProxyNameLabel, this.appServiceProxyDNSInput, this.appServiceProxyPortInput]);
		this.onNewInputComponentCreated(VariableNames.AppServiceProxyDNSName_VariableName, appServiceProxyDNSInput);
		this.onNewInputComponentCreated(VariableNames.AppServiceProxyPort_VariableName, appServiceProxyPortInput);

		this.readableSecondaryNameLabel = createLabel(view, { text: localize('deployCluster.ReadableSecondaryText', "Readable secondary"), width: labelWidth, required: true });
		const readableSecondaryDNSInput = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ReadableSecondaryDNSName', "Readable secondary DNS name"), required: false, width: inputWidth });
		this.readableSecondaryDNSInput = readableSecondaryDNSInput.component;
		const readableSecondaryPortInput = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.ReadableSecondaryPortName', "Readable secondary port"), required: false, width: NumberInputWidth, min: 1 });
		this.readableSecondaryPortInput = readableSecondaryPortInput.component;
		this.readableSecondaryEndpointRow = createFlexContainer(view, [this.readableSecondaryNameLabel, this.readableSecondaryDNSInput, this.readableSecondaryPortInput]);
		this.onNewInputComponentCreated(VariableNames.ReadableSecondaryDNSName_VariableName, readableSecondaryDNSInput);
		this.onNewInputComponentCreated(VariableNames.ReadableSecondaryPort_VariableName, readableSecondaryPortInput);

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
		const controllerDataStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.controllerDataStorageClass', "Controller's data storage class"), width: inputWidth, required: true });
		const controllerDataStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.controllerDataStorageClaimSize', "Controller's data storage claim size"), width: inputWidth, required: true, min: 1 });
		const controllerLogsStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.controllerLogsStorageClass', "Controller's logs storage class"), width: inputWidth, required: true });
		const controllerLogsStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.controllerLogsStorageClaimSize', "Controller's logs storage claim size"), width: inputWidth, required: true, min: 1 });

		const storagePoolLabel = createLabel(view,
			{
				text: localize('deployCluster.StoragePool', "Storage pool (HDFS)"),
				width: inputWidth,
				required: false
			});

		const storagePoolDataStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.storagePoolDataStorageClass', "Storage pool's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const storagePoolDataStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.storagePoolDataStorageClaimSize', "Storage pool's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const storagePoolLogsStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.storagePoolLogsStorageClass', "Storage pool's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const storagePoolLogsStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.storagePoolLogsStorageClaimSize', "Storage pool's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });

		const dataPoolLabel = createLabel(view,
			{
				text: localize('deployCluster.DataPool', "Data pool"),
				width: inputWidth,
				required: false
			});
		const dataPoolDataStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.dataPoolDataStorageClass', "Data pool's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const dataPoolDataStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.dataPoolDataStorageClaimSize', "Data pool's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const dataPoolLogsStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.dataPoolLogsStorageClass', "Data pool's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const dataPoolLogsStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.dataPoolLogsStorageClaimSize', "Data pool's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });


		const sqlServerMasterLabel = createLabel(view,
			{
				text: localize('deployCluster.MasterSqlText', "SQL Server Master"),
				width: inputWidth,
				required: false
			});

		const sqlServerMasterDataStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.sqlServerMasterDataStorageClass', "SQL Server master's data storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const sqlServerMasterDataStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.sqlServerMasterDataStorageClaimSize', "SQL Server master's data storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });
		const sqlServerMasterLogsStorageClassInputInfo = createInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.sqlServerMasterLogsStorageClass', "SQL Server master's logs storage class"), width: inputWidth, required: false, placeHolder: hintTextForStorageFields });
		const sqlServerMasterLogsStorageClaimSizeInputInfo = createNumberInputBoxInputInfo(view, { ariaLabel: localize('deployCluster.sqlServerMasterLogsStorageClaimSize', "SQL Server master's logs storage claim size"), width: inputWidth, required: false, min: 1, placeHolder: hintTextForStorageFields });

		this.onNewInputComponentCreated(VariableNames.ControllerDataStorageClassName_VariableName, controllerDataStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.ControllerDataStorageSize_VariableName, controllerDataStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.ControllerLogsStorageClassName_VariableName, controllerLogsStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.ControllerLogsStorageSize_VariableName, controllerLogsStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.HDFSDataStorageClassName_VariableName, storagePoolDataStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.HDFSDataStorageSize_VariableName, storagePoolDataStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.HDFSLogsStorageClassName_VariableName, storagePoolLogsStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.HDFSLogsStorageSize_VariableName, storagePoolLogsStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.DataPoolDataStorageClassName_VariableName, dataPoolDataStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.DataPoolDataStorageSize_VariableName, dataPoolDataStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.DataPoolLogsStorageClassName_VariableName, dataPoolLogsStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.DataPoolLogsStorageSize_VariableName, dataPoolLogsStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.SQLServerDataStorageClassName_VariableName, sqlServerMasterDataStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.SQLServerDataStorageSize_VariableName, sqlServerMasterDataStorageClaimSizeInputInfo);
		this.onNewInputComponentCreated(VariableNames.SQLServerLogsStorageClassName_VariableName, sqlServerMasterLogsStorageClassInputInfo);
		this.onNewInputComponentCreated(VariableNames.SQLServerLogsStorageSize_VariableName, sqlServerMasterLogsStorageClaimSizeInputInfo);

		const storageSettingTable = view.modelBuilder.declarativeTable()
			.withProps(
				{
					columns: [
						this.createStorageSettingColumn(localize('deployCluster.ServiceName', "Service name"), false),
						this.createStorageSettingColumn(localize('deployCluster.DataStorageClassName', "Storage class for data")),
						this.createStorageSettingColumn(localize('deployCluster.DataClaimSize', "Claim size for data (GB)")),
						this.createStorageSettingColumn(localize('deployCluster.LogStorageClassName', "Storage class for logs")),
						this.createStorageSettingColumn(localize('deployCluster.LogsClaimSize', "Claim size for logs (GB)"))
					],
					dataValues: [
						[{ value: controllerLabel }, { value: controllerDataStorageClassInputInfo.component }, { value: controllerDataStorageClaimSizeInputInfo.component }, { value: controllerLogsStorageClassInputInfo.component }, { value: controllerLogsStorageClaimSizeInputInfo.component }],
						[{ value: storagePoolLabel }, { value: storagePoolDataStorageClassInputInfo.component }, { value: storagePoolDataStorageClaimSizeInputInfo.component }, { value: storagePoolLogsStorageClassInputInfo.component }, { value: storagePoolLogsStorageClaimSizeInputInfo.component }],
						[{ value: dataPoolLabel }, { value: dataPoolDataStorageClassInputInfo.component }, { value: dataPoolDataStorageClaimSizeInputInfo.component }, { value: dataPoolLogsStorageClassInputInfo.component }, { value: dataPoolLogsStorageClaimSizeInputInfo.component }],
						[{ value: sqlServerMasterLabel }, { value: sqlServerMasterDataStorageClassInputInfo.component }, { value: sqlServerMasterDataStorageClaimSizeInputInfo.component }, { value: sqlServerMasterLogsStorageClassInputInfo.component }, { value: sqlServerMasterLogsStorageClaimSizeInputInfo.component }]
					],
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

	public override async onEnter(): Promise<void> {
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
		const adAuth = this._model.authenticationMode === AuthenticationMode.ActiveDirectory;
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

	public override async onLeave(): Promise<void> {
		await setModelValues(this.inputComponents, this.wizard.model);
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
		if (this._model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			row.addItem(dnsInput, itemLayout);
		}
		row.addItem(portInput);
	}
}
