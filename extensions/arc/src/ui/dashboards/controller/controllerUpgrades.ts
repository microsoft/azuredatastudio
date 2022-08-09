/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azExt from 'az-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper, cssStyles, ConnectionMode } from '../../../constants';
import { DashboardPage } from '../../components/dashboardPage';
import { ControllerModel } from '../../../models/controllerModel';
import { UpgradeController } from '../../dialogs/upgradeController';

export class ControllerUpgradesPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel) {
		super(modelView, dashboard);
		this._azApi = vscode.extensions.getExtension(azExt.extension.name)?.exports;
	}
	private _upgradesContainer!: azdata.DivContainer;
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
		return IconPathHelper.upgrade;
	}
	protected async refresh(): Promise<void> {
		await Promise.resolve(this._controllerModel.refresh(false, this._controllerModel.info.namespace));
		this.handleTableUpdated();
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
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const upgradesVersionLogLink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.versionLog,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/version-log'
		}).component();

		const upgradesInfoAndLink = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				infoAvailableUpgrades,
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

		this.handleTableUpdated();
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

		return this.modelView.modelBuilder.toolbarContainer().withToolbarItems(
			[
				{ component: refreshButton, toolbarSeparatorAfter: true },

			]
		).component();
	}

	private formatTableData(result: azExt.AzOutput<azExt.DcListUpgradesResult>): (string | azdata.ButtonComponent)[][] {
		let formattedValues: (string | azdata.ButtonComponent)[][] = [];
		const versions = result.stdout.versions;
		const dates = result.stdout.dates;
		const currentVersion = result.stdout.currentVersion;
		const nextVersion = this.getNextVersion(versions, currentVersion);

		// Iterate through all data controller versions from latest to oldest and stop when the loop reaches the current version.
		// Only makes table entries for the current version and newer. The upgrade button will only be enabled for the very next
		// version due to Azure CLI constraints.
		for (let i = 0; i < versions.length; i++) {
			if (versions[i] === currentVersion) {
				formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.currentVersion, false, '')]);
				break;
			} else if (versions[i] === nextVersion) {
				formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.upgrade, true, nextVersion)]);
			} else {
				formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.upgrade, false, '')]);
			}
		}
		return formattedValues;
	}

	private async handleTableUpdated(): Promise<void> {
		const result = await this._azApi.az.arcdata.dc.listUpgrades(this._controllerModel.info.namespace);
		let tableDisplay = this.formatTableData(result);
		let tableValues = tableDisplay.map(d => {
			return d.map((value: any): azdata.DeclarativeTableCellValue => {
				return { value: value };
			});
		});

		this._upgradesTable.setDataValues(tableValues);
		this._upgradesTableLoading.loading = false;
		this._upgradesContainer.addItem(this._upgradesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });
	}

	// Given the list of available versions and the current version, if the current version is not the newest,
	// then return the next version available. List of versions is ordered newest to oldest.
	// If current version is the newest, then return undefined.
	private getNextVersion(versions: string[], currentVersion: string): string | undefined {
		let index = versions.indexOf(currentVersion);
		// The version at index 0 will be the newest
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
						vscode.window.showInformationMessage(loc.upgradingController('kubectl get datacontrollers -A\' should not be localized.'));
						if (this._controllerModel.info.connectionMode.toLowerCase() === ConnectionMode.direct) {
							await vscode.window.withProgress(
								{
									location: vscode.ProgressLocation.Notification,
									title: loc.upgradingDirectDC(this._controllerModel.info.name, nextVersion, this._controllerModel.info.resourceGroup),
									cancellable: true
								},
								async (_progress, _token): Promise<void> => {
									if (nextVersion !== '') {
										await this._azApi.az.arcdata.dc.upgrade(
											nextVersion,
											this._controllerModel.info.name,
											this._controllerModel.info.resourceGroup,
											undefined, // Indirect mode argument - namespace
										);
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
						} else {
							await vscode.window.withProgress(
								{
									location: vscode.ProgressLocation.Notification,
									title: loc.upgradingIndirectDC(this._controllerModel.info.name, nextVersion, this._controllerModel.info.namespace),
									cancellable: true
								},
								async (_progress, _token): Promise<void> => {
									if (nextVersion !== '') {
										await this._azApi.az.arcdata.dc.upgrade(
											nextVersion,
											this._controllerModel.info.name,
											undefined, // Direct mode argument - resourceGroup
											this._controllerModel.info.namespace,
										);
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
						}
					} catch (error) {
						console.log(error);
					}
				}
			}));

		return upgradeButton;
	}
}

