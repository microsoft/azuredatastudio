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
import { createInformationRow, WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private migrationServiceDropdown!: azdata.DropDownComponent;
	private _view!: azdata.ModelView;
	private _form!: azdata.FormBuilder;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _migrationDetailsContainer!: azdata.FlexContainer;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const createNewMigrationService = view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: ''
		}).component();

		createNewMigrationService.onDidClick((e) => {
			const dialog = new CreateSqlMigrationServiceDialog(this.migrationStateModel, this);
			dialog.initialize();
		});

		this._migrationDetailsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).component();
		this._statusLoadingComponent = view.modelBuilder.loadingComponent().withItem(this._migrationDetailsContainer).component();

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
			links: [
				{
					url: 'https://www.microsoft.com', // TODO: Add proper link
					text: constants.LEARN_MORE
				},
			]
		}).component();

		const noteText = this._view.modelBuilder.text().withProps({
			value: constants.IR_PAGE_NOTE
		}).component();

		const migrationServcieDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_A_SQL_MIGRATION_SERVICE
		}).component();

		this.migrationServiceDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		this.migrationServiceDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.wizard.message = {
					text: ''
				};
				this.migrationStateModel._sqlMigrationService = this.migrationStateModel.getMigrationService(value.index);
				if (value !== constants.SQL_MIGRATION_SERVICE_NOT_FOUND_ERROR) {
					await this.loadMigrationServiceStatus();
				}
			}
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			noteText,
			migrationServcieDropdownLabel,
			this.migrationServiceDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	public async populateMigrationService(sqlMigrationService?: SqlMigrationService, serviceNodes?: string[]): Promise<void> {
		this.migrationServiceDropdown.loading = true;
		if (sqlMigrationService && serviceNodes) {
			this.migrationStateModel._sqlMigrationService = sqlMigrationService;
			this.migrationStateModel._nodeNames = serviceNodes;
		}
		try {
			this.migrationServiceDropdown.values = await this.migrationStateModel.getSqlMigrationServiceValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._targetServerInstance);
			if (this.migrationStateModel._sqlMigrationService) {
				this.migrationServiceDropdown.value = {
					name: this.migrationStateModel._sqlMigrationService.id,
					displayName: this.migrationStateModel._sqlMigrationService.name
				};
			} else {
				this.migrationStateModel._sqlMigrationService = this.migrationStateModel.getMigrationService(0);
			}
		} catch (error) {
			console.log(error);
		} finally {
			this.migrationServiceDropdown.loading = false;
		}

	}

	private async loadMigrationServiceStatus(): Promise<void> {
		this._statusLoadingComponent.loading = true;
		try {
			this._migrationDetailsContainer.clearItems();

			if (this.migrationStateModel._sqlMigrationService) {
				const migrationService = await getSqlMigrationService(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.properties.location,
					this.migrationStateModel._sqlMigrationService.name);
				this.migrationStateModel._sqlMigrationService = migrationService;
				const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.properties.location,
					this.migrationStateModel._sqlMigrationService!.name);
				this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map((node) => {
					return node.nodeName;
				});
				const migrationServiceAuthKeys = await getSqlMigrationServiceAuthKeys(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
					this.migrationStateModel._sqlMigrationService.properties.location,
					this.migrationStateModel._sqlMigrationService!.name
				);

				const migrationServiceTitle = this._view.modelBuilder.text().withProps({
					value: constants.SQL_MIGRATION_SERVICE_DETAILS_HEADER(migrationService.name),
					CSSStyles: {
						'font-weight': 'bold'
					}
				}).component();

				const connectionStatusLabel = this._view.modelBuilder.text().withProps({
					value: constants.SERVICE_CONNECTION_STATUS,
					CSSStyles: {
						'font-weight': 'bold',
						'width': '150px'
					}
				}).component();

				const refreshStatus = this._view.modelBuilder.button().withProps({
					label: constants.REFRESH,
					secondary: true,
					width: '50px'
				}).component();



				const connectionLabelContainer = this._view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'row',
					alignItems: 'center'
				}).withItems(
					[
						connectionStatusLabel,
						refreshStatus
					],
					{
						CSSStyles: { 'margin-right': '5px' }
					}
				).component();

				const connectionStatus = this._view.modelBuilder.infoBox().component();
				const connectionStatusLoader = this._view.modelBuilder.loadingComponent().withItem(connectionStatus).withProps({
					loading: false
				}).component();
				refreshStatus.onDidClick(async (e) => {
					connectionStatusLoader.loading = true;

					const migrationService = await getSqlMigrationService(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
						this.migrationStateModel._sqlMigrationService.properties.location,
						this.migrationStateModel._sqlMigrationService.name);
					this.migrationStateModel._sqlMigrationService = migrationService;
					const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._sqlMigrationService.properties.resourceGroup,
						this.migrationStateModel._sqlMigrationService.properties.location,
						this.migrationStateModel._sqlMigrationService!.name);
					this.migrationStateModel._nodeNames = migrationServiceMonitoringStatus.nodes.map((node) => {
						return node.nodeName;
					});

					const state = migrationService.properties.integrationRuntimeState;
					if (state === 'Online') {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.SERVICE_READY(this.migrationStateModel._sqlMigrationService!.name, this.migrationStateModel._nodeNames.join(', ')),
							style: 'success'
						});
					} else {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.SERVICE_NOT_READY(this.migrationStateModel._sqlMigrationService!.name),
							style: 'error'
						});
					}

					connectionStatusLoader.loading = false;
				});

				const state = migrationService.properties.integrationRuntimeState;
				if (migrationService) {
					if (state === 'Online') {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.SERVICE_READY(this.migrationStateModel._sqlMigrationService!.name, this.migrationStateModel._nodeNames.join(', ')),
							style: 'success'
						});
					} else {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.SERVICE_NOT_READY(this.migrationStateModel._sqlMigrationService!.name),
							style: 'error'
						});
					}
				}

				const authenticationKeysLabel = this._view.modelBuilder.text().withProps({
					value: constants.AUTHENTICATION_KEYS,
					CSSStyles: {
						'font-weight': 'bold'
					}
				}).component();

				const migrationServiceAuthKeyTable = this._view.modelBuilder.declarativeTable().withProps({
					columns: [
						{
							displayName: constants.NAME,
							valueType: azdata.DeclarativeDataType.string,
							width: '50px',
							isReadOnly: true,
							rowCssStyles: {
								'text-align': 'center'
							}
						},
						{
							displayName: constants.AUTH_KEY_COLUMN_HEADER,
							valueType: azdata.DeclarativeDataType.string,
							width: '500px',
							isReadOnly: true,
							rowCssStyles: {
								overflow: 'scroll'
							}
						},
						{
							displayName: '',
							valueType: azdata.DeclarativeDataType.component,
							width: '15px',
							isReadOnly: true,
						},
						{
							displayName: '',
							valueType: azdata.DeclarativeDataType.component,
							width: '15px',
							isReadOnly: true,
						}
					],
					CSSStyles: {
						'margin-top': '5px'
					}
				}).component();


				const copyKey1Button = this._view.modelBuilder.button().withProps({
					iconPath: IconPathHelper.copy
				}).component();

				copyKey1Button.onDidClick((e) => {
					vscode.env.clipboard.writeText(<string>migrationServiceAuthKeyTable.dataValues![0][1].value);
					vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
				});

				const copyKey2Button = this._view.modelBuilder.button().withProps({
					iconPath: IconPathHelper.copy
				}).component();

				copyKey2Button.onDidClick((e) => {
					vscode.env.clipboard.writeText(<string>migrationServiceAuthKeyTable.dataValues![1][1].value);
					vscode.window.showInformationMessage(constants.SERVICE_KEY_COPIED_HELP);
				});

				const refreshKey1Button = this._view.modelBuilder.button().withProps({
					iconPath: IconPathHelper.refresh
				}).component();

				refreshKey1Button.onDidClick((e) => {//TODO: add refresh logic
				});

				const refreshKey2Button = this._view.modelBuilder.button().withProps({
					iconPath: IconPathHelper.refresh
				}).component();

				refreshKey2Button.onDidClick((e) => {//TODO: add refresh logic
				});

				migrationServiceAuthKeyTable.updateProperties({
					dataValues: [
						[
							{
								value: constants.SERVICE_KEY1_LABEL
							},
							{
								value: migrationServiceAuthKeys.authKey1
							},
							{
								value: copyKey1Button
							},
							{
								value: refreshKey1Button
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
								value: copyKey2Button
							},
							{
								value: refreshKey2Button
							}
						]
					]
				});

				this._migrationDetailsContainer.addItems(
					[
						migrationServiceTitle,
						createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
						createInformationRow(this._view, constants.RESOURCE_GROUP, migrationService.properties.resourceGroup),
						createInformationRow(this._view, constants.LOCATION, migrationService.properties.location),
						connectionLabelContainer,
						connectionStatusLoader,
						authenticationKeysLabel,
						migrationServiceAuthKeyTable
					]
				);
			}
		} catch (error) {
			console.log(error);
			this._migrationDetailsContainer.clearItems();
		} finally {
			this._statusLoadingComponent.loading = false;
		}
	}
}


