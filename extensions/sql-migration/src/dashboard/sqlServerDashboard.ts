/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import { promises as fs } from 'fs';
import { DatabaseMigration, getMigrationDetails } from '../api/azure';
import { MenuCommands, SqlMigrationExtensionId } from '../api/utils';
import { canCancelMigration, canCutoverMigration, canRetryMigration } from '../constants/helper';
import { IconPathHelper } from '../constants/iconPathHelper';
import { MigrationNotebookInfo, NotebookPathHelper } from '../constants/notebookPathHelper';
import * as loc from '../constants/strings';
import { SavedAssessmentDialog } from '../dialog/assessmentResults/savedAssessmentDialog';
import { ConfirmCutoverDialog } from '../dialog/migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../dialog/migrationCutover/migrationCutoverDialogModel';
import { RetryMigrationDialog } from '../dialog/retryMigration/retryMigrationDialog';
import { SqlMigrationServiceDetailsDialog } from '../dialog/sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { MigrationLocalStorage } from '../models/migrationLocalStorage';
import { MigrationStateModel, SavedInfo } from '../models/stateMachine';
import { logError, TelemetryViews } from '../telemtery';
import { WizardController } from '../wizard/wizardController';
import { DashboardStatusBar, ErrorEvent } from './DashboardStatusBar';
import { DashboardTab } from './dashboardTab';
import { MigrationsTab, MigrationsTabId } from './migrationsTab';
import { AdsMigrationStatus, MigrationDetailsEvent, ServiceContextChangeEvent } from './tabBase';

export interface MenuCommandArgs {
	connectionId: string,
	migrationId: string,
	migrationOperationId: string,
}

export class DashboardWidget {
	public stateModel!: MigrationStateModel;
	private readonly _context: vscode.ExtensionContext;
	private readonly _onServiceContextChanged: vscode.EventEmitter<ServiceContextChangeEvent>;
	private readonly _migrationDetailsEvent: vscode.EventEmitter<MigrationDetailsEvent>;
	private readonly _errorEvent: vscode.EventEmitter<ErrorEvent>;

	constructor(context: vscode.ExtensionContext) {
		this._context = context;
		NotebookPathHelper.setExtensionContext(context);
		IconPathHelper.setExtensionContext(context);
		MigrationLocalStorage.setExtensionContext(context);

		this._onServiceContextChanged = new vscode.EventEmitter<ServiceContextChangeEvent>();
		this._errorEvent = new vscode.EventEmitter<ErrorEvent>();
		this._migrationDetailsEvent = new vscode.EventEmitter<MigrationDetailsEvent>();

		context.subscriptions.push(this._onServiceContextChanged);
		context.subscriptions.push(this._errorEvent);
		context.subscriptions.push(this._migrationDetailsEvent);
	}

	public async register(): Promise<void> {
		await this._registerCommands();

		azdata.ui.registerModelViewProvider('migration-dashboard', async (view) => {
			const disposables: vscode.Disposable[] = [];
			const _view = view;

			const statusInfoBox = view.modelBuilder.infoBox()
				.withProps({
					style: 'error',
					text: '',
					clickableButtonAriaLabel: loc.ERROR_DIALOG_ARIA_CLICK_VIEW_ERROR_DETAILS,
					announceText: true,
					isClickable: true,
					display: 'none',
					CSSStyles: { 'font-size': '14px', 'display': 'none', },
				}).component();

			const connectionProfile = await azdata.connection.getCurrentConnection();
			const statusBar = new DashboardStatusBar(
				this._context,
				connectionProfile.connectionId,
				statusInfoBox,
				this._errorEvent);

			disposables.push(
				statusInfoBox.onDidClick(
					async e => await statusBar.openErrorDialog()));

			disposables.push(
				_view.onClosed(e =>
					disposables.forEach(
						d => { try { d.dispose(); } catch { } })));

			const openMigrationFcn = async (filter: AdsMigrationStatus): Promise<void> => {
				if (!migrationsTabInitialized) {
					migrationsTabInitialized = true;
					tabs.selectTab(MigrationsTabId);
					await migrationsTab.setMigrationFilter(AdsMigrationStatus.ALL);
					await migrationsTab.refresh();
					await migrationsTab.setMigrationFilter(filter);
				} else {
					const promise = migrationsTab.setMigrationFilter(filter);
					tabs.selectTab(MigrationsTabId);
					await promise;
				}
			};

			const dashboardTab = await new DashboardTab().create(
				view,
				async (filter: AdsMigrationStatus) => await openMigrationFcn(filter),
				this._onServiceContextChanged,
				statusBar);
			disposables.push(dashboardTab);

			const migrationsTab = await new MigrationsTab().create(
				this._context,
				view,
				this._onServiceContextChanged,
				this._migrationDetailsEvent,
				statusBar);
			disposables.push(migrationsTab);

			const tabs = view.modelBuilder.tabbedPanel()
				.withTabs([dashboardTab, migrationsTab])
				.withLayout({ alwaysShowTabs: true, orientation: azdata.TabOrientation.Horizontal })
				.withProps({
					CSSStyles: {
						'margin': '0px',
						'padding': '0px',
						'width': '100%'
					}
				})
				.component();

			let migrationsTabInitialized = false;
			disposables.push(
				tabs.onTabChanged(async tabId => {
					const connectionProfile = await azdata.connection.getCurrentConnection();
					await this.clearError(connectionProfile.connectionId);
					if (tabId === MigrationsTabId && !migrationsTabInitialized) {
						migrationsTabInitialized = true;
						await migrationsTab.refresh();
					}
				}));

			const flexContainer = view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column' })
				.withItems([statusInfoBox, tabs])
				.component();
			await view.initializeModel(flexContainer);
			await dashboardTab.refresh();
		});
	}

