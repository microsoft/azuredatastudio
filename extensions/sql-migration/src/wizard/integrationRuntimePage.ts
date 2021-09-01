/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, NetworkContainerType, StateChangeEvent } from '../models/stateMachine';
import { CreateSqlMigrationServiceDialog } from '../dialog/createSqlMigrationService/createSqlMigrationServiceDialog';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getLocationDisplayName, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlManagedInstance } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';
import { findDropDownItemIndex } from '../api/utils';
import * as styles from '../constants/styles';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private _view!: azdata.ModelView;
	private _form!: azdata.FormBuilder;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _subscription!: azdata.InputBoxComponent;
	private _location!: azdata.InputBoxComponent;
	private _resourceGroupDropdown!: azdata.DropDownComponent;
	private _dmsDropdown!: azdata.DropDownComponent;

	private _dmsInfoContainer!: azdata.FlexContainer;
	private _dmsStatusInfoBox!: azdata.InfoBoxComponent;
	private _authKeyTable!: azdata.DeclarativeTableComponent;
	private _refreshButton!: azdata.ButtonComponent;
	private _connectionStatusLoader!: azdata.LoadingComponent;

	private _copy1!: azdata.ButtonComponent;
	private _copy2!: azdata.ButtonComponent;
	private _refresh1!: azdata.ButtonComponent;
	private _refresh2!: azdata.ButtonComponent;
	private _disposables: vscode.Disposable[] = [];

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		this._statusLoadingComponent = view.modelBuilder.loadingComponent().withItem(this.createDMSDetailsContainer()).component();

		this._dmsInfoContainer = this._view.modelBuilder.flexContainer().withItems([
			this._statusLoadingComponent
		]).component();
		const dmsPortalInfo = this._view.modelBuilder.infoBox().withProps({
			text: constants.DMS_PORTAL_INFO,
			style: 'information',
			CSSStyles: {
				...styles.bodyCSS
			},
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		this._form = view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.migrationServiceDropdownContainer()
					},
					{
						component: dmsPortalInfo
					},
					{
						component: this._dmsInfoContainer
					}

				]
			);

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(this._form.component());
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {

		this._subscription.value = this.migrationStateModel._targetSubscription.name;
		this._location.value = await getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);
		this._dmsInfoContainer.display = (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE && this.migrationStateModel._sqlMigrationService) ? 'inline' : 'none';
		this.loadResourceGroupDropdown();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				this.wizard.message = {
					text: ''
				};
				return true;
			}
			const state = this.migrationStateModel._sqlMigrationService?.properties?.integrationRuntimeState;
			if (!this.migrationStateModel._sqlMigrationService) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.INVALID_SERVICE_ERROR
				};
				return false;
			}
			if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE && state !== 'Online') {
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

	public async onPageLeave(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
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
				...styles.bodyCSS
			}
		}).component();

		const subscriptionLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			requiredIndicator: true,
			CSSStyles: {
				...styles.labelCSS
			}
		}).component();
		this._subscription = this._view.modelBuilder.inputBox().withProps({
			enabled: false,
			required: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();

		const locationLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			requiredIndicator: true,
			CSSStyles: {
				...styles.labelCSS
			}
		}).component();
		this._location = this._view.modelBuilder.inputBox().withProps({
			enabled: false,
			required: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();

		const resourceGroupLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			requiredIndicator: true,
			CSSStyles: {
				...styles.labelCSS
			}
		}).component();
		this._resourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();
		this._disposables.push(this._resourceGroupDropdown.onValueChanged(async (value) => {
			const selectedIndex = findDropDownItemIndex(this._resourceGroupDropdown, value);
			this.migrationStateModel._sqlMigrationServiceResourceGroup = this.migrationStateModel.getAzureResourceGroup(selectedIndex).name;
			if (selectedIndex > -1) {
				await this.populateDms(value);
			}
		}));

		const migrationServiceDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_TITLE,
			requiredIndicator: true,
			CSSStyles: {
				...styles.labelCSS
			}
		}).component();
		this._dmsDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.IR_PAGE_TITLE,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			editable: true,
			required: true,
			fireOnTextChange: true,
			CSSStyles: {
				'margin-top': '-1em'
			}
		}).component();
		this._disposables.push(this._dmsDropdown.onValueChanged(async (value) => {
			if (value && value !== constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR) {
				if (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
					this._dmsInfoContainer.display = 'inline';
				}
				this.wizard.message = {
					text: ''
				};
				const selectedIndex = findDropDownItemIndex(this._dmsDropdown, value);
				this.migrationStateModel._sqlMigrationService = this.migrationStateModel.getMigrationService(selectedIndex);
				await this.loadMigrationServiceStatus();
			} else {
				this.migrationStateModel._sqlMigrationService = undefined;
				this._dmsInfoContainer.display = 'none';
			}
		}));

		const createNewMigrationService = this._view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: '',
			CSSStyles: {
				...styles.bodyCSS
			}
		}).component();

		this._disposables.push(createNewMigrationService.onDidClick(async (e) => {
			const dialog = new CreateSqlMigrationServiceDialog();
			const createdDmsResult = await dialog.createNewDms(this.migrationStateModel, (<azdata.CategoryValue>this._resourceGroupDropdown.value).displayName);
			this.migrationStateModel._sqlMigrationServiceResourceGroup = createdDmsResult.resourceGroup;
			this.migrationStateModel._sqlMigrationService = createdDmsResult.service;
			await this.loadResourceGroupDropdown();
			await this.populateDms(createdDmsResult.resourceGroup);
		}));

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			subscriptionLabel,
			this._subscription,
			locationLabel,
			this._location,
			resourceGroupLabel,
			this._resourceGroupDropdown,
			migrationServiceDropdownLabel,
			this._dmsDropdown,
			createNewMigrationService
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
				...styles.labelCSS,
				'width': '130px'
			}
		}).component();

		this._refreshButton = this._view.modelBuilder.button().withProps({
			iconWidth: '18px',
			iconHeight: '18px',
			iconPath: IconPathHelper.refresh,
			height: '18px',
			width: '18px',
			ariaLabel: constants.REFRESH,
		}).component();

		this._disposables.push(this._refreshButton.onDidClick(async (e) => {
			this._connectionStatusLoader.loading = true;
			try {
				await this.loadStatus();
			} finally {
				this._connectionStatusLoader.loading = false;
			}
		}));

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
				...styles.bodyCSS
			}
		}).component();

		const authenticationKeysLabel = this._view.modelBuilder.text().withProps({
			value: constants.AUTHENTICATION_KEYS,
			CSSStyles: {
				...styles.labelCSS
			}
		}).component();

		this._copy1 = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY1,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY1,
		}).component();

		this._disposables.push(this._copy1.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![0][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
		}));

		this._copy2 = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY2,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY2,
		}).component();

		this._disposables.push(this._copy2.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![1][1].value);
			vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
		}));

		this._refresh1 = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY1,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY1,
		}).component();

		this._refresh2 = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY2,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY2,
		}).component();
		this._authKeyTable = this._view.modelBuilder.declarativeTable().withProps({
			ariaLabel: constants.DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS,
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


	public async loadResourceGroupDropdown(): Promise<void> {
		this._resourceGroupDropdown.loading = true;
		try {
			this._resourceGroupDropdown.values = await this.migrationStateModel.getAzureResourceGroupDropdownValues(this.migrationStateModel._targetSubscription);
			const resourceGroupDropdownValue = this._resourceGroupDropdown.values.find(v => v.displayName === this.migrationStateModel._sqlMigrationServiceResourceGroup);
			this._resourceGroupDropdown.value = (resourceGroupDropdownValue) ? resourceGroupDropdownValue : this._resourceGroupDropdown.values[0];
		} finally {
			this._resourceGroupDropdown.loading = false;
		}
	}

	public async populateDms(resourceGroupName: string): Promise<void> {
		this._dmsDropdown.loading = true;
		try {
			this._dmsDropdown.values = await this.migrationStateModel.getSqlMigrationServiceValues(this.migrationStateModel._targetSubscription, <SqlManagedInstance>this.migrationStateModel._targetServerInstance, resourceGroupName);
			const selectedSqlMigrationService = this._dmsDropdown.values.find(v => v.displayName.toLowerCase() === this.migrationStateModel._sqlMigrationService?.name.toLowerCase());
			this._dmsDropdown.value = (selectedSqlMigrationService) ? selectedSqlMigrationService : this._dmsDropdown.values[0];
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
					this.migrationStateModel._sqlMigrationService.name,
					this.migrationStateModel._sessionId);
				this.migrationStateModel._sqlMigrationService = migrationService;
				const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name,
					this.migrationStateModel._sessionId);
				this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map(node => node.nodeName);
				const migrationServiceAuthKeys = await getSqlMigrationServiceAuthKeys(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.location,
					this.migrationStateModel._sqlMigrationService!.name,
					this.migrationStateModel._sessionId
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
