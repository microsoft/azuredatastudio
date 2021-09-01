/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../mssql';
import { MigrationStateModel } from '../models/stateMachine';
import * as loc from '../constants/strings';
import { MigrationWizardPage } from '../models/migrationWizardPage';
import { SKURecommendationPage } from './skuRecommendationPage';
import { DatabaseBackupPage } from './databaseBackupPage';
import { AccountsSelectionPage } from './accountsSelectionPage';
import { IntergrationRuntimePage } from './integrationRuntimePage';
import { SummaryPage } from './summaryPage';
import { MigrationModePage } from './migrationModePage';
import { DatabaseSelectorPage } from './databaseSelectorPage';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews } from '../telemtery';

export const WIZARD_INPUT_COMPONENT_WIDTH = '600px';
export class WizardController {
	private _wizardObject!: azdata.window.Wizard;
	private _model!: MigrationStateModel;
	constructor(private readonly extensionContext: vscode.ExtensionContext, model: MigrationStateModel) {
		this._model = model;
	}

	public async openWizard(connectionId: string): Promise<void> {
		const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
		if (api) {
			this._model = new MigrationStateModel(this.extensionContext, connectionId, api.sqlMigration);
			this.extensionContext.subscriptions.push(this._model);
			this.createWizard(this._model);
		}
	}

	private async createWizard(stateModel: MigrationStateModel): Promise<void> {
		const serverName = (await stateModel.getSourceConnectionProfile()).serverName;
		this._wizardObject = azdata.window.createWizard(loc.WIZARD_TITLE(serverName), 'MigrationWizard', 'wide');
		this._wizardObject.generateScriptButton.enabled = false;
		this._wizardObject.generateScriptButton.hidden = true;
		const skuRecommendationPage = new SKURecommendationPage(this._wizardObject, stateModel);
		const migrationModePage = new MigrationModePage(this._wizardObject, stateModel);
		const databaseSelectorPage = new DatabaseSelectorPage(this._wizardObject, stateModel);
		const azureAccountsPage = new AccountsSelectionPage(this._wizardObject, stateModel);
		const databaseBackupPage = new DatabaseBackupPage(this._wizardObject, stateModel);
		const integrationRuntimePage = new IntergrationRuntimePage(this._wizardObject, stateModel);
		const summaryPage = new SummaryPage(this._wizardObject, stateModel);

		const pages: MigrationWizardPage[] = [
			azureAccountsPage,
			databaseSelectorPage,
			skuRecommendationPage,
			migrationModePage,
			databaseBackupPage,
			integrationRuntimePage,
			summaryPage
		];

		this._wizardObject.pages = pages.map(p => p.getwizardPage());

		const wizardSetupPromises: Thenable<void>[] = [];
		wizardSetupPromises.push(...pages.map(p => p.registerWizardContent()));
		wizardSetupPromises.push(this._wizardObject.open());

		this.extensionContext.subscriptions.push(this._wizardObject.onPageChanged(async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			const newPage = pageChangeInfo.newPage;
			const lastPage = pageChangeInfo.lastPage;
			this.sendPageButtonClickEvent(pageChangeInfo).catch(e => console.log(e));
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
		this.extensionContext.subscriptions.push(this._wizardObject.onPageChanged(async (pageChangeInfo: azdata.window.WizardPageChangeInfo) => {
			await pages[0].onPageEnter(pageChangeInfo);
		}));

		this.extensionContext.subscriptions.push(this._wizardObject.doneButton.onClick(async (e) => {
			await stateModel.startMigration();
		}));

		this._wizardObject.cancelButton.onClick(e => {
			sendSqlMigrationActionEvent(
				TelemetryViews.SqlMigrationWizard,
				TelemetryAction.PageButtonClick,
				{
					'sessionId': this._model._sessionId,
					'buttonPressed': 'cancel',
					'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
				}, {});
		});

		this._wizardObject.doneButton.onClick(e => {
			sendSqlMigrationActionEvent(
				TelemetryViews.SqlMigrationWizard,
				TelemetryAction.PageButtonClick,
				{
					'sessionId': this._model._sessionId,
					'buttonPressed': 'done',
					'pageTitle': this._wizardObject.pages[this._wizardObject.currentPage].title
				}, {});
		});
	}

	private async sendPageButtonClickEvent(pageChangeInfo: azdata.window.WizardPageChangeInfo) {
		const buttonPressed = pageChangeInfo.newPage > pageChangeInfo.lastPage ? 'next' : 'prev';
		const pageTitle = this._wizardObject.pages[pageChangeInfo.lastPage].title;
		sendSqlMigrationActionEvent(
			TelemetryViews.SqlMigrationWizard,
			TelemetryAction.PageButtonClick,
			{
				'sessionId': this._model._sessionId,
				'buttonPressed': buttonPressed,
				'pageTitle': pageTitle
			}, {});
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
						'margin': '0px',
						'width': '300px',
						'font-size': '13px',
						'line-height': '24px'
					}
				),
				createTextCompononent(view, value,
					{
						'margin': '0px',
						'width': '300px',
						'font-size': '13px',
						'line-height': '24px'
					}
				)
			],
			{
				CSSStyles: {
					'margin-right': '5px'
				}
			})
		.component();
}

export function createHeadingTextComponent(view: azdata.ModelView, value: string): azdata.TextComponent {
	const component = createTextCompononent(view, value);
	component.updateCssStyles({
		'font-size': '13px',
		'font-weight': 'bold',
	});
	return component;
}


export function createLabelTextComponent(view: azdata.ModelView, value: string, styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {
	const component = createTextCompononent(view, value, styles);
	return component;
}

export function createTextCompononent(view: azdata.ModelView, value: string, styles: { [key: string]: string; } = { 'width': '300px' }): azdata.TextComponent {
	return view.modelBuilder.text().withProps({
		value: value,
		CSSStyles: styles
	}).component();
}
