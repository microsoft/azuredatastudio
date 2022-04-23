/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, NetworkContainerType, Page, StateChangeEvent } from '../models/stateMachine';
import { CreateSqlMigrationServiceDialog } from '../dialog/createSqlMigrationService/createSqlMigrationServiceDialog';
import * as constants from '../constants/strings';
import { WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getFullResourceGroupFromId, getLocationDisplayName, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlManagedInstance, SqlVMServer } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';
import { findDropDownItemIndex, selectDropDownIndex } from '../api/utils';
import * as styles from '../constants/styles';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private _view!: azdata.ModelView;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _subscription!: azdata.TextComponent;
	private _location!: azdata.TextComponent;
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
				...styles.BODY_CSS
			},
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		const form = view.modelBuilder.formContainer()
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
			).withProps({
				CSSStyles: {
					'padding-top': '0'
				}
			}).component();

		this._disposables.push(this._view.onClosed(e => {
			this._disposables.forEach(
				d => { try { d.dispose(); } catch { } });
		}));

		await view.initializeModel(form);
	}

	public async onPageEnter(pageChangeInfo: azdata.window.WizardPageChangeInfo): Promise<void> {
		if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.IntegrationRuntime) {
			this.migrationStateModel._targetSubscription = <azureResource.AzureResourceSubscription>this.migrationStateModel.savedInfo.targetSubscription;
			this.migrationStateModel._targetServerInstance = <SqlManagedInstance | SqlVMServer>this.migrationStateModel.savedInfo.targetServerInstance;
		}

		this._subscription.value = this.migrationStateModel._targetSubscription.name;
		this._location.value = await getLocationDisplayName(this.migrationStateModel._targetServerInstance.location);
		this._dmsInfoContainer.display = (this.migrationStateModel._databaseBackup.networkContainerType === NetworkContainerType.NETWORK_SHARE && this.migrationStateModel._sqlMigrationService) ? 'inline' : 'none';
		await this.loadResourceGroupDropdown();
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
				...styles.BODY_CSS,
				'margin-bottom': '16px'
			}
		}).component();

		const subscriptionLabel = this._view.modelBuilder.text().withProps({
			value: constants.SUBSCRIPTION,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._subscription = this._view.modelBuilder.text().withProps({
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin': '0'
			}
		}).component();

		const locationLabel = this._view.modelBuilder.text().withProps({
			value: constants.LOCATION,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-top': '1em'
			}
		}).component();
		this._location = this._view.modelBuilder.text().withProps({
			enabled: false,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			CSSStyles: {
				'margin': '0'
			}
		}).component();

		const resourceGroupLabel = this._view.modelBuilder.text().withProps({
			value: constants.RESOURCE_GROUP,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();
		this._resourceGroupDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.RESOURCE_GROUP,
			placeholder: constants.SELECT_RESOURCE_GROUP,
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
				...styles.LABEL_CSS
			}
		}).component();
		this._dmsDropdown = this._view.modelBuilder.dropDown().withProps({
			ariaLabel: constants.IR_PAGE_TITLE,
			placeholder: constants.SELECT_RESOURCE_GROUP_PROMPT,
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
				...styles.BODY_CSS
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
				...styles.LABEL_CSS,
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

		const connectionLabelContainer = this._view.modelBuilder.flexContainer().component();
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
				...styles.BODY_CSS
			}
		}).component();

		const authenticationKeysLabel = this._view.modelBuilder.text().withProps({
			value: constants.AUTHENTICATION_KEYS,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		this._copy1 = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY1,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY1,
		}).component();

		this._disposables.push(this._copy1.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![0][1].value);
			void vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
		}));

		this._copy2 = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY2,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY2,
		}).component();

		this._disposables.push(this._copy2.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this._authKeyTable.dataValues![1][1].value);
			void vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
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

		this._authKeyTable = createAuthenticationKeyTable(this._view);

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
			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.IntegrationRuntime && this._resourceGroupDropdown.values) {
				this._resourceGroupDropdown.values.forEach((resource, resourceIndex) => {
					const resourceId = this.migrationStateModel.savedInfo?.migrationServiceId?.toLowerCase();
					if (resourceId && (<azdata.CategoryValue>resource).name.toLowerCase() === getFullResourceGroupFromId(resourceId)) {
						selectDropDownIndex(this._resourceGroupDropdown, resourceIndex);
					}
				});
			}
		} finally {
			this._resourceGroupDropdown.loading = false;
		}
	}

	public async populateDms(resourceGroupName: string): Promise<void> {
		this._dmsDropdown.loading = true;
		try {
			this._dmsDropdown.values = await this.migrationStateModel.getSqlMigrationServiceValues(this.migrationStateModel._targetSubscription, <SqlManagedInstance>this.migrationStateModel._targetServerInstance, resourceGroupName);
			const selectedSqlMigrationService = this._dmsDropdown.values.find(v => v.displayName.toLowerCase() === this.migrationStateModel._sqlMigrationService?.name?.toLowerCase());

			if (this.migrationStateModel.resumeAssessment && this.migrationStateModel.savedInfo.closedPage >= Page.IntegrationRuntime && this._dmsDropdown.values) {
				this._dmsDropdown.values.forEach((resource, resourceIndex) => {
					if ((<azdata.CategoryValue>resource).name.toLowerCase() === this.migrationStateModel.savedInfo?.migrationServiceId?.toLowerCase()) {
						selectDropDownIndex(this._dmsDropdown, resourceIndex);
					}
				});
			} else {
				this._dmsDropdown.value = (selectedSqlMigrationService) ? selectedSqlMigrationService : this._dmsDropdown.values[0];
			}
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
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
						text: constants.SERVICE_READY(this.migrationStateModel._sqlMigrationService!.name, this.migrationStateModel._nodeNames.join(', ')),
						style: 'success'
					});
				} else {
					await this._dmsStatusInfoBox.updateProperties(<azdata.InfoBoxComponentProperties>{
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

export function createAuthenticationKeyTable(view: azdata.ModelView,): azdata.DeclarativeTableComponent {
	const authKeyTable = view.modelBuilder.declarativeTable().withProps({
		ariaLabel: constants.DATABASE_MIGRATION_SERVICE_AUTHENTICATION_KEYS,
		columns: [
			{
				displayName: constants.NAME,
				valueType: azdata.DeclarativeDataType.string,
				width: '50px',
				isReadOnly: true,
				rowCssStyles: {
					...styles.BODY_CSS
				},
				headerCssStyles: {
					...styles.BODY_CSS,
					'font-weight': '600'
				}
			},
			{
				displayName: constants.AUTH_KEY_COLUMN_HEADER,
				valueType: azdata.DeclarativeDataType.string,
				width: '500px',
				isReadOnly: true,
				rowCssStyles: {
					...styles.BODY_CSS,

				},
				headerCssStyles: {
					...styles.BODY_CSS,
					'font-weight': '600'
				}
			},
			{
				displayName: '',
				valueType: azdata.DeclarativeDataType.component,
				width: '30px',
				isReadOnly: true,
				rowCssStyles: {
					...styles.BODY_CSS
				},
				headerCssStyles: {
					...styles.BODY_CSS
				}
			}
		],
		CSSStyles: {
			'margin-top': '5px',
			'width': WIZARD_INPUT_COMPONENT_WIDTH
		}
	}).component();
	return authKeyTable;
}
