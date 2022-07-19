/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import { MigrationServiceContext } from '../models/migrationLocalStorage';
import * as loc from '../constants/strings';
import * as styles from '../constants/styles';
import { DatabaseMigration } from '../api/azure';
import { TabBase } from './tabBase';
import { MigrationCutoverDialogModel } from '../dialog/migrationCutover/migrationCutoverDialogModel';
import { ConfirmCutoverDialog } from '../dialog/migrationCutover/confirmCutoverDialog';
import { RetryMigrationDialog } from '../dialog/retryMigration/retryMigrationDialog';
import { MigrationTargetType } from '../models/stateMachine';
import { DashboardStatusBar } from './sqlServerDashboard';

export const infoFieldLgWidth: string = '330px';
export const infoFieldWidth: string = '250px';

const statusImageSize: number = 14;

export const MigrationTargetTypeName: loc.LookupTable<string> = {
	[MigrationTargetType.SQLMI]: loc.AZURE_SQL_DATABASE_MANAGED_INSTANCE,
	[MigrationTargetType.SQLVM]: loc.AZURE_SQL_DATABASE_VIRTUAL_MACHINE,
	[MigrationTargetType.SQLDB]: loc.AZURE_SQL_DATABASE,
};

export interface InfoFieldSchema {
	flexContainer: azdata.FlexContainer,
	text: azdata.TextComponent,
	icon?: azdata.ImageComponent,
}

export abstract class MigrationDetailsTabBase<T> extends TabBase<T> {
	protected model!: MigrationCutoverDialogModel;
	protected databaseLabel!: azdata.TextComponent;
	protected serviceContext!: MigrationServiceContext;
	protected onClosedCallback!: () => Promise<void>;

	protected cutoverButton!: azdata.ButtonComponent;
	protected refreshButton!: azdata.ButtonComponent;
	protected cancelButton!: azdata.ButtonComponent;
	protected refreshLoader!: azdata.LoadingComponent;
	protected copyDatabaseMigrationDetails!: azdata.ButtonComponent;
	protected newSupportRequest!: azdata.ButtonComponent;
	protected retryButton!: azdata.ButtonComponent;
	protected summaryTextComponent: azdata.TextComponent[] = [];

	public abstract create(context: vscode.ExtensionContext, view: azdata.ModelView, onClosedCallback: () => Promise<void>, statusBar: DashboardStatusBar): Promise<T>;

	protected abstract migrationInfoGrid(): Promise<azdata.FlexContainer>;

	constructor() {
		super();
		this.title = '';
	}

	public async setMigrationContext(
		serviceContext: MigrationServiceContext,
		migration: DatabaseMigration): Promise<void> {
		this.serviceContext = serviceContext;
		this.model = new MigrationCutoverDialogModel(serviceContext, migration);
		await this.refresh();
	}

	protected createBreadcrumbContainer(): azdata.FlexContainer {
		const migrationsTabLink = this.view.modelBuilder.hyperlink()
			.withProps({
				label: loc.BREADCRUMB_MIGRATIONS,
				url: '',
				title: loc.BREADCRUMB_MIGRATIONS,
				CSSStyles: {
					'padding': '5px 5px 5px 0',
					'font-size': '13px'
				}
			})
			.component();
		this.disposables.push(
			migrationsTabLink.onDidClick(
				async (e) => await this.onClosedCallback()));

		const breadCrumbImage = this.view.modelBuilder.image()
			.withProps({
				iconPath: IconPathHelper.breadCrumb,
				iconHeight: 8,
				iconWidth: 8,
				width: 8,
				height: 8,
				CSSStyles: { 'padding': '4px' }
			}).component();

		this.databaseLabel = this.view.modelBuilder.text()
			.withProps({
				textType: azdata.TextType.Normal,
				value: '...',
				CSSStyles: {
					'font-size': '16px',
					'font-weight': '600',
					'margin-block-start': '0',
					'margin-block-end': '0',
				}
			}).component();

		return this.view.modelBuilder.flexContainer()
			.withItems(
				[migrationsTabLink, breadCrumbImage, this.databaseLabel],
				{ flex: '0 0 auto' })
			.withLayout({
				flexFlow: 'row',
				alignItems: 'center',
				alignContent: 'center',
			})
			.withProps({
				height: 20,
				CSSStyles: { 'padding': '0', 'margin-bottom': '5px' }
			})
			.component();
	}

