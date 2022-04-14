/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { MigrationStateModel, NetworkContainerType, Page } from '../models/stateMachine';
import * as loc from '../constants/strings';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SKURecommendationPage } from './skuRecommendationPage';
import { DatabaseBackupPage } from './databaseBackupPage';
import { TargetSelectionPage } from './targetSelectionPage';
import { IntergrationRuntimePage } from './integrationRuntimePage';
import { SummaryPage } from './summaryPage';
import { MigrationModePage } from './migrationModePage';
import { DatabaseSelectorPage } from './databaseSelectorPage';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews, logError } from '../telemtery';
import * as styles from '../constants/styles';
import { MigrationLocalStorage, MigrationServiceContext } from '../models/migrationLocalStorage';
import { azureResource } from 'azurecore';

export const WIZARD_INPUT_COMPONENT_WIDTH = '600px';
export class WizardController {
	private _wizardObject!: azdata.window.Wizard;
	private _disposables: vscode.Disposable[] = [];
	constructor(
		private readonly extensionContext: vscode.ExtensionContext,
		private readonly _model: MigrationStateModel,
		private readonly _onClosedCallback: () => Promise<void>) {
	}

	public async openWizard(connectionId: string): Promise<void> {
		const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
		if (api) {
			this.extensionContext.subscriptions.push(this._model);
			await this.createWizard(this._model);
		}
	}

	private async createWizard(stateModel: MigrationStateModel): Promise<void> {
		const serverName = (await stateModel.getSourceConnectionProfile()).serverName;
		this._wizardObject = azdata.window.createWizard(loc.WIZARD_TITLE(serverName), 'MigrationWizard', 'wide');
		this._wizardObject.generateScriptButton.enabled = false;
		this._wizardObject.generateScriptButton.hidden = true;
		const saveAndCloseButton = azdata.window.createButton(loc.SAVE_AND_CLOSE);
		this._wizardObject.customButtons = [saveAndCloseButton];
		const databaseSelectorPage = new DatabaseSelectorPage(this._wizardObject, stateModel);
		const skuRecommendationPage = new SKURecommendationPage(this._wizardObject, stateModel);
		const targetSelectionPage = new TargetSelectionPage(this._wizardObject, stateModel);
		const migrationModePage = new MigrationModePage(this._wizardObject, stateModel);
		const databaseBackupPage = new DatabaseBackupPage(this._wizardObject, stateModel);
		const integrationRuntimePage = new IntergrationRuntimePage(this._wizardObject, stateModel);
		const summaryPage = new SummaryPage(this._wizardObject, stateModel);

		const pages: MigrationWizardPage[] = [
			databaseSelectorPage,
			skuRecommendationPage,
			targetSelectionPage,
			migrationModePage,
			databaseBackupPage,
			integrationRuntimePage,
			summaryPage
		];

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
			if (this._model.savedInfo.closedPage >= Page.MigrationMode) {
				this._model.refreshDatabaseBackupPage = true;
			}

			// if the user selected network share and selected save & close afterwards, it should always return to the database backup page so that
			// the user can input their password again
			if (this._model.savedInfo.closedPage >= Page.DatabaseBackup && this._model.savedInfo.networkContainerType === NetworkContainerType.NETWORK_SHARE) {
				wizardSetupPromises.push(this._wizardObject.setCurrentPage(Page.DatabaseBackup));
			} else {
				wizardSetupPromises.push(this._wizardObject.setCurrentPage(this._model.savedInfo.closedPage));
			}
		}

