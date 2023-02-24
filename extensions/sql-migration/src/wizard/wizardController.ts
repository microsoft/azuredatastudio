/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, NetworkContainerType, Page } from '../models/stateMachine';
import * as loc from '../constants/strings';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SKURecommendationPage } from './skuRecommendationPage';
import { DatabaseBackupPage } from './databaseBackupPage';
import { TargetSelectionPage } from './targetSelectionPage';
import { LoginMigrationTargetSelectionPage } from './loginMigrationTargetSelectionPage';
import { IntergrationRuntimePage } from './integrationRuntimePage';
import { SummaryPage } from './summaryPage';
import { LoginMigrationStatusPage } from './loginMigrationStatusPage';
import { DatabaseSelectorPage } from './databaseSelectorPage';
import { LoginSelectorPage } from './loginSelectorPage';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews, logError, getTelemetryProps } from '../telemetry';
import * as styles from '../constants/styles';
import { MigrationLocalStorage, MigrationServiceContext } from '../models/migrationLocalStorage';
import { azureResource } from 'azurecore';
import { ServiceContextChangeEvent } from '../dashboard/tabBase';
import { getSourceConnectionProfile } from '../api/sqlUtils';

export const WIZARD_INPUT_COMPONENT_WIDTH = '600px';
export class WizardController {
	private _wizardObject!: azdata.window.Wizard;
	private _disposables: vscode.Disposable[] = [];
	constructor(
		private readonly extensionContext: vscode.ExtensionContext,
		private readonly _model: MigrationStateModel,
		private readonly _serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>) {
	}

	public async openWizard(): Promise<void> {
		this.extensionContext.subscriptions.push(this._model);
		await this.createWizard(this._model);
	}

	public async openLoginWizard(): Promise<void> {
		this.extensionContext.subscriptions.push(this._model);
		await this.createLoginWizard(this._model);
	}

	private async createWizard(stateModel: MigrationStateModel): Promise<void> {
		const serverName = (await getSourceConnectionProfile()).serverName;
		this._wizardObject = azdata.window.createWizard(
			loc.WIZARD_TITLE(serverName),
			'MigrationWizard',
			'wide');

		this._wizardObject.generateScriptButton.enabled = false;
		this._wizardObject.generateScriptButton.hidden = true;
		this._wizardObject.nextButton.position = 'left';
		this._wizardObject.nextButton.secondary = false;
		this._wizardObject.doneButton.label = loc.START_MIGRATION_TEXT;
		this._wizardObject.doneButton.position = 'left';
		this._wizardObject.doneButton.secondary = false;
		this._wizardObject.backButton.position = 'left';
		this._wizardObject.backButton.secondary = true;
		this._wizardObject.cancelButton.position = 'left';
		this._wizardObject.cancelButton.secondary = true;

		const saveAndCloseButton = azdata.window.createButton(
			loc.SAVE_AND_CLOSE,
			'right');
		saveAndCloseButton.secondary = true;

		const validateButton = azdata.window.createButton(
			loc.RUN_VALIDATION,
			'left');
		validateButton.secondary = false;
		validateButton.hidden = true;

		const tdeMigrateButton = azdata.window.createButton(
			loc.TDE_MIGRATE_BUTTON,
			'left');
		tdeMigrateButton.secondary = false;
		tdeMigrateButton.hidden = true;

		this._wizardObject.customButtons = [validateButton, tdeMigrateButton, saveAndCloseButton];
		const databaseSelectorPage = new DatabaseSelectorPage(this._wizardObject, stateModel);
		const skuRecommendationPage = new SKURecommendationPage(this._wizardObject, stateModel);
		const targetSelectionPage = new TargetSelectionPage(this._wizardObject, stateModel);
		const integrationRuntimePage = new IntergrationRuntimePage(this._wizardObject, stateModel);
		const databaseBackupPage = new DatabaseBackupPage(this._wizardObject, stateModel);
		const summaryPage = new SummaryPage(this._wizardObject, stateModel);

		const pages: MigrationWizardPage[] = [
			databaseSelectorPage,
			skuRecommendationPage,
			targetSelectionPage,
			integrationRuntimePage,
			databaseBackupPage,
			summaryPage];

		this._wizardObject.pages = pages.map(p => p.getwizardPage());

		// kill existing data collection if user relaunches the wizard via new migration or retry existing migration
		await this._model.refreshPerfDataCollection();
		if ((!this._model.resumeAssessment || this._model.retryMigration) && this._model._perfDataCollectionIsCollecting) {
			void this._model.stopPerfDataCollection();
			void vscode.window.showInformationMessage(loc.AZURE_RECOMMENDATION_STOP_POPUP);
		}

		const wizardSetupPromises: Thenable<void>[] = [];
		wizardSetupPromises.push(...pages.map(p => p.registerWizardContent()));
		wizardSetupPromises.push(this._wizardObject.open());
		if (this._model.retryMigration || this._model.resumeAssessment) {
			if (this._model.savedInfo.closedPage >= Page.IntegrationRuntime) {
				this._model.refreshDatabaseBackupPage = true;
			}

			if (this._model.savedInfo.closedPage >= Page.IntegrationRuntime && this._model.isSqlDbTarget) {
				// if the user selected the tables and selected save & close afterwards in SQLDB scenario,
				// it should always return to the target database selection page so that the user can input their password again
				wizardSetupPromises.push(this._wizardObject.setCurrentPage(Page.TargetSelection));
			} else if (this._model.savedInfo.closedPage >= Page.IntegrationRuntime &&
				this._model.savedInfo.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
				// if the user selected network share and selected save & close afterwards, it should always return to the database backup page so that
				// the user can input their password again
				wizardSetupPromises.push(this._wizardObject.setCurrentPage(Page.IntegrationRuntime));
			} else {
				wizardSetupPromises.push(this._wizardObject.setCurrentPage(this._model.savedInfo.closedPage));
			}
		}

		this._model.extensionContext.subscriptions.push(
			this._wizardObject.onPageChanged(
				async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
					const newPage = pageChangeInfo.newPage;
					const lastPage = pageChangeInfo.lastPage;
					this.sendPageButtonClickEvent(TelemetryViews.SqlMigrationWizard, pageChangeInfo)
						.catch(e => logError(
							TelemetryViews.MigrationWizardController,
							'ErrorSendingPageButtonClick', e));
					await pages[lastPage]?.onPageLeave(pageChangeInfo);
					await pages[newPage]?.onPageEnter(pageChangeInfo);
				}));