	protected createMigrationToolbarContainer(): azdata.FlexContainer {
		const toolbarContainer = this.view.modelBuilder.toolbarContainer();
		const buttonHeight = 20;
		this.cutoverButton = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.cutover,
				iconHeight: '16px',
				iconWidth: '16px',
				label: loc.COMPLETE_CUTOVER,
				height: buttonHeight,
				enabled: false,
				CSSStyles: { 'display': 'none' }
			}).component();

		this.disposables.push(
			this.cutoverButton.onDidClick(async (e) => {
				await this.statusBar.clearError();
				await this.refresh();
				const dialog = new ConfirmCutoverDialog(this.model);
				await dialog.initialize();

				if (this.model.CutoverError) {
					await this.statusBar.showError(
						loc.MIGRATION_CUTOVER_ERROR,
						loc.MIGRATION_CUTOVER_ERROR,
						this.model.CutoverError.message);
				}
			}));

		this.cancelButton = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.cancel,
				iconHeight: '16px',
				iconWidth: '16px',
				label: loc.CANCEL_MIGRATION,
				height: buttonHeight,
				enabled: false,
			}).component();

		this.disposables.push(
			this.cancelButton.onDidClick((e) => {
				void vscode.window.showInformationMessage(
					loc.CANCEL_MIGRATION_CONFIRMATION,
					{ modal: true },
					loc.YES,
					loc.NO
				).then(async (v) => {
					if (v === loc.YES) {
						await this.statusBar.clearError();
						await this.model.cancelMigration();
						await this.refresh();
						if (this.model.CancelMigrationError) {
							{
								await this.statusBar.showError(
									loc.MIGRATION_CANCELLATION_ERROR,
									loc.MIGRATION_CANCELLATION_ERROR,
									this.model.CancelMigrationError.message);
							}
						}
					}
				});
			}));


		this.retryButton = this.view.modelBuilder.button()
			.withProps({
				label: loc.RETRY_MIGRATION,
				iconPath: IconPathHelper.retry,
				enabled: false,
				iconHeight: '16px',
				iconWidth: '16px',
				height: buttonHeight,
			}).component();

		this.disposables.push(
			this.retryButton.onDidClick(
				async (e) => {
					await this.refresh();
					const retryMigrationDialog = new RetryMigrationDialog(
						this.context,
						this.serviceContext,
						this.model.migration,
						this.onClosedCallback);
					await retryMigrationDialog.openDialog();
				}
			));

		this.copyDatabaseMigrationDetails = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.copy,
				iconHeight: '16px',
				iconWidth: '16px',
				label: loc.COPY_MIGRATION_DETAILS,
				height: buttonHeight,
			}).component();

		this.disposables.push(
			this.copyDatabaseMigrationDetails.onDidClick(async (e) => {
				await this.refresh();
				await vscode.env.clipboard.writeText(this._getMigrationDetails());

				void vscode.window.showInformationMessage(loc.DETAILS_COPIED);
			}));

		this.newSupportRequest = this.view.modelBuilder.button()
			.withProps({
				label: loc.NEW_SUPPORT_REQUEST,
				iconPath: IconPathHelper.newSupportRequest,
				iconHeight: '16px',
				iconWidth: '16px',
				height: buttonHeight,
			}).component();

		this.disposables.push(
			this.newSupportRequest.onDidClick(async (e) => {
				const serviceId = this.model.migration.properties.migrationService;
				const supportUrl = `https://portal.azure.com/#resource${serviceId}/supportrequest`;
				await vscode.env.openExternal(vscode.Uri.parse(supportUrl));
			}));

		this.refreshButton = this.view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.refresh,
				iconHeight: '16px',
				iconWidth: '16px',
				label: loc.REFRESH_BUTTON_TEXT,
				height: buttonHeight,
			}).component();

		this.disposables.push(
			this.refreshButton.onDidClick(
				async (e) => await this.refresh()));

		this.refreshLoader = this.view.modelBuilder.loadingComponent()
			.withProps({
				loading: false,
				CSSStyles: {
					'height': '8px',
					'margin-top': '4px'
				}
			}).component();

		toolbarContainer.addToolbarItems([
			<azdata.ToolbarComponent>{ component: this.cutoverButton },
			<azdata.ToolbarComponent>{ component: this.cancelButton },
			<azdata.ToolbarComponent>{ component: this.retryButton },
			<azdata.ToolbarComponent>{ component: this.copyDatabaseMigrationDetails, toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.newSupportRequest, toolbarSeparatorAfter: true },
			<azdata.ToolbarComponent>{ component: this.refreshButton },
			<azdata.ToolbarComponent>{ component: this.refreshLoader },
		]);

		return this.view.modelBuilder.flexContainer()
			.withItems([
				this.createBreadcrumbContainer(),
				toolbarContainer.component(),
			])
			.withLayout({ flexFlow: 'column', width: '100%' })
			.component();
	}

	protected async createInfoCard(
		label: string,
		iconPath: azdata.IconPath
	): Promise<azdata.FlexContainer> {
		const defaultValue = (0).toLocaleString();
		const flexContainer = this.view.modelBuilder.flexContainer()
			.withProps({
				width: 168,
				CSSStyles: {
					'flex-direction': 'column',
					'margin': '0 12px 0 0',
					'box-sizing': 'border-box',
					'border': '1px solid rgba(204, 204, 204, 0.5)',
					'box-shadow': '0px 2px 4px rgba(0, 0, 0, 0.1)',
					'border-radius': '2px',
				}
			}).component();

		const labelComponent = this.view.modelBuilder.text()
			.withProps({
				value: label,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': '600',
					'margin': '5px',
				}
			}).component();
		flexContainer.addItem(labelComponent);

		const iconComponent = this.view.modelBuilder.image()
			.withProps({
				iconPath: iconPath,
				iconHeight: 16,
				iconWidth: 16,
				height: 16,
				width: 16,
				CSSStyles: {
					'margin': '5px 5px 5px 5px',
					'padding': '0'
				}
			}).component();

		const textComponent = this.view.modelBuilder.text()
			.withProps({
				value: defaultValue,
				title: defaultValue,
				CSSStyles: {
					'font-size': '20px',
					'font-weight': '600',
					'margin': '0 5px 0 5px'
				}
			}).component();

		this.summaryTextComponent.push(textComponent);

		const iconTextComponent = this.view.modelBuilder.flexContainer()
			.withItems([iconComponent, textComponent])
			.withLayout({ alignItems: 'center' })
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'margin': '0 0 0 5px',
					'padding': '0',
				},
				display: 'inline-flex'
			}).component();

		flexContainer.addItem(iconTextComponent);

		return flexContainer;
	}

	protected async createInfoField(label: string, value: string, defaultHidden: boolean = false, iconPath?: azdata.IconPath): Promise<{
		flexContainer: azdata.FlexContainer,
		text: azdata.TextComponent,
		icon?: azdata.ImageComponent
	}> {
		const flexContainer = this.view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'padding-right': '12px'
				}
			}).component();

		const labelComponent = this.view.modelBuilder.text()
			.withProps({
				value: label,
				CSSStyles: {
					...styles.LIGHT_LABEL_CSS,
					'margin-bottom': '0',
				}
			}).component();
		flexContainer.addItem(labelComponent);

		const textComponent = this.view.modelBuilder.text()
			.withProps({
				value: value,
				title: value,
				description: value,
				width: '100%',
				CSSStyles: {
					'font-size': '13px',
					'line-height': '18px',
					'margin': '4px 0 12px',
					'overflow': 'hidden',
					'text-overflow': 'ellipsis',
					'max-width': '230px',
					'display': 'inline-block',
				}
			}).component();

		let iconComponent;
		if (iconPath) {
			iconComponent = this.view.modelBuilder.image()
				.withProps({
					iconPath: (iconPath === ' ') ? undefined : iconPath,
					iconHeight: statusImageSize,
					iconWidth: statusImageSize,
					height: statusImageSize,
					width: statusImageSize,
					title: value,
					CSSStyles: {
						'margin': '7px 3px 0 0',
						'padding': '0'
					}
				}).component();

			const iconTextComponent = this.view.modelBuilder.flexContainer()
				.withItems([
					iconComponent,
					textComponent
				]).withProps({
					CSSStyles: {
						'margin': '0',
						'padding': '0'
					},
					display: 'inline-flex'
				}).component();
			flexContainer.addItem(iconTextComponent);
		} else {
			flexContainer.addItem(textComponent);
		}

		return {
			flexContainer: flexContainer,
			text: textComponent,
			icon: iconComponent
		};
	}

	protected async showMigrationErrors(migration: DatabaseMigration): Promise<void> {
		const errorMessage = this.getMigrationErrors(migration);
		if (errorMessage?.length > 0) {
			await this.statusBar.showError(
				loc.MIGRATION_ERROR_DETAILS_TITLE,
				loc.MIGRATION_ERROR_DETAILS_LABEL,
				errorMessage);
		}
	}

	protected getMigrationCurrentlyRestoringFile(migration: DatabaseMigration): string | undefined {
		const lastAppliedBackupFile = this.getMigrationLastAppliedBackupFile(migration);
		const currentRestoringFile = migration?.properties?.migrationStatusDetails?.currentRestoringFilename;

		return currentRestoringFile === lastAppliedBackupFile
			&& currentRestoringFile && currentRestoringFile.length > 0
			? loc.ALL_BACKUPS_RESTORED
			: currentRestoringFile;
	}

	protected getMigrationLastAppliedBackupFile(migration: DatabaseMigration): string | undefined {
		return migration?.properties?.migrationStatusDetails?.lastRestoredFilename
			|| migration?.properties?.offlineConfiguration?.lastBackupName;
	}

	private _getMigrationDetails(): string {
		return JSON.stringify(this.model.migration, undefined, 2);
	}
}