	private async _registerCommands(): Promise<void> {
		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.Cutover,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						if (canCutoverMigration(migration)) {
							const cutoverDialogModel = new MigrationCutoverDialogModel(
								await MigrationLocalStorage.getMigrationServiceContext(),
								migration!);
							await cutoverDialogModel.fetchStatus();
							const dialog = new ConfirmCutoverDialog(cutoverDialogModel);
							await dialog.initialize();
							if (cutoverDialogModel.CutoverError) {
								void vscode.window.showErrorMessage(loc.MIGRATION_CUTOVER_ERROR);
								logError(TelemetryViews.MigrationsTab, MenuCommands.Cutover, cutoverDialogModel.CutoverError);
							}
						} else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CUTOVER);
						}
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.MIGRATION_CUTOVER_ERROR,
							loc.MIGRATION_CUTOVER_ERROR,
							e.message);

						logError(TelemetryViews.MigrationsTab, MenuCommands.Cutover, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.ViewDatabase,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						this._migrationDetailsEvent.fire({
							connectionId: args.connectionId,
							migrationId: args.migrationId,
							migrationOperationId: args.migrationOperationId,
						});
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.OPEN_MIGRATION_DETAILS_ERROR,
							loc.OPEN_MIGRATION_DETAILS_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.ViewDatabase, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.ViewTarget,
				async (args: MenuCommandArgs) => {
					try {
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						const url = 'https://portal.azure.com/#resource/' + migration!.properties.scope;
						await vscode.env.openExternal(vscode.Uri.parse(url));
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.OPEN_MIGRATION_TARGET_ERROR,
							loc.OPEN_MIGRATION_TARGET_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.ViewTarget, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.ViewService,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						const dialog = new SqlMigrationServiceDetailsDialog(
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration!);
						await dialog.initialize();
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.OPEN_MIGRATION_SERVICE_ERROR,
							loc.OPEN_MIGRATION_SERVICE_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.ViewService, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.CopyMigration,
				async (args: MenuCommandArgs) => {
					await this.clearError(args.connectionId);
					const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
					if (migration) {
						const cutoverDialogModel = new MigrationCutoverDialogModel(
							await MigrationLocalStorage.getMigrationServiceContext(),
							migration);
						try {
							await cutoverDialogModel.fetchStatus();
						} catch (e) {
							await this.showError(
								args.connectionId,
								loc.MIGRATION_STATUS_REFRESH_ERROR,
								loc.MIGRATION_STATUS_REFRESH_ERROR,
								e.message);
							logError(TelemetryViews.MigrationsTab, MenuCommands.CopyMigration, e);
						}

						await vscode.env.clipboard.writeText(JSON.stringify(cutoverDialogModel.migration, undefined, 2));
						await vscode.window.showInformationMessage(loc.DETAILS_COPIED);
					}
				}));

		this._context.subscriptions.push(vscode.commands.registerCommand(
			MenuCommands.CancelMigration,
			async (args: MenuCommandArgs) => {
				try {
					await this.clearError(args.connectionId);
					const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
					if (canCancelMigration(migration)) {
						void vscode.window.showInformationMessage(loc.CANCEL_MIGRATION_CONFIRMATION, loc.YES, loc.NO)
							.then(async (v) => {
								if (v === loc.YES) {
									const cutoverDialogModel = new MigrationCutoverDialogModel(
										await MigrationLocalStorage.getMigrationServiceContext(),
										migration!);
									await cutoverDialogModel.fetchStatus();
									await cutoverDialogModel.cancelMigration();

									if (cutoverDialogModel.CancelMigrationError) {
										void vscode.window.showErrorMessage(loc.MIGRATION_CANNOT_CANCEL);
										logError(TelemetryViews.MigrationsTab, MenuCommands.CancelMigration, cutoverDialogModel.CancelMigrationError);
									}
								}
							});
					} else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_CANCEL);
					}
				} catch (e) {
					await this.showError(
						args.connectionId,
						loc.MIGRATION_CANCELLATION_ERROR,
						loc.MIGRATION_CANCELLATION_ERROR,
						e.message);
					logError(TelemetryViews.MigrationsTab, MenuCommands.CancelMigration, e);
				}
			}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.RetryMigration,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						if (canRetryMigration(migration)) {
							const retryMigrationDialog = new RetryMigrationDialog(
								this._context,
								await MigrationLocalStorage.getMigrationServiceContext(),
								migration!,
								this._onServiceContextChanged);
							await retryMigrationDialog.openDialog();
						}
						else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_RETRY);
						}
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.MIGRATION_RETRY_ERROR,
							loc.MIGRATION_RETRY_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.RetryMigration, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.StartMigration,
				async () => await this.launchMigrationWizard()));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.StartLoginMigration,
				async () => await this.launchLoginMigrationWizard()));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.OpenNotebooks,
				async () => {
					const input = vscode.window.createQuickPick<MigrationNotebookInfo>();
					input.placeholder = loc.NOTEBOOK_QUICK_PICK_PLACEHOLDER;
					input.items = NotebookPathHelper.getAllMigrationNotebooks();

					this._context.subscriptions.push(
						input.onDidAccept(async (e) => {
							const selectedNotebook = input.selectedItems[0];
							if (selectedNotebook) {
								try {
									await azdata.nb.showNotebookDocument(vscode.Uri.parse(`untitled: ${selectedNotebook.label}`), {
										preview: false,
										initialContent: (await fs.readFile(selectedNotebook.notebookPath)).toString(),
										initialDirtyState: false
									});
								} catch (e) {
									void vscode.window.showErrorMessage(`${loc.NOTEBOOK_OPEN_ERROR} - ${e.toString()}`);
								}
								input.hide();
							}
						}));

					input.show();
				}));

		this._context.subscriptions.push(azdata.tasks.registerTask(
			MenuCommands.StartMigration,
			async () => await this.launchMigrationWizard()));

		this._context.subscriptions.push(azdata.tasks.registerTask(
			MenuCommands.StartLoginMigration,
			async () => await this.launchLoginMigrationWizard()));


		this._context.subscriptions.push(
			azdata.tasks.registerTask(
				MenuCommands.NewSupportRequest,
				async () => await this.launchNewSupportRequest()));

		this._context.subscriptions.push(
			azdata.tasks.registerTask(
				MenuCommands.SendFeedback,
				async () => {
					const actionId = MenuCommands.IssueReporter;
					const args = {
						extensionId: SqlMigrationExtensionId,
						issueTitle: loc.FEEDBACK_ISSUE_TITLE,
					};
					return await vscode.commands.executeCommand(actionId, args);
				}));
	}

	private async clearError(connectionId: string): Promise<void> {
		this._errorEvent.fire({
			connectionId: connectionId,
			title: '',
			label: '',
			message: '',
		});
	}

	private async showError(connectionId: string, title: string, label: string, message: string): Promise<void> {
		this._errorEvent.fire({
			connectionId: connectionId,
			title: title,
			label: label,
			message: message,
		});
	}

	private async _getMigrationById(migrationId: string, migrationOperationId: string): Promise<DatabaseMigration | undefined> {
		const context = await MigrationLocalStorage.getMigrationServiceContext();
		if (context.azureAccount && context.subscription) {
			return getMigrationDetails(
				context.azureAccount,
				context.subscription,
				migrationId,
				migrationOperationId);
		}
		return undefined;
	}

	public async launchMigrationWizard(): Promise<void> {
		const activeConnection = await azdata.connection.getCurrentConnection();
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
		if (serverName) {
			const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
			if (api) {
				this.stateModel = new MigrationStateModel(this._context, connectionId, api.sqlMigration);
				this._context.subscriptions.push(this.stateModel);
				const savedInfo = this.checkSavedInfo(serverName);
				if (savedInfo) {
					this.stateModel.savedInfo = savedInfo;
					this.stateModel.serverName = serverName;
					const savedAssessmentDialog = new SavedAssessmentDialog(
						this._context,
						this.stateModel,
						this._onServiceContextChanged);
					await savedAssessmentDialog.openDialog();
				} else {
					const wizardController = new WizardController(
						this._context,
						this.stateModel,
						this._onServiceContextChanged);
					await wizardController.openWizard(connectionId);
				}
			}
		}
	}

	public async launchLoginMigrationWizard(): Promise<void> {
		const activeConnection = await azdata.connection.getCurrentConnection();
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
		if (serverName) {
			const api = (await vscode.extensions.getExtension(mssql.extension.name)?.activate()) as mssql.IExtension;
			if (api) {
				this.stateModel = new MigrationStateModel(this._context, connectionId, api.sqlMigration);
				this._context.subscriptions.push(this.stateModel);
				const wizardController = new WizardController(
					this._context,
					this.stateModel,
					this._onServiceContextChanged);
				await wizardController.openLoginWizard(connectionId);
			}
		}
	}

	private checkSavedInfo(serverName: string): SavedInfo | undefined {
		return this._context.globalState.get<SavedInfo>(`${this.stateModel.mementoString}.${serverName}`);
	}

	public async launchNewSupportRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			`https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest`));
	}
}
