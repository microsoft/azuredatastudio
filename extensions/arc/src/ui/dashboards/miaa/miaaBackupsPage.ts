/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { MiaaModel } from '../../../models/miaaModel';
import { ControllerModel } from '../../../models/controllerModel';
import { ConfigureRPOSqlDialog } from '../../dialogs/configureRPOSqlDialog';

export class MiaaBackupsPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;
		//this._instanceProperties.miaaAdmin = this._miaaModel.username || this._instanceProperties.miaaAdmin;
		this.saveArgs.recoveryPointObjective = this._miaaModel.rpSettings.rpo ? this.saveArgs.recoveryPointObjective : '';
		this.saveArgs.retentionDays = this._miaaModel.rpSettings.rd ? this.saveArgs.retentionDays : '';
		this.disposables.push(
			this._miaaModel.onDatabasesUpdated(() => this.eventuallyRunOnInitialized(() => this.handleDatabasesUpdated())),
			this._miaaModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleDatabasesUpdated()))
		);
	}

	private _databasesContainer!: azdata.DivContainer;
	private _configureRetentionPolicyButton!: azdata.ButtonComponent;
	private _connectToServerLoading!: azdata.LoadingComponent;
	private _connectToServerButton!: azdata.ButtonComponent;
	private _databasesTableLoading!: azdata.LoadingComponent;
	private _databasesTable!: azdata.DeclarativeTableComponent;
	private _databasesMessage!: azdata.TextComponent;
	private readonly _azApi: azExt.IExtension;

	private saveArgs: {
		recoveryPointObjective?: string,
		retentionDays?: string
	} = {};

	public get title(): string {
		return loc.backup;
	}

	public get id(): string {
		return 'backups';
	}

	public get icon(): { dark: string, light: string } {
		return IconPathHelper.properties;
	}
	protected async refresh(): Promise<void> {
		await Promise.all([this._controllerModel.refresh(false, this._controllerModel.info.namespace), this._miaaModel.refresh()]);
	}

	public get container(): azdata.Component {
		const root = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin': '18px' } })
			.component();
		const content = this.modelView.modelBuilder.divContainer().component();
		this._databasesContainer = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '20px' } });

		const infoBackupDatabases = this.modelView.modelBuilder.text().withProps({
			value: loc.miaaBackupsDatabasesDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();
		const backupInfoDescrition = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				infoBackupDatabases
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		const backupsDbsLearnMoreLink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnMore,
			url: '',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const backupDatabaseInfoAndLink = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				backupInfoDescrition,
				backupsDbsLearnMoreLink
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		content.addItem(backupDatabaseInfoAndLink, { CSSStyles: { 'min-height': '30px' } });
		// content.addItem(this.modelView.modelBuilder.text().withProps({
		// 	value: loc.backup,
		// 	CSSStyles: { ...cssStyles.title }
		// }).component());

		// Create loaded components
		const connectToServerText = this.modelView.modelBuilder.text().withProps({
			value: loc.miaaConnectionRequired
		}).component();

		this._connectToServerButton = this.modelView.modelBuilder.button().withProps({
			label: loc.connectToServer,
			enabled: false,
			CSSStyles: { 'max-width': '125px', 'margin-left': '40%' }
		}).component();

		const connectToServerContainer = this.modelView.modelBuilder.divContainer().component();


		connectToServerContainer.addItem(connectToServerText, { CSSStyles: { 'text-align': 'center', 'margin-top': '20px' } });
		connectToServerContainer.addItem(this._connectToServerButton);

		this._connectToServerLoading = this.modelView.modelBuilder.loadingComponent().withItem(connectToServerContainer).component();

		// this._connectToServerLoading = this.modelView.modelBuilder.loadingComponent().withItem(connectToServerContainer).component();
		this._databasesContainer.addItem(this._connectToServerLoading, { CSSStyles: { 'margin-top': '20px' } });

		this._databasesTableLoading = this.modelView.modelBuilder.loadingComponent().component();
		this._databasesTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			columns: [
				{
					displayName: loc.database,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.pitrRestorePoint,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '50%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.restore,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '20%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				}
			],
			dataValues: []
		}).component();

		this._databasesMessage = this.modelView.modelBuilder.text()
			.withProps({ CSSStyles: { 'text-align': 'center' } })
			.component();

		this.handleDatabasesUpdated();
		this._databasesTableLoading.component = this._databasesTable;

		//const titleCSS = { ...cssStyles.title, 'margin-block-start': '2em', 'margin-block-end': '0' };
		//root.addItem(this.modelView.modelBuilder.text().withProps({ value: loc.databases, CSSStyles: titleCSS }).component());
		this.disposables.push(
			this._connectToServerButton!.onDidClick(async () => {
				this._connectToServerButton!.enabled = false;
				this._databasesTableLoading!.loading = true;
				try {
					await this._miaaModel.callGetDatabases();
				} catch {
					this._connectToServerButton!.enabled = true;
				}
			})
		);
		root.addItem(this._databasesContainer);
		root.addItem(this._databasesMessage);

		this.initialized = true;
		return root;
	}

	public get toolbarContainer(): azdata.ToolbarContainer {
		// Refresh
		const refreshButton = this.modelView.modelBuilder.button().withProps({
			label: loc.refresh,
			iconPath: IconPathHelper.refresh
		}).component();
		this.disposables.push(
			refreshButton.onDidClick(async () => {
				refreshButton.enabled = false;
				try {
					await this.refresh();
				} finally {
					refreshButton.enabled = true;
				}
			}));
		this._configureRetentionPolicyButton = this.modelView.modelBuilder.button().withProps({
			label: loc.configureRetentionPolicyButton,
			enabled: true,
			iconPath: IconPathHelper.edit,
		}).component();
		this.disposables.push(
			this._configureRetentionPolicyButton.onDidClick(async () => {
				const rpoSqlDialog = new ConfigureRPOSqlDialog(this._miaaModel);

				rpoSqlDialog.showDialog(loc.configureRPO, this.saveArgs.recoveryPointObjective, this.saveArgs.retentionDays);

				let rpArg = await rpoSqlDialog.waitForClose();
				if (rpArg) {
					try {
						this._configureRetentionPolicyButton.enabled = false;
						this.saveArgs.recoveryPointObjective = rpArg?.rpo;
						this.saveArgs.retentionDays = rpArg?.rd;
						//let extensionList = this.extensionNames.length ? this.extensionNames.join() + ',' + extArg : extArg;
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.updatingInstance(this._miaaModel.info.name),
								cancellable: false
							},
							async (_progress, _token): Promise<void> => {
								await this._azApi.az.sql.miarc.edit(
									this._miaaModel.info.name, this.saveArgs, this._miaaModel.controllerModel.info.namespace, this._miaaModel.controllerModel.azAdditionalEnvVars);

								try {
									await this._miaaModel.refresh();
								} catch (error) {
									vscode.window.showErrorMessage(loc.refreshFailed(error));
								}
							}
						);

					} catch (error) {
						vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
					} finally {
						this._configureRetentionPolicyButton.enabled = true;
					}
				}
			}));

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: this._configureRetentionPolicyButton, toolbarSeparatorAfter: false },

			]
		).component();
	}

	private handleDatabasesUpdated(): void {
		// If we were able to get the databases it means we have a good connection so update the username too
		let databaseDisplayText = this._miaaModel.databases.map(d => [d.name, d.lastBackup,]);
		let databasesTextValues = databaseDisplayText.map(d => {
			return d.map((value): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});
		this._databasesTable.setDataValues(databasesTextValues);
		this._databasesTableLoading.loading = false;

		if (this._miaaModel.databasesLastUpdated) {
			// We successfully connected so now can remove the button and replace it with the actual databases table
			this._databasesContainer.removeItem(this._connectToServerLoading);
			this._databasesContainer.addItem(this._databasesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });
		} else {
			// If we don't have an endpoint then there's no point in showing the connect button - but the logic
			// to display text informing the user of this is already handled by the handleMiaaConfigUpdated
			if (this._miaaModel?.config?.status.primaryEndpoint) {
				this._connectToServerLoading.loading = false;
				this._connectToServerButton.enabled = true;
			}
		}
	}
}
