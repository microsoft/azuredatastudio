/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ConnectionMode } from '../../../constants';
// import { IconPathHelper, cssStyles, ConnectionMode } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
// import { RPModel, DatabaseModel, systemDbs } from '../../../models/miaaModel';
import { ControllerModel } from '../../../models/controllerModel';
// import { ConfigureRPOSqlDialog } from '../../dialogs/configureRPOSqlDialog';
import { UpgradeController } from '../../dialogs/upgradeController';

export class ControllerUpgradesPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}
	private _upgradesContainer!: azdata.DivContainer;
	private _configureRetentionPolicyButton!: azdata.ButtonComponent;
	private _upgradesTableLoading!: azdata.LoadingComponent;
	private _upgradesTable!: azdata.DeclarativeTableComponent;
	private _upgradesMessage!: azdata.TextComponent;
	private readonly _azApi: azExt.IExtension;

	public get title(): string {
		return loc.upgradeManagement;
	}

	public get id(): string {
		return 'upgrades';
	}

	public get icon(): { dark: string, light: string } {
		return IconPathHelper.pitr;
	}
	protected async refresh(): Promise<void> {
		await Promise.all([this._controllerModel.refresh(false, this._controllerModel.info.namespace)]);
	}

	public get container(): azdata.Component {
		const root = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withProps({ CSSStyles: { 'margin': '18px' } })
			.component();
		const content = this.modelView.modelBuilder.divContainer().component();
		this._upgradesContainer = this.modelView.modelBuilder.divContainer().component();
		root.addItem(content, { CSSStyles: { 'margin': '5px' } });

		// Upgrades title and description
		const availableUpgradesTitle = this.modelView.modelBuilder.text().withProps({
			value: loc.availableUpgrades,
			CSSStyles: { ...cssStyles.title },
		}).component();
		content.addItem(availableUpgradesTitle);

		const infoAvailableUpgrades = this.modelView.modelBuilder.text().withProps({
			value: loc.availableUpgradesDescription,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();

		const upgradesInfoDescription = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				infoAvailableUpgrades
			]).component();

		const upgradesVersionLogLink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.versionLog,
			url: 'https://docs.microsoft.com/en-us/azure/azure-arc/data/version-log',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const upgradesInfoAndLink = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				upgradesInfoDescription,
				upgradesVersionLogLink
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		content.addItem(upgradesInfoAndLink, { CSSStyles: { 'min-height': '30px' } });

		const infoOnlyNextImmediateVersion = this.modelView.modelBuilder.text().withProps({
			value: loc.onlyNextImmediateVersion,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();

		content.addItem(infoOnlyNextImmediateVersion, { CSSStyles: { 'min-height': '30px' } });

		// Create loaded components
		this._upgradesTableLoading = this.modelView.modelBuilder.loadingComponent().component();
		this._upgradesTable = this.modelView.modelBuilder.declarativeTable().withProps({
			width: '100%',
			columns: [
				{
					displayName: loc.version,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.releaseDate,
					valueType: azdata.DeclarativeDataType.string,
					isReadOnly: true,
					width: '30%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow
				},
				{
					displayName: loc.upgrade,
					valueType: azdata.DeclarativeDataType.component,
					isReadOnly: true,
					width: '10%',
					headerCssStyles: cssStyles.tableHeader,
					rowCssStyles: cssStyles.tableRow,
				}
			],
			dataValues: []
		}).component();

		this._upgradesMessage = this.modelView.modelBuilder.text()
			.withProps({ CSSStyles: { 'text-align': 'center' } })
			.component();

		this.handleDatabasesUpdated();
		this._upgradesTableLoading.component = this._upgradesTable;

		root.addItem(this._upgradesContainer);
		root.addItem(this._upgradesMessage);

		this.initialized = true;

		this._upgradesTableLoading.loading = false;
		this._upgradesContainer.addItem(this._upgradesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });

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

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: refreshButton, toolbarSeparatorAfter: true },
				{ component: this._configureRetentionPolicyButton, toolbarSeparatorAfter: false },

			]
		).component();
	}

	private formatTableData(result: azExt.AzOutput<azExt.DcListUpgradesResult>): (string | azdata.ButtonComponent)[][] {
		let formattedValues: (string | azdata.ButtonComponent)[][] = [];
		const versions = result.stdout.versions;
		const dates = result.stdout.dates;
		const currentVersion = result.stdout.currentVersion;
		const nextVersion = this.getNextUpgrade(result.stdout.versions, result.stdout.currentVersion);
		for (let i = 0; i < versions.length; i++) {
			if (versions[i] === currentVersion) {
				formattedValues.push([versions[i], dates[i], this.createUpgradeButton('Current version', false, '')]);
			} else if (versions[i] === nextVersion) {
				formattedValues.push([versions[i], dates[i], this.createUpgradeButton('Upgrade', true, nextVersion)]);
			}
		}
		return formattedValues;
	}

	private async handleDatabasesUpdated(): Promise<void> {
		const result = await this._azApi.az.arcdata.dc.listUpgrades(this._controllerModel.info.namespace);
		let databaseDisplay = this.formatTableData(result);
		let databasesValues = databaseDisplay.map(d => {
			return d.map((value: any): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});

		this._upgradesTable.setDataValues(databasesValues);

		this._upgradesTableLoading.loading = false;

		this._upgradesContainer.addItem(this._upgradesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });
	}

	// Given the list of available versions and the current version, if the current version is not the latest,
	// then return the next version available. (Can only upgrade to next version due to limitations by Azure CLI arcdata extension.)
	// If current version is the latest, then return undefined.
	private getNextUpgrade(versions: string[], currentVersion: string): string | undefined {
		let index = versions.indexOf(currentVersion);
		// The version at index 0 will be the latest
		if (index > 0) {
			return versions[index - 1];
		} else {
			return undefined;
		}
	}

	//Create restore button for every database entry in the database table
	private createUpgradeButton(label: string, enabled: boolean, nextVersion: string): azdata.ButtonComponent | string {
		let upgradeButton = this.modelView.modelBuilder.button().withProps({
			label: label,
			enabled: enabled
		}).component();

		this.disposables.push(
			upgradeButton.onDidClick(async () => {
				const upgradeDialog = new UpgradeController(this._controllerModel);
				upgradeDialog.showDialog(loc.upgradeDataController);
				let dialogClosed = await upgradeDialog.waitForClose();
				if (dialogClosed) {
					try {
						upgradeButton.enabled = false;
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.updatingInstance(this._controllerModel.info.name),
								cancellable: false
							},
							async (_progress, _token): Promise<void> => {
								if (nextVersion !== '') {
									if (this._controllerModel.info.connectionMode === ConnectionMode.direct) {
										await this._azApi.az.arcdata.dc.upgrade(
											nextVersion,
											this._controllerModel.info.name,
											this._controllerModel.info.resourceGroup,
											undefined, // Indirect mode argument - namespace
											undefined // Indirect mode argument - usek8s
										);
									} else {
										await this._azApi.az.arcdata.dc.upgrade(
											nextVersion,
											this._controllerModel.info.name,
											undefined, // Direct mode argument - resourceGroup
											this._controllerModel.info.namespace,
											true
										);
									}
								} else {
									vscode.window.showInformationMessage(loc.noUpgrades);
								}

								try {
									await this._controllerModel.refresh(false, this._controllerModel.info.namespace);
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

		return upgradeButton;
	}
}