		this._wizardObject.registerNavigationValidator(async validator => true);

		await Promise.all(wizardSetupPromises);
		this._model.extensionContext.subscriptions.push(
			this._wizardObject.onPageChanged(
				async (pageChangeInfo: azdata.window.WizardPageChangeInfo) =>
					await pages[0].onPageEnter(pageChangeInfo)));

		this._disposables.push(
			saveAndCloseButton.onClick(async () => {
				await stateModel.saveInfo(serverName, this._wizardObject.currentPage);
				await this._wizardObject.close();

				if (stateModel.performanceCollectionInProgress()) {
					void vscode.window.showInformationMessage(loc.SAVE_AND_CLOSE_POPUP);
				}
			}));

		this._disposables.push(
			this._wizardObject.cancelButton.onClick(e => {
				sendSqlMigrationActionEvent(
					TelemetryViews.SqlMigrationWizard,
					TelemetryAction.PageButtonClick,
					{
						...getTelemetryProps(this._model),
						'buttonPressed': TelemetryAction.Cancel,
						'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
					},
					{});
			}));

		this._disposables.push(
			this._wizardObject.doneButton.onClick(async (e) => {
				try {
					await stateModel.startMigration();
					await this.updateServiceContext(stateModel, this._serviceContextChangedEvent);
				} catch (e) {
					logError(TelemetryViews.MigrationWizardController, 'StartMigrationFailed', e);
				} finally {
					sendSqlMigrationActionEvent(
						TelemetryViews.SqlMigrationWizard,
						TelemetryAction.PageButtonClick,
						{
							...getTelemetryProps(this._model),
							'buttonPressed': TelemetryAction.Done,
							'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
						},
						{});
				}
			}));
	}

	private async createLoginWizard(stateModel: MigrationStateModel): Promise<void> {
		const serverName = (await getSourceConnectionProfile()).serverName;
		this._wizardObject = azdata.window.createWizard(
			loc.LOGIN_WIZARD_TITLE(serverName),
			'LoginMigrationWizard',
			'wide');

		this._wizardObject.generateScriptButton.enabled = false;
		this._wizardObject.generateScriptButton.hidden = true;
		const targetSelectionPage = new LoginMigrationTargetSelectionPage(this._wizardObject, stateModel);
		const loginSelectorPage = new LoginSelectorPage(this._wizardObject, stateModel);
		const migrationStatusPage = new LoginMigrationStatusPage(this._wizardObject, stateModel);

		const pages: MigrationWizardPage[] = [
			targetSelectionPage,
			loginSelectorPage,
			migrationStatusPage
		];

		this._wizardObject.pages = pages.map(p => p.getwizardPage());

		const wizardSetupPromises: Thenable<void>[] = [];
		wizardSetupPromises.push(...pages.map(p => p.registerWizardContent()));
		wizardSetupPromises.push(this._wizardObject.open());

		this._model.extensionContext.subscriptions.push(
			this._wizardObject.onPageChanged(
				async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
					const newPage = pageChangeInfo.newPage;
					const lastPage = pageChangeInfo.lastPage;
					this.sendPageButtonClickEvent(TelemetryViews.LoginMigrationWizard, pageChangeInfo)
						.catch(e => logError(
							TelemetryViews.LoginMigrationWizardController,
							'ErrorSendingPageButtonClick', e));
					await pages[lastPage]?.onPageLeave(pageChangeInfo);
					await pages[newPage]?.onPageEnter(pageChangeInfo);
				}));

		this._wizardObject.registerNavigationValidator(async validator => {
			return true;
		});

		await Promise.all(wizardSetupPromises);

		this._disposables.push(
			this._wizardObject.cancelButton.onClick(e => {
				// TODO AKMA: add dialog prompting confirmation of cancel if migration is in progress

				sendSqlMigrationActionEvent(
					TelemetryViews.LoginMigrationWizard,
					TelemetryAction.PageButtonClick,
					{
						...getTelemetryProps(this._model),
						'buttonPressed': TelemetryAction.Cancel,
						'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
					},
					{});
			}));

		this._disposables.push(
			this._wizardObject.doneButton.onClick(async (e) => {
				sendSqlMigrationActionEvent(
					TelemetryViews.LoginMigrationWizard,
					TelemetryAction.PageButtonClick,
					{
						...getTelemetryProps(this._model),
						'buttonPressed': TelemetryAction.Done,
						'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
					},
					{});
			}));
	}

	private async updateServiceContext(
		stateModel: MigrationStateModel,
		serviceContextChangedEvent: vscode.EventEmitter<ServiceContextChangeEvent>): Promise<void> {

		const resourceGroup = this._getResourceGroupByName(
			stateModel._resourceGroups,
			stateModel._sqlMigrationService?.properties.resourceGroup);

		const subscription = this._getSubscriptionFromResourceId(
			stateModel._subscriptions,
			resourceGroup?.id);

		const location = this._getLocationByValue(
			stateModel._locations,
			stateModel._sqlMigrationService?.location);

		return await MigrationLocalStorage.saveMigrationServiceContext(
			<MigrationServiceContext>{
				azureAccount: stateModel._azureAccount,
				tenant: stateModel._azureTenant,
				subscription: subscription,
				location: location,
				resourceGroup: resourceGroup,
				migrationService: stateModel._sqlMigrationService,
			},
			serviceContextChangedEvent);
	}

	private _getResourceGroupByName(
		resourceGroups: azureResource.AzureResourceResourceGroup[],
		displayName?: string): azureResource.AzureResourceResourceGroup | undefined {

		return resourceGroups.find(rg => rg.name === displayName);
	}

	private _getLocationByValue(
		locations: azureResource.AzureLocation[],
		name?: string): azureResource.AzureLocation | undefined {

		return locations.find(loc => loc.name === name);
	}

	private _getSubscriptionFromResourceId(
		subscriptions: azureResource.AzureResourceSubscription[],
		resourceId?: string): azureResource.AzureResourceSubscription | undefined {

		let parts = resourceId?.split('/subscriptions/');
		if (parts?.length && parts?.length > 1) {
			parts = parts[1]?.split('/resourcegroups/');
			if (parts?.length && parts?.length > 0) {
				const subscriptionId: string = parts[0];
				return subscriptions.find(sub => sub.id === subscriptionId, 1);
			}
		}
		return undefined;
	}

	private async sendPageButtonClickEvent(telemetryVew: TelemetryViews, pageChangeInfo: azdata.window.WizardPageChangeInfo) {
		const buttonPressed = pageChangeInfo.newPage > pageChangeInfo.lastPage
			? TelemetryAction.Next
			: TelemetryAction.Prev;
		const pageTitle = this._wizardObject.pages[pageChangeInfo.lastPage]?.title;
		sendSqlMigrationActionEvent(
			telemetryVew,
			TelemetryAction.PageButtonClick,
			{
				...getTelemetryProps(this._model),
				'buttonPressed': buttonPressed,
				'pageTitle': pageTitle
			},
			{});
	}

}

export function createInformationRow(
	view: azdata.ModelView,
	label: string,
	value: string): azdata.FlexContainer {

	return view.modelBuilder.flexContainer()
		.withLayout({ flexFlow: 'row', alignItems: 'center', })
		.withItems([
			createLabelTextComponent(
				view,
				label,
				{
					...styles.BODY_CSS,
					'margin': '4px 0px',
					'width': '300px',
				}),
			createTextComponent(
				view,
				value,
				{
					...styles.BODY_CSS,
					'margin': '4px 0px',
					'width': '300px',
				})])
		.component();
}

export async function createHeadingTextComponent(
	view: azdata.ModelView,
	value: string,
	firstElement: boolean = false): Promise<azdata.TextComponent> {

	const component = createTextComponent(view, value);
	await component.updateCssStyles({
		...styles.LABEL_CSS,
		'margin-top': firstElement ? '0' : '24px'
	});
	return component;
}

export function createLabelTextComponent(
	view: azdata.ModelView,
	value: string,
	styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {

	return createTextComponent(view, value, styles);
}

export function createTextComponent(
	view: azdata.ModelView,
	value: string,
	styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {

	return view.modelBuilder.text()
		.withProps({ value: value, CSSStyles: styles })
		.component();
}
