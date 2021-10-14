/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from '../../../../mssql';
import * as loc from '../../constants/strings';
import { MigrationMode, MigrationStateModel, NetworkContainerType } from '../../models/stateMachine';
import { MigrationContext } from '../../models/migrationLocalStorage';
import { WizardController } from '../../wizard/wizardController';
import { MigrationCutoverDialogModel } from '../migrationCutover/migrationCutoverDialogModel';
import * as styles from '../../constants/styles';
import { SavedInfo, Page } from '../../models/stateMachine';
import { getMigrationModeEnum } from '../../constants/helper';


export class RetryMigrationDialog {
	private _context: vscode.ExtensionContext;
	private _migration: MigrationContext;

	private static readonly OkButtonText: string = loc.NEXT_LABEL;
	private static readonly CancelButtonText: string = loc.CANCEL_LABEL;

	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _model: MigrationCutoverDialogModel;

	private _isOpen: boolean = false;
	private dialog: azdata.window.Dialog | undefined;
	private _rootContainer!: azdata.FlexContainer;
	private _disposables: vscode.Disposable[] = [];


	constructor(context: vscode.ExtensionContext, migration: MigrationContext) {
		this._context = context;
		this._migration = migration;
		this._model = new MigrationCutoverDialogModel(migration);
		this._dialogObject = azdata.window.createModelViewDialog('', 'RetryMigrationDialog', 'wide');
	}


	private createMigrationStateModel(migration: MigrationContext, connectionId: string, serverName: string, api: mssql.IExtension): MigrationStateModel {
		let stateModel = new MigrationStateModel(this._context, connectionId, api.sqlMigration);

		let savedInfo: SavedInfo;
		savedInfo = {
			closedPage: Page.Summary,

			// AzureAccount
			azureAccount: migration.azureAccount,
			azureTenant: null,

			// DatabaseSelector
			selectedDatabases: [],

			// SKURecommendation
			migrationTargetType: null,
			databaseAssessment: null,
			serverAssessment: null,
			migrationDatabases: [],
			databaseList: [],
			subscription: null,
			location: null,
			resourceGroup: null,
			targetServerInstance: migration.targetManagedInstance,

			// MigrationMode
			migrationMode: getMigrationModeEnum(migration),

			// DatabaseBackup
			networkContainerType: null,
			networkShare: null,
			targetSubscription: null,
			blobs: [],
			targetDatabaseNames: []

			// Integration Runtime
		};

		stateModel.savedInfo = savedInfo;
		stateModel.resumeAssessment = true;
		stateModel.serverName = serverName;

		return stateModel;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					this._rootContainer = this.initializePageContent(view);
					await view.initializeModel(this._rootContainer);
					this._disposables.push(dialog.okButton.onClick(async e => {
						await this.execute();
					}));
					this._disposables.push(dialog.cancelButton.onClick(e => {
						this.cancel();
					}));

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } }
						);
					}));
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(loc.RETRY_MIGRATION, loc.RETRY_MIGRATION, '60%');
			this.dialog.okButton.label = RetryMigrationDialog.OkButtonText;
			this.dialog.cancelButton.label = RetryMigrationDialog.CancelButtonText;
			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		let activeConnection = await azdata.connection.getCurrentConnection();
		let connectionId: string = '';
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				connectionId = connection.connectionId;
				serverName = connection.options.server;
			}
		} else {
			connectionId = activeConnection.connectionId;
			serverName = activeConnection.serverName;
		}

		const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
		const stateModel = this.createMigrationStateModel(this._migration, connectionId, serverName, api);

		const wizardController = new WizardController(this._context, stateModel);
		await wizardController.openWizard(stateModel.sourceConnectionId);
		this._isOpen = false;
	}

	protected cancel() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public initializePageContent(view: azdata.ModelView): azdata.FlexContainer {
		const buttonGroup = 'resumeMigration';

		const pageTitle = view.modelBuilder.text().withProps({
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin-bottom': '12px'
			},
			value: "loc.RESUME_TITLE"
		}).component();

		const radioStart = view.modelBuilder.radioButton().withProps({
			label: loc.START_MIGRATION,
			name: buttonGroup,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '8px'
			},
			checked: true
		}).component();

		const flex = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'column',
				height: '100%',
				width: '100%',
			}).withProps({
				CSSStyles: {
					'margin': '20px 15px',
				}
			}).component();
		flex.addItem(pageTitle, { flex: '0 0 auto' });
		flex.addItem(radioStart, { flex: '0 0 auto' });
		return flex;
	}
}