		this._model.extensionContext.subscriptions.push(this._wizardObject.onPageChanged(async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			const newPage = pageChangeInfo.newPage;
			const lastPage = pageChangeInfo.lastPage;
			this.sendPageButtonClickEvent(pageChangeInfo).catch(e => logError(TelemetryViews.MigrationWizardController, 'ErrorSendingPageButtonClick', e));
			await pages[lastPage]?.onPageLeave(pageChangeInfo);
			await pages[newPage]?.onPageEnter(pageChangeInfo);
		}));

		this._wizardObject.registerNavigationValidator(async validator => {
			// const lastPage = validator.lastPage;

			// const canLeave = await pages[lastPage]?.canLeave() ?? true;
			// const canEnter = await pages[lastPage]?.canEnter() ?? true;

			// return canEnter && canLeave;
			return true;
		});

		await Promise.all(wizardSetupPromises);
		this._model.extensionContext.subscriptions.push(
			this._wizardObject.onPageChanged(
				async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
					await pages[0].onPageEnter(pageChangeInfo);
				}));

		this._disposables.push(saveAndCloseButton.onClick(async () => {
			await stateModel.saveInfo(serverName, this._wizardObject.currentPage);
			await this._wizardObject.close();

			if (stateModel.performanceCollectionInProgress()) {
				void vscode.window.showInformationMessage(loc.SAVE_AND_CLOSE_POPUP);
			}
		}));

		this._disposables.push(this._wizardObject.cancelButton.onClick(e => {
			sendSqlMigrationActionEvent(
				TelemetryViews.SqlMigrationWizard,
				TelemetryAction.PageButtonClick,
				{
					...this.getTelemetryProps(),
					'buttonPressed': TelemetryAction.Cancel,
					'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
				}, {});
		}));

		this._wizardObject.doneButton.label = loc.START_MIGRATION_TEXT;

		this._disposables.push(
			this._wizardObject.doneButton.onClick(async (e) => {
				await stateModel.startMigration();
				await this.updateServiceContext(stateModel);
				await this._onClosedCallback();

				sendSqlMigrationActionEvent(
					TelemetryViews.SqlMigrationWizard,
					TelemetryAction.PageButtonClick,
					{
						...this.getTelemetryProps(),
						'buttonPressed': TelemetryAction.Done,
						'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
					}, {});
			}));
	}

	private async updateServiceContext(stateModel: MigrationStateModel): Promise<void> {
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
			});
	}

	private _getResourceGroupByName(resourceGroups: azureResource.AzureResourceResourceGroup[], displayName?: string): azureResource.AzureResourceResourceGroup | undefined {
		return resourceGroups.find(rg => rg.name === displayName);
	}

	private _getLocationByValue(locations: azureResource.AzureLocation[], name?: string): azureResource.AzureLocation | undefined {
		return locations.find(loc => loc.name === name);
	}

	private _getSubscriptionFromResourceId(subscriptions: azureResource.AzureResourceSubscription[], resourceId?: string): azureResource.AzureResourceSubscription | undefined {
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

	private async sendPageButtonClickEvent(pageChangeInfo: azdata.window.WizardPageChangeInfo) {
		const buttonPressed = pageChangeInfo.newPage > pageChangeInfo.lastPage ? TelemetryAction.Next : TelemetryAction.Prev;
		const pageTitle = this._wizardObject.pages[pageChangeInfo.lastPage]?.title;
		sendSqlMigrationActionEvent(
			TelemetryViews.SqlMigrationWizard,
			TelemetryAction.PageButtonClick,
			{
				...this.getTelemetryProps(),
				'buttonPressed': buttonPressed,
				'pageTitle': pageTitle
			}, {});
	}

	private getTelemetryProps() {
		return {
			'sessionId': this._model._sessionId,
			'subscriptionId': this._model._targetSubscription?.id,
			'resourceGroup': this._model._resourceGroup?.name,
			'targetType': this._model._targetType,
			'tenantId': this._model?._azureAccount?.properties?.tenants[0]?.id
		};
	}
}

export function createInformationRow(view: azdata.ModelView, label: string, value: string): azdata.FlexContainer {
	return view.modelBuilder.flexContainer()
		.withLayout(
			{
				flexFlow: 'row',
				alignItems: 'center',
			})
		.withItems(
			[
				createLabelTextComponent(view, label,
					{
						...styles.BODY_CSS,
						'margin': '4px 0px',
						'width': '300px',
					}
				),
				createTextComponent(view, value,
					{
						...styles.BODY_CSS,
						'margin': '4px 0px',
						'width': '300px',
					}
				)
			]).component();
}

export async function createHeadingTextComponent(view: azdata.ModelView, value: string, firstElement: boolean = false): Promise<azdata.TextComponent> {
	const component = createTextComponent(view, value);
	await component.updateCssStyles({
		...styles.LABEL_CSS,
		'margin-top': firstElement ? '0' : '24px'
	});
	return component;
}

export function createLabelTextComponent(view: azdata.ModelView, value: string, styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {
	const component = createTextComponent(view, value, styles);
	return component;
}

export function createTextComponent(view: azdata.ModelView, value: string, styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {
	return view.modelBuilder.text().withProps({
		value: value,
		CSSStyles: styles
	}).component();
}
