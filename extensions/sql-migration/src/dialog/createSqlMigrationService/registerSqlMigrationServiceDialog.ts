/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getResourceGroupFromId, getResourceName, getSqlMigrationService, getSqlMigrationServiceAuthKeys, getSqlMigrationServiceMonitoringData, SqlMigrationService } from '../../api/azure';
import { MigrationStateModel } from '../../models/stateMachine';
import { logError, TelemetryViews } from '../../telemetry';
import * as constants from '../../constants/strings';
import { azureResource } from 'azurecore';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { createAuthenticationKeyTable } from '../../wizard/integrationRuntimePage';
import * as EventEmitter from 'events';
import * as utils from '../../api/utils';
import * as styles from '../../constants/styles';
import { CreateSqlMigrationServiceDialogResult } from './createSqlMigrationServiceDialog';

export class RegisterSqlMigrationServiceDialog {

	private _model!: MigrationStateModel;

	private _statusLoadingComponent!: azdata.LoadingComponent;
	private _refreshLoadingComponent!: azdata.LoadingComponent;
	private migrationServiceAuthKeyTable!: azdata.DeclarativeTableComponent;
	private _connectionStatus!: azdata.InfoBoxComponent;
	private _copyKey1Button!: azdata.ButtonComponent;
	private _copyKey2Button!: azdata.ButtonComponent;
	private _refreshKey1Button!: azdata.ButtonComponent;
	private _refreshKey2Button!: azdata.ButtonComponent;
	private _setupContainer!: azdata.FlexContainer;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;

	private _createdMigrationService!: SqlMigrationService;
	private _selectedResourceGroup!: azureResource.AzureResourceResourceGroup;
	private _testConnectionButton!: azdata.window.Button;

	private _doneButtonEvent: EventEmitter = new EventEmitter();

	private irNodes: string[] = [];
	private _disposables: vscode.Disposable[] = [];

