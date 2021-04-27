/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { CreateSqlMigrationServiceDialog } from '../dialog/createSqlMigrationService/createSqlMigrationServiceDialog';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getLocationDisplayName, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private _view!: azdata.ModelView;
	private _form!: azdata.FormBuilder;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _subscription!: azdata.InputBoxComponent;
	private _location!: azdata.InputBoxComponent;
	private _resourceGroupDropdown!: azdata.DropDownComponent;
	private _dmsDropdown!: azdata.DropDownComponent;

	private _dmsStatusInfoBox!: azdata.InfoBoxComponent;
	private _authKeyTable!: azdata.DeclarativeTableComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _connectionStatusLoader!: azdata.LoadingComponent;

	private _copy1!: azdata.ButtonComponent;
	private _copy2!: azdata.ButtonComponent;
	private _refresh1!: azdata.ButtonComponent;
	private _refresh2!: azdata.ButtonComponent;


	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const createNewMigrationService = view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: '',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		createNewMigrationService.onDidClick((e) => {
			const dialog = new CreateSqlMigrationServiceDialog(this.migrationStateModel, this);
			dialog.initialize();
		});

		this._statusLoadingComponent = view.modelBuilder.loadingComponent().withItem(this.createDMSDetailsContainer()).component();

		this._form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.migrationServiceDropdownContainer()
					},
					{
						component: createNewMigrationService
					},
					{
						component: this._statusLoadingComponent
					}

				]
			);
		await view.initializeModel(this._form.component());
	}

	public async onPageEnter(): Promise<void> {
		this.populateMigrationService();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				this.wizard.message = {
					text: ''
				};
				return true;
			}
			const state = this.migrationStateModel._sqlMigrationService.properties.integrationRuntimeState;
			if (!this.migrationStateModel._sqlMigrationService) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.INVALID_SERVICE_ERROR
				};
				return false;
			}
			if (state !== 'Online') {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.SERVICE_OFFLINE_ERROR
				};
				return false;
			} else {
				this.wizard.message = {
					text: ''
				};
			}
			return true;
		});
	}

	public async onPageLeave(): Promise<void> {
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			return true;
		});
	}

	protected async handleStateChange(e: StateChangeEvent): Promise<void> {
	}

	private migrationServiceDropdownContainer(): azdata.FlexContainer {
		const descriptionText = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_DESCRIPTION,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'font-size': '13px',
			}
		}).component();

		const subscriptionLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._subscription = this._view.modelBuilder.inputBox().withProps({
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
		}).component();

		const locationLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._location = this._view.modelBuilder.inputBox().withProps({
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
		}).component();


		const resourceGroupLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();
		this._resourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true
		}).component();

		this._resourceGroupDropdown.onValueChanged(async (value) => {
			if (value) {
				this.populateDms(value);
			}
		});

		const migrationServcieDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_TITLE,
			CSSStyles: {
				'font-size': '13px',
				'font-weight': 'bold',
			}
		}).component();

		this._dmsDropdown = this._view.modelBuilder.dropDown().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true
		}).component();

		this._dmsDropdown.onValueChanged(async (value) => {
			if (value && value !== constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR) {
				this.wizard.message = {
					text: ''
				};
				const selectedIndex = (<azdata.CategoryValue[]>this._dmsDropdown.values)?.findIndex((v) => v.displayName === value);
				this.migrationStateModel._sqlMigrationService = this.migrationStateModel.getMigrationService(selectedIndex);
				this.loadMigrationServiceStatus();
			}
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			subscriptionLabel,
			this._subscription,
			locationLabel,
			this._location,
			resourceGroupLabel,
			this._resourceGroupDropdown,
			migrationServcieDropdownLabel,
			this._dmsDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	private createDMSDetailsContainer(): azdata.FlexContainer {
		const container = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		const connectionStatusLabel = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONNECTION_STATUS,
			CSSStyles: {
				'font-weight': 'bold',
				'font-size': '13px',
				'width': '130px',
				'margin': '0'
			}
		}).component();

		this._refreshButton = this._view.modelBuilder.button().withProps({
			iconWidth: '18px',
			iconHeight: '18px',
			iconPath: IconPathHelper.refresh,
			height: '18px',
			width: '18px'
		}).component();

		this._refreshButton.onDidClick(async (e) => {
			this._connectionStatusLoader.loading = true;
			await this.loadStatus();
			this._connectionStatusLoader.loading = false;
		});

		const connectionLabelContainer = this._view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin-bottom': '13px'
			}
		}).component();

		connectionLabelContainer.addItem(connectionStatusLabel, {
			flex: '0'
		});

		connectionLabelContainer.addItem(this._refreshButton, {
			flex: '0',
			CSSStyles: { 'margin-right': '10px' }
		});

		const statusContainer = this._view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();

		this._dmsStatusInfoBox = this._view.modelBuilder.infoBox().withProps({
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			style: 'error',
			text: '',
			CSSStyles: {
				'font-size': '13px'
			}
		}).component();

		const authenticationKeysLabel = this._view.modelBuilder.text().withProps({
			value: constants.AUTHENTICATION_KEYS,
			CSSStyles: {
				'font-weight': 'bold',
				'font-size': '13px'
			}
		}).component();

		this._copy1 = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.copy,
		}).component();

		this._copy1.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![0][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		this._copy2 = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.copy
		}).component();

		this._copy2.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![1][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
		});

		this._refresh1 = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh
		}).component();

		this._refresh2 = this._view.modelBuilder.button().withProps({
			iconPath: IconPathHelper.refresh,
		}).component();
		this._authKeyTable = this._view.modelBuilder.declarativeTable().withProps({
			columns: [
				{
					displayName: constants.NAME,
					valueType: azdata.DeclarativeDataType.string,
					width: '50px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px'
					},
					headerCssStyles: {
						'font-size': '13px'
					}
				},
				{
					displayName: constants.AUTH_KEY_COLUMN_HEADER,
					valueType: azdata.DeclarativeDataType.string,
					width: '500px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px',

					},
					headerCssStyles: {
						'font-size': '13px'
					}
				},
				{
					displayName: '',
					valueType: azdata.DeclarativeDataType.component,
					width: '30px',
					isReadOnly: true,
					rowCssStyles: {
						'font-size': '13px'
					},
					headerCssStyles: {
						'font-size': '13px'
					}
				}
			],
			CSSStyles: {
				'margin-top': '5px',
				'width': WIZARD_INPUT_COMPONENT_WIDTH
			}
		}).component();

		statusContainer.addItems([
			this._dmsStatusInfoBox,
			authenticationKeysLabel,
			this._authKeyTable
		]);

		this._connectionStatusLoader = this._view.modelBuilder.loadingComponent().withItem(
			statusContainer
		).withProps({
			loading: false
		}).component();

		container.addItems(
			[
				connectionLabelContainer,
				this._connectionStatusLoader
			]
		);

		return container;
	}

	public async populateMigrationService(sqlMigrationService?: SqlMigrationService, serviceNodes?: string[], resourceGroupName?: string): Promise<void> {
		this._resourceGroupDropdown.loading = true;
		this._dmsDropdown.loading = true;
		if (sqlMigrationService && serviceNodes) {
			this.migrationStateModel._sqlMigrationService = sqlMigrationService;
			this.migrationStateModel._nodeNames = serviceNodes;
		}
		try {
			this._subscription.value = this.migrationStateModel._targetSubscription.name;
			this._location.value = await getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);
			this._resourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._targetSubscription);

			let index = 0;
			if (resourceGroupName) {
				index = (<azdata.CategoryValue[]>this._resourceGroupDropdown.values).findIndex(v => v.displayName.toLowerCase() === resourceGroupName.toLowerCase());
			}
			if ((<azdata.CategoryValue>this._resourceGroupDropdown.value)?.displayName.toLowerCase() === (<azdata.CategoryValue>this._resourceGroupDropdown.values[index])?.displayName.toLowerCase()) {
				this.populateDms((<azdata.CategoryValue>this._resourceGroupDropdown.value)?.displayName);
			} else {
				this._resourceGroupDropdown.value = this._resourceGroupDropdown.values[index];
			}
		} catch (error) {
			console.log(error);
		} finally {
			this._resourceGroupDropdown.loading = false;
		}

	}

	public async populateDms(resourceGroupName: string): Promise<void> {
		if (!resourceGroupName) {
			return;
		}
		this._dmsDropdown.loading = true;
		try {
			this._dmsDropdown.values = await this.migrationStateModel.getSqlMigrationServiceValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._targetServerInstance, resourceGroupName);
			let index = -1;
			if (this.migrationStateModel._sqlMigrationService) {
				index = (<azdata.CategoryValue[]>this._dmsDropdown.values).findIndex(v => v.displayName.toLowerCase() === this.migrationStateModel._sqlMigrationService.name.toLowerCase());
			}
			if (index !== -1) {
				this._dmsDropdown.value = this._dmsDropdown.values[index];
			} else {
				this._dmsDropdown.value = this._dmsDropdown.values[0];
			}
		} catch (e) {
			console.log(e);
		} finally {
			this._dmsDropdown.loading = false;
		}

	}

	private async loadMigrationServiceStatus(): Promise<void> {
		this._statusLoadingComponent.loading = true;
		try {
			await this.loadStatus();
		} catch (error) {
			console.log(error);
		} finally {
			this._statusLoadingComponent.loading = false;
		}
	}

	private async loadStatus(): Promise<void> {
		try {
			if (this.migrationStateModel._sqlMigrationService) {
				const migrationService = await getSqlMigrationService(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService.name);
				this.migrationStateModel._sqlMigrationService = migrationService;
				const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name);
				this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map(node => node.nodeName);
				const migrationServiceAuthKeys = await getSqlMigrationServiceAuthKeys(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name
				);

				this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map((node) => {
					return node.nodeName;
				});

				const state = migrationService.properties.integrationRuntimeState;
				if (state === 'Online') {
					this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_READY(this.migrationStateModel._sqlMigrationService!.name, this.migrationStateModel._nodeNames.join(', ')),
						style: 'success'
					});
				} else {
					this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_NOT_READY(this.migrationStateModel._sqlMigrationService!.name),
						style: 'error'
					});
				}

				const data = [
					[
						{
							value: constants.SERVICE_KEY1_LABEL
						},
						{
							value: migrationServiceAuthKeys.authKey1
						},
						{
							value: this._view.modelBuilder.flexContainer().withItems([this._copy1, this._refresh1]).component()
						}
					],
					[
						{
							value: constants.SERVICE_KEY2_LABEL
						},
						{
							value: migrationServiceAuthKeys.authKey2
						},
						{
							value: this._view.modelBuilder.flexContainer().withItems([this._copy2, this._refresh2]).component()
						}
					]
				];

				this._authKeyTable.dataValues = data;
			}
		} catch (e) {
			console.log(e);
		}
	}
}

