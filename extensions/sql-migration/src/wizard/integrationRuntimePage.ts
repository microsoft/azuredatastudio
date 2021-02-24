/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { MigrationStateModel, StateChangeEvent } from '../models/stateMachine';
import { CreateMigrationControllerDialog } from '../dialog/createMigrationDialog/createMigrationControllerDialog';
import * as constants from '../models/strings';
import { createInformationRow, WIZARD_INPUT_COMPONENT_WIDTH } from './wizardController';
import { getMigrationController, getMigrationControllerAuthKeys, getMigrationControllerMonitoringData } from '../api/azure';
import { IconPathHelper } from '../constants/iconPathHelper';

export class IntergrationRuntimePage extends MigrationWizardPage {

	private migrationControllerDropdown!: azdata.DropDownComponent;
	private _view!: azdata.ModelView;
	private _form!: azdata.FormBuilder;
	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _migrationDetailsContainer!: azdata.FlexContainer;

	constructor(wizard: azdata.window.Wizard, migrationStateModel: MigrationStateModel) {
		super(wizard, azdata.window.createWizardPage(constants.IR_PAGE_TITLE), migrationStateModel);
	}

	protected async registerContent(view: azdata.ModelView): Promise<void> {
		this._view = view;

		const createNewController = view.modelBuilder.hyperlink().withProps({
			label: constants.CREATE_NEW,
			url: ''
		}).component();

		createNewController.onDidClick((e) => {
			const dialog = new CreateMigrationControllerDialog(this.migrationStateModel, this);
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
						component: this.migrationControllerDropdownsContainer()
					},
					{
						component: createNewController
					},
					{
						component: this._statusLoadingComponent
					}

				]
			);
		await view.initializeModel(this._form.component());
	}

	public async onPageEnter(): Promise<void> {
		this.populateMigrationController();
		this.wizard.registerNavigationValidator((pageChangeInfo) => {
			if (pageChangeInfo.newPage < pageChangeInfo.lastPage) {
				this.wizard.message = {
					text: ''
				};
				return true;
			}
			const state = this.migrationStateModel._migrationController.properties.integrationRuntimeState;
			if (!this.migrationStateModel._migrationController) {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.INVALID_CONTROLLER_ERROR
				};
				return false;
			}
			if (state !== 'Online') {
				this.wizard.message = {
					level: azdata.window.MessageLevel.Error,
					text: constants.CONTROLLER_OFFLINE_ERROR
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

	private migrationControllerDropdownsContainer(): azdata.FlexContainer {
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

		const migrationControllerDropdownLabel = this._view.modelBuilder.text().withProps({
			value: constants.SELECT_A_MIGRATION_CONTROLLER
		}).component();

		this.migrationControllerDropdown = this._view.modelBuilder.dropDown().withProps({
			required: true,
			width: WIZARD_INPUT_COMPONENT_WIDTH
		}).component();

		this.migrationControllerDropdown.onValueChanged(async (value) => {
			if (value.selected) {
				this.wizard.message = {
					text: ''
				};
				this.migrationStateModel._migrationController = this.migrationStateModel.getMigrationController(value.index);
				await this.loadControllerStatus();
			}
		});

		const flexContainer = this._view.modelBuilder.flexContainer().withItems([
			descriptionText,
			noteText,
			migrationControllerDropdownLabel,
			this.migrationControllerDropdown
		]).withLayout({
			flexFlow: 'column'
		}).component();
		return flexContainer;
	}

	public async populateMigrationController(controllerStatus?: string): Promise<void> {
		this.migrationControllerDropdown.loading = true;
		try {
			this.migrationControllerDropdown.values = await this.migrationStateModel.getMigrationControllerValues(this.migrationStateModel._targetSubscription, this.migrationStateModel._targetManagedInstance);
			if (this.migrationStateModel._migrationController) {
				this.migrationControllerDropdown.value = {
					name: this.migrationStateModel._migrationController.id,
					displayName: this.migrationStateModel._migrationController.name
				};
			} else {
				this.migrationStateModel._migrationController = this.migrationStateModel.getMigrationController(0);
			}
		} catch (error) {
			console.log(error);
		} finally {
			this.migrationControllerDropdown.loading = false;
		}

	}

	private async loadControllerStatus(): Promise<void> {
		this._statusLoadingComponent.loading = true;

		try {
			this._migrationDetailsContainer.clearItems();

			if (this.migrationStateModel._migrationController) {
				const controller = await getMigrationController(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._migrationController.properties.resourceGroup,
					this.migrationStateModel._migrationController.properties.location,
					this.migrationStateModel._migrationController.name);
				this.migrationStateModel._migrationController = controller;
				const controllerMonitoringStatus = await getMigrationControllerMonitoringData(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._migrationController.properties.resourceGroup,
					this.migrationStateModel._migrationController.properties.location,
					this.migrationStateModel._migrationController!.name);
				this.migrationStateModel._nodeNames = controllerMonitoringStatus.nodes.map((node) => {
					return node.nodeName;
				});
				const migrationControllerAuthKeys = await getMigrationControllerAuthKeys(
					this.migrationStateModel._azureAccount,
					this.migrationStateModel._targetSubscription,
					this.migrationStateModel._migrationController.properties.resourceGroup,
					this.migrationStateModel._migrationController.properties.location,
					this.migrationStateModel._migrationController!.name
				);

				const migrationControllerTitle = this._view.modelBuilder.text().withProps({
					value: constants.CONTROLLER_DETAILS_HEADER(controller.name),
					CSSStyles: {
						'font-weight': 'bold'
					}
				}).component();

				const connectionStatusLabel = this._view.modelBuilder.text().withProps({
					value: constants.CONTROLLER_CONNECTION_STATUS,
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

					const controller = await getMigrationController(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._migrationController.properties.resourceGroup,
						this.migrationStateModel._migrationController.properties.location,
						this.migrationStateModel._migrationController.name);
					this.migrationStateModel._migrationController = controller;
					const controllerMonitoringStatus = await getMigrationControllerMonitoringData(
						this.migrationStateModel._azureAccount,
						this.migrationStateModel._targetSubscription,
						this.migrationStateModel._migrationController.properties.resourceGroup,
						this.migrationStateModel._migrationController.properties.location,
						this.migrationStateModel._migrationController!.name);
					this.migrationStateModel._nodeNames = controllerMonitoringStatus.nodes.map((node) => {
						return node.nodeName;
					});

					const state = controller.properties.integrationRuntimeState;
					if (state === 'Online') {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.CONTROLLER_READY(this.migrationStateModel._migrationController!.name, this.migrationStateModel._nodeNames.join(', ')),
							style: 'success'
						});
					} else {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.CONTROLLER_NOT_READY(this.migrationStateModel._migrationController!.name),
							style: 'error'
						});
					}

					connectionStatusLoader.loading = false;
				});

				if (controller) {
					const state = controller.properties.integrationRuntimeState;
					if (state === 'Online') {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.CONTROLLER_READY(this.migrationStateModel._migrationController!.name, this.migrationStateModel._nodeNames.join(', ')),
							style: 'success'
						});
					} else {
						connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
							text: constants.CONTROLLER_NOT_READY(this.migrationStateModel._migrationController!.name),
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

				const migrationControllerAuthKeyTable = this._view.modelBuilder.declarativeTable().withProps({
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
					vscode.env.clipboard.writeText(<string>migrationControllerAuthKeyTable.dataValues![0][1].value);
					vscode.window.showInformationMessage(constants.CONTROLLER_KEY_COPIED_HELP);
				});

				const copyKey2Button = this._view.modelBuilder.button().withProps({
					iconPath: IconPathHelper.copy
				}).component();

				copyKey2Button.onDidClick((e) => {
					vscode.env.clipboard.writeText(<string>migrationControllerAuthKeyTable.dataValues![1][1].value);
					vscode.window.showInformationMessage(constants.CONTROLLER_KEY_COPIED_HELP);
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


				migrationControllerAuthKeyTable.updateProperties({
					dataValues: [
						[
							{
								value: constants.CONTROLLER_KEY1_LABEL
							},
							{
								value: migrationControllerAuthKeys.authKey1
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
								value: constants.CONTROLLER_KEY2_LABEL
							},
							{
								value: migrationControllerAuthKeys.authKey2
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
						migrationControllerTitle,
						createInformationRow(this._view, constants.SUBSCRIPTION, this.migrationStateModel._targetSubscription.name),
						createInformationRow(this._view, constants.RESOURCE_GROUP, controller.properties.resourceGroup),
						createInformationRow(this._view, constants.LOCATION, controller.properties.location),
						connectionLabelContainer,
						connectionStatusLoader,
						authenticationKeysLabel,
						migrationControllerAuthKeyTable
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