	public async registerExistingDms(migrationStateModel: MigrationStateModel, dms: SqlMigrationService): Promise<CreateSqlMigrationServiceDialogResult> {
		this._createdMigrationService = dms;

		this._model = migrationStateModel;
		// this._resourceGroupPreset = resourceGroupPreset;
		this._dialogObject = azdata.window.createModelViewDialog(constants.SERVICE_CONTAINER_HEADING, 'MigrationServiceDialog', 'medium');
		this._dialogObject.okButton.position = 'left';
		this._dialogObject.cancelButton.position = 'left';

		let tab = azdata.window.createTab('');
		this._dialogObject.registerCloseValidator(async () => {
			return true;
		});
		tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			this._statusLoadingComponent = view.modelBuilder.loadingComponent().withProps({
				loadingText: constants.LOADING_MIGRATION_SERVICES,
				loading: false
			}).component();

			const creationStatusContainer = this.createServiceStatus();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this._statusLoadingComponent
					},
					{
						component: creationStatusContainer
					}
				],
				{
					horizontal: false
				}
			);

			const form = formBuilder.withLayout({ width: '100%' }).component();

			await this._connectionStatus.updateCssStyles({
				'display': 'none'
			});

			await this.refreshAuthTable(getResourceGroupFromId(dms.id));
			this._setupContainer.display = 'inline';
			this._testConnectionButton.hidden = false;
			this._statusLoadingComponent.loading = false;			//////// next

			this._disposables.push(view.onClosed(e => {
				this._disposables.forEach(
					d => { try { d.dispose(); } catch { } });
			}));

			return view.initializeModel(form);
			// .then(async () => {
			// 	// this._refreshLoadingComponent.loading = true;		// ??

			// 	try {
			// 		// await this.refreshAuthTable(getResourceGroupFromId(dms.id));

			// 	} catch (e) {
			// 		void vscode.window.showErrorMessage(e);
			// 	}
			// 	// await this._connectionStatus.updateCssStyles({
			// 	// 	'display': 'inline'
			// 	// });
			// 	this._refreshLoadingComponent.loading = false;
			// });
		});

		this._testConnectionButton = azdata.window.createButton(constants.TEST_CONNECTION);
		this._testConnectionButton.hidden = true;
		this._disposables.push(this._testConnectionButton.onClick(async (e) => {
			this._refreshLoadingComponent.loading = true;
			await this._connectionStatus.updateCssStyles({
				'display': 'none'
			});
			try {
				await this.refreshStatus(getResourceGroupFromId(dms.id));
			} catch (e) {
				void vscode.window.showErrorMessage(e);
			}
			await this._connectionStatus.updateCssStyles({
				'display': 'inline'
			});
			this._refreshLoadingComponent.loading = false;
		}));

		this._dialogObject.customButtons = [this._testConnectionButton];

		this._dialogObject.content = [tab];
		this._dialogObject.okButton.enabled = false;
		azdata.window.openDialog(this._dialogObject);
		this._disposables.push(this._dialogObject.cancelButton.onClick((e) => { }));
		this._disposables.push(this._dialogObject.okButton.onClick((e) => {
			this._doneButtonEvent.emit('done', this._createdMigrationService, this._selectedResourceGroup);
		}));

		return new Promise((resolve) => {
			this._doneButtonEvent.once('done', (createdDms: SqlMigrationService, selectedResourceGroup: azureResource.AzureResourceResourceGroup) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve(
					{
						service: createdDms,
						resourceGroup: selectedResourceGroup
					});
			});
		});
	}

	private createServiceStatus(withHeading: boolean = false): azdata.FlexContainer {

		const setupIRHeadingText = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_HEADING,
			CSSStyles: {
				...styles.LABEL_CSS
			}
		}).component();

		const setupIRdescription1 = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_DESCRIPTION1,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const setupIRdescription2 = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_CONTAINER_DESCRIPTION2,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const irSetupStep1Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP1,
			CSSStyles: {
				...styles.BODY_CSS
			},
			links: [
				{
					text: constants.SERVICE_STEP1_LINK,
					url: 'https://www.microsoft.com/download/details.aspx?id=39717'
				}
			]
		}).component();

		const irSetupStep2Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP2,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		const irSetupStep3Text = this._view.modelBuilder.text().withProps({
			value: constants.SERVICE_STEP3,
			CSSStyles: {
				'margin-top': '10px',
				'margin-bottom': '10px',
				...styles.BODY_CSS
			}
		}).component();

		this._connectionStatus = this._view.modelBuilder.infoBox().withProps({
			text: '',
			style: 'error',
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this._connectionStatus.CSSStyles = {
			'width': '350px'
		};

		this._refreshLoadingComponent = this._view.modelBuilder.loadingComponent().withProps({
			loading: false,
			CSSStyles: {
				...styles.BODY_CSS
			}
		}).component();

		this.migrationServiceAuthKeyTable = createAuthenticationKeyTable(this._view);

		this._setupContainer = this._view.modelBuilder.flexContainer().withItems(
			[
				setupIRHeadingText,
				setupIRdescription1,
				setupIRdescription2,
				irSetupStep1Text,
				irSetupStep2Text,
				this.migrationServiceAuthKeyTable,
				irSetupStep3Text,
				this._connectionStatus,
				this._refreshLoadingComponent
			], {
			CSSStyles: {
				'margin-bottom': '5px'
			}
		}
		).withLayout({
			flexFlow: 'column'
		}).component();

		this._setupContainer.display = 'none';
		this._testConnectionButton.hidden = true;
		return this._setupContainer;
	}

	private async refreshStatus(resourceGroupId: string): Promise<void> {
		const subscription = this._model._sqlMigrationServiceSubscription;
		const resourceGroup = getResourceName(resourceGroupId);
		const location = this._model._location.name;

		const maxRetries = 5;
		let migrationServiceStatus!: SqlMigrationService;
		for (let i = 0; i < maxRetries; i++) {
			try {
				utils.clearDialogMessage(this._dialogObject);
				migrationServiceStatus = await getSqlMigrationService(
					this._model._azureAccount,
					subscription,
					resourceGroup,
					location,
					this._createdMigrationService.name);
				break;
			} catch (e) {
				this._dialogObject.message = {
					text: constants.SERVICE_STATUS_REFRESH_ERROR,
					description: e.message,
					level: azdata.window.MessageLevel.Error
				};
				logError(TelemetryViews.CreateDataMigrationServiceDialog, 'FetchSqlMigrationServiceFailed', e);
			}
			await new Promise(r => setTimeout(r, 5000));
		}
		const migrationServiceMonitoringStatus = await getSqlMigrationServiceMonitoringData(
			this._model._azureAccount,
			subscription,
			resourceGroup,
			location,
			this._createdMigrationService!.name);

		this.irNodes = migrationServiceMonitoringStatus.nodes.map((node) => {
			return node.nodeName;
		});
		if (migrationServiceStatus) {
			const state = migrationServiceStatus.properties.integrationRuntimeState;

			if (state === 'Online') {
				await this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_READY(this._createdMigrationService!.name, this.irNodes.join(', ')),
					style: 'success',
					CSSStyles: {
						...styles.BODY_CSS
					}
				});
			} else {
				this._connectionStatus.text = constants.SERVICE_NOT_READY(this._createdMigrationService!.name);
				await this._connectionStatus.updateProperties(<azdata.InfoBoxComponentProperties>{
					text: constants.SERVICE_NOT_READY(this._createdMigrationService!.name),
					style: 'warning',
					CSSStyles: {
						...styles.BODY_CSS
					}
				});
			}
			this._dialogObject.okButton.enabled = true;
		}
	}
	private async refreshAuthTable(resourceGroupId: string): Promise<void> {
		const subscription = this._model._sqlMigrationServiceSubscription;
		const resourceGroup = getResourceName(resourceGroupId);
		const location = this._model._location.name;
		const keys = await getSqlMigrationServiceAuthKeys(
			this._model._azureAccount,
			subscription,
			resourceGroup,
			location,
			this._createdMigrationService!.name);

		this._copyKey1Button = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY1,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY1,
		}).component();

		this._disposables.push(this._copyKey1Button.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![0][1].value);
			void vscode.window.showInformationMessage(constants.SERVICE_KEY1_COPIED_HELP);
		}));

		this._copyKey2Button = this._view.modelBuilder.button().withProps({
			title: constants.COPY_KEY2,
			iconPath: IconPathHelper.copy,
			ariaLabel: constants.COPY_KEY2,
		}).component();

		this._disposables.push(this._copyKey2Button.onDidClick(async (e) => {
			await vscode.env.clipboard.writeText(<string>this.migrationServiceAuthKeyTable.dataValues![1][1].value);
			void vscode.window.showInformationMessage(constants.SERVICE_KEY2_COPIED_HELP);
		}));

		this._refreshKey1Button = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY1,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY1,
		}).component();

		this._disposables.push(this._refreshKey1Button.onDidClick((e) => {
			//TODO: add refresh logic
		}));

		this._refreshKey2Button = this._view.modelBuilder.button().withProps({
			title: constants.REFRESH_KEY2,
			iconPath: IconPathHelper.refresh,
			ariaLabel: constants.REFRESH_KEY2,
		}).component();

		this._disposables.push(this._refreshKey2Button.onDidClick((e) => {
			//TODO: add refresh logic
		}));

		await this.migrationServiceAuthKeyTable.updateProperties({
			dataValues: [
				[
					{
						value: constants.SERVICE_KEY1_LABEL
					},
					{
						value: keys.authKey1
					},
					{
						value: this._view.modelBuilder.flexContainer().withItems([this._copyKey1Button, this._refreshKey1Button]).component()
					}
				],
				[
					{
						value: constants.SERVICE_KEY2_LABEL
					},
					{
						value: keys.authKey2
					},
					{
						value: this._view.modelBuilder.flexContainer().withItems([this._copyKey2Button, this._refreshKey2Button]).component()
					}
				]
			]
		});

	}
}
