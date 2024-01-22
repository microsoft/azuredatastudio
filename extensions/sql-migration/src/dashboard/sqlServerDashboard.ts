/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { DatabaseMigration, deleteMigration, getMigrationDetails, getMigrationErrors, retryMigration } from '../api/azure';
import { MenuCommands, SqlMigrationExtensionId } from '../api/utils';
import { canCancelMigration, canCutoverMigration, canDeleteMigration, canRestartMigrationWizard, canRetryMigration } from '../constants/helper';
import { IconPathHelper } from '../constants/iconPathHelper';
import { MigrationNotebookInfo, NotebookPathHelper } from '../constants/notebookPathHelper';
import * as loc from '../constants/strings';
import { SavedAssessmentDialog } from '../dialog/assessment/savedAssessmentDialog';
import { ConfirmCutoverDialog } from '../dialog/migrationCutover/confirmCutoverDialog';
import { MigrationCutoverDialogModel } from '../dialog/migrationCutover/migrationCutoverDialogModel';
import { RestartMigrationDialog } from '../dialog/restartMigration/restartMigrationDialog';
import { SqlMigrationServiceDetailsDialog } from '../dialog/sqlMigrationService/sqlMigrationServiceDetailsDialog';
import { MigrationLocalStorage } from '../models/migrationLocalStorage';
import { MigrationStateModel, Page, SavedInfo } from '../models/stateMachine';
import { logError, TelemetryAction, TelemetryViews } from '../telemetry';
import { WizardController } from '../wizard/wizardController';
import { DashboardStatusBar, ErrorEvent } from './DashboardStatusBar';
import { DashboardTab, DashboardTabId } from './dashboardTab';
import { MigrationsTab, MigrationsTabId } from './migrationsTab';
import { AdsMigrationStatus, MigrationDetailsEvent, ServiceContextChangeEvent } from './tabBase';
import { migrationServiceProvider } from '../service/provider';
import { ApiType, SqlMigrationService } from '../service/features';
import { getSourceConnectionId, getSourceConnectionProfile } from '../api/sqlUtils';
import { openRetryMigrationDialog } from '../dialog/retryMigration/retryMigrationDialog';
import { ImportAssessmentDialog } from '../dialog/assessment/importAssessmentDialog';
import { CancelFeedbackDialog } from '../dialog/help/cancelFeedbackDialog';

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
	private _migrationsTab!: MigrationsTab;

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

			const statusBar = new DashboardStatusBar(
				this._context,
				await getSourceConnectionId(),
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
					await this._migrationsTab.setMigrationFilter(AdsMigrationStatus.ALL);
					await this._migrationsTab.refresh();
					await this._migrationsTab.setMigrationFilter(filter);
				} else {
					const promise = this._migrationsTab.setMigrationFilter(filter);
					tabs.selectTab(MigrationsTabId);
					await promise;
				}
			};

			const dashboardTab = await new DashboardTab().create(
				this._context,
				view,
				async (filter: AdsMigrationStatus) => await openMigrationFcn(filter),
				this._onServiceContextChanged,
				statusBar);
			disposables.push(dashboardTab);

			this._migrationsTab = await new MigrationsTab().create(
				this._context,
				view,
				this._onServiceContextChanged,
				this._migrationDetailsEvent,
				statusBar);
			disposables.push(this._migrationsTab);

			const tabs = view.modelBuilder.tabbedPanel()
				.withTabs([dashboardTab, this._migrationsTab])
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
					await this.clearError(await getSourceConnectionId());
					if (tabId === MigrationsTabId) {
						await this._migrationsTab.refresh();
					} else if (tabId === DashboardTabId) {
						await dashboardTab.refresh();
						await this._migrationsTab.refresh();
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
						if (migration) {
							const url = 'https://portal.azure.com/#resource/' + migration.properties.scope;
							await vscode.env.openExternal(vscode.Uri.parse(url));
						}
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
						const serviceContext = await MigrationLocalStorage.getMigrationServiceContext();
						if (migration && serviceContext) {
							const dialog = new SqlMigrationServiceDetailsDialog(
								serviceContext,
								migration);
							await dialog.initialize();
						}
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

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.CancelMigration,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						if (migration && canCancelMigration(migration)) {
							const cancelFeedbackDialog = new CancelFeedbackDialog();
							const cancelReasonsList: string[] = [
								loc.WIZARD_CANCEL_REASON_CONTINUE_WITH_MIGRATION_LATER,
								loc.WIZARD_CANCEL_REASON_MIGRATION_TAKING_LONGER
							];
							cancelFeedbackDialog.updateCancelReasonsList(cancelReasonsList); // Fix: Use the element access expression with an argument
							await cancelFeedbackDialog.openDialog(async (isCancelled: boolean, cancellationReason: string) => {
								if (isCancelled) {
									await this.cancelMigrationAndLogTelemetry(migration, cancellationReason);
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
				MenuCommands.DeleteMigration,
				async (args: MenuCommandArgs) => {
					await this.clearError(args.connectionId);
					try {
						const service = await MigrationLocalStorage.getMigrationServiceContext();
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						// get migration details can return undefined when the migration has been auto-cleaned
						// however, since the migration is still returned in getlist,  we make a best effort to delete by id.
						if (service && (
							(migration && canDeleteMigration(migration)) ||
							(migration === undefined && args.migrationId?.length > 0))) {
							const response = await vscode.window.showInformationMessage(
								loc.DELETE_MIGRATION_CONFIRMATION,
								{ modal: true },
								loc.YES,
								loc.NO);
							if (response === loc.YES) {
								await deleteMigration(
									service.azureAccount!,
									service.subscription!,
									args.migrationId);
								await this._migrationsTab.refresh();
							}
						} else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_DELETE);
							logError(TelemetryViews.MigrationsTab, MenuCommands.DeleteMigration, "cannot delete migration");
						}
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.MIGRATION_DELETE_ERROR,
							loc.MIGRATION_DELETE_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.DeleteMigration, e);
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.RetryMigration,
				async (args: MenuCommandArgs) => {
					await this.clearError(args.connectionId);
					const service = await MigrationLocalStorage.getMigrationServiceContext();
					const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
					if (service && migration && canRetryMigration(migration)) {
						const errorMessage = getMigrationErrors(migration);
						openRetryMigrationDialog(
							errorMessage,
							async () => {
								try {
									await retryMigration(
										service.azureAccount!,
										service.subscription!,
										migration);
									await this._migrationsTab.refresh();
								} catch (e) {
									await this.showError(
										args.connectionId,
										loc.MIGRATION_RETRY_ERROR,
										loc.MIGRATION_RETRY_ERROR,
										e.message);
									logError(TelemetryViews.MigrationsTab, MenuCommands.RetryMigration, e);
								}
							});
					}
					else {
						await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_RETRY);
						logError(TelemetryViews.MigrationsTab, MenuCommands.RetryMigration, "cannot retry migration");
					}
				}));

		this._context.subscriptions.push(
			vscode.commands.registerCommand(
				MenuCommands.RestartMigration,
				async (args: MenuCommandArgs) => {
					try {
						await this.clearError(args.connectionId);
						const migration = await this._getMigrationById(args.migrationId, args.migrationOperationId);
						if (migration && canRestartMigrationWizard(migration)) {
							const restartMigrationDialog = new RestartMigrationDialog(
								this._context,
								await MigrationLocalStorage.getMigrationServiceContext(),
								migration,
								this._onServiceContextChanged);
							await restartMigrationDialog.openDialog();
						}
						else {
							await vscode.window.showInformationMessage(loc.MIGRATION_CANNOT_RESTART);
						}
					} catch (e) {
						await this.showError(
							args.connectionId,
							loc.MIGRATION_RESTART_ERROR,
							loc.MIGRATION_RESTART_ERROR,
							e.message);
						logError(TelemetryViews.MigrationsTab, MenuCommands.RestartMigration, e);
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

	private async cancelMigrationAndLogTelemetry(migration: DatabaseMigration, cancellationReason: string): Promise<void> {
		const cutoverDialogModel = new MigrationCutoverDialogModel(
			await MigrationLocalStorage.getMigrationServiceContext(),
			migration!);
		await cutoverDialogModel.fetchStatus();
		await cutoverDialogModel.cancelMigration(cancellationReason);

		if (cutoverDialogModel.CancelMigrationError) {
			void vscode.window.showErrorMessage(loc.MIGRATION_CANNOT_CANCEL);
			logError(TelemetryViews.MigrationsTab, MenuCommands.CancelMigration, cutoverDialogModel.CancelMigrationError);
		}
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
			try {
				const migration = getMigrationDetails(
					context.azureAccount,
					context.subscription,
					migrationId,
					migrationOperationId);
				return migration;
			} catch (error) {
				logError(TelemetryViews.MigrationsTab, "_getMigrationById", error);
			}
		}
		return undefined;
	}

	public async launchMigrationWizard(): Promise<void> {
		const activeConnection = await getSourceConnectionProfile();
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				serverName = connection.options.server;
			}
		} else {
			serverName = activeConnection.serverName;
		}
		if (serverName) {
			const migrationService = <SqlMigrationService>await migrationServiceProvider.getService(ApiType.SqlMigrationProvider);

			if (migrationService) {
				this.stateModel = new MigrationStateModel(this._context, migrationService);
				this._context.subscriptions.push(this.stateModel);

				const wizardController = new WizardController(
					this._context,
					this.stateModel,
					this._onServiceContextChanged);

				const savedInfo = this.checkSavedInfo(serverName);
				if (savedInfo) {
					this.stateModel.savedInfo = savedInfo;
					this.stateModel.serverName = serverName;

					const importSavedInfo = this.checkSavedInfo(loc.importAssessmentKey);
					if (importSavedInfo && importSavedInfo.closedPage === Page.ImportAssessment) {
						try {
							await this.clearSavedInfo(loc.importAssessmentKey);
							if (importSavedInfo.serverAssessment !== null) {
								this.stateModel._assessmentResults = importSavedInfo.serverAssessment;
								this.stateModel.savedInfo = importSavedInfo;
								await this.stateModel.loadSavedInfo();

								serverName = importSavedInfo.serverAssessment?.issues[0]?.serverName ??
									importSavedInfo.serverAssessment?.databaseAssessments[0]?.issues[0]?.serverName;
								this.stateModel.serverName = serverName;
							}

							const importAssessmentDialog = new ImportAssessmentDialog('ownerUri', this.stateModel, serverName);
							await importAssessmentDialog.openDialog();
						} catch (err) {
							logError(TelemetryViews.MigrationsTab, TelemetryAction.ImportAssessmentFailed, err);
						}
					} else {
						const savedAssessmentDialog = new SavedAssessmentDialog(
							this._context,
							this.stateModel,
							this._onServiceContextChanged);
						await savedAssessmentDialog.openDialog();
					}
				} else {
					await wizardController.openWizard();
				}
			}
		}
	}

	public async launchLoginMigrationWizard(): Promise<void> {
		const activeConnection = await getSourceConnectionProfile();
		let serverName: string = '';
		if (!activeConnection) {
			const connection = await azdata.connection.openConnectionDialog();
			if (connection) {
				serverName = connection.options.server;
			}
		} else {
			serverName = activeConnection.serverName;
		}
		if (serverName) {
			const migrationService = <SqlMigrationService>await migrationServiceProvider.getService(ApiType.SqlMigrationProvider);
			if (migrationService) {
				this.stateModel = new MigrationStateModel(this._context, migrationService);
				this._context.subscriptions.push(this.stateModel);
				const wizardController = new WizardController(
					this._context,
					this.stateModel,
					this._onServiceContextChanged);
				await wizardController.openLoginWizard();
			}
		}
	}

	private checkSavedInfo(serverName: string): SavedInfo | undefined {
		return this._context.globalState.get<SavedInfo>(`${this.stateModel.mementoString}.${serverName}`);
	}

	private async clearSavedInfo(serverName: string) {
		await this._context.globalState.update(`${this.stateModel.mementoString}.${serverName}`, {});
	}

	public async launchNewSupportRequest(): Promise<void> {
		await vscode.env.openExternal(vscode.Uri.parse(
			`https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade/newsupportrequest`));
	}
}
