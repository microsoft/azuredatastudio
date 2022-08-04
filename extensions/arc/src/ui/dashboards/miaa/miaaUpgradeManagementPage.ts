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
import { ControllerModel } from '../../../models/controllerModel';
import { UpgradeSqlMiaa } from '../../dialogs/upgradeSqlMiaa';
import { MiaaModel } from '../../../models/miaaModel';

export class MiaaUpgradeManagementPage extends DashboardPage {
	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
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
			url: 'https://docs.microsoft.com/azure/azure-arc/data/upgrade-sql-managed-instance-direct-cli?WT.mc_id=Portal-Microsoft_Azure_HybridData_Platform'
		}).component();

		const upgradesInfoAndLink = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				infoAvailableUpgrades,
				upgradesVersionLogLink
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		content.addItem(upgradesInfoAndLink, { CSSStyles: { 'min-height': '30px' } });

		const infoOnlyNextImmediateVersion = this.modelView.modelBuilder.text().withProps({
			value: loc.onlyNextImmediateVersionMiaa,
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

	private async getMiaaVersion(): Promise<string | undefined> {
		try {
			let miaaShowResult;
			miaaShowResult = await this._azApi.az.sql.miarc.show(
				this._miaaModel.info.name,
				{
					resourceGroup: undefined,
					namespace: this._controllerModel.info.namespace
				},
				this._controllerModel.azAdditionalEnvVars
			);
			return miaaShowResult.stdout.status.runningVersion;
		} catch (e) {
			console.error(loc.showMiaaError, e);
			return undefined;
		}
	}

	private async formatTableData(result: azExt.AzOutput<azExt.DcListUpgradesResult>): Promise<(string | azdata.ButtonComponent)[][]> {
		let formattedValues: (string | azdata.ButtonComponent)[][] = [];

		const versions = result.stdout.versions;
		const dates = result.stdout.dates;

		const currentControllerVersion = result.stdout.currentVersion;

		const currentMiaaVersion = await this.getMiaaVersion();
		const nextMiaaVersion = currentMiaaVersion ? this.getNextVersion(versions, currentMiaaVersion) : console.error(loc.miaaVersionError);

		if (currentMiaaVersion === currentControllerVersion) {
			for (let i = 0; i < versions.length; i++) {
				if (versions[i] === currentMiaaVersion) {
					formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.currentVersion, false)]);
					break;
				} else {
					formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.upgrade, false)]);
				}
			}
		} else {
			for (let i = 0; i < versions.length; i++) {
				if (versions[i] === nextMiaaVersion) {
					formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.upgrade, true)]);
					formattedValues.push([versions[i + 1], dates[i + 1], this.createUpgradeButton(loc.currentVersion, false)]);
					break;
				} else {
					formattedValues.push([versions[i], dates[i], this.createUpgradeButton(loc.upgrade, false)]);
				}
			}
		}
		return formattedValues;
	}

	private async handleTableUpdated(): Promise<void> {
		const result = await this._azApi.az.arcdata.dc.listUpgrades(this._controllerModel.info.namespace);
		let tableDisplay = await this.formatTableData(result);
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
	private createUpgradeButton(label: string, enabled: boolean): azdata.ButtonComponent | string {
		let upgradeButton = this.modelView.modelBuilder.button().withProps({
			label: label,
			enabled: enabled
		}).component();

		this.disposables.push(
			upgradeButton.onDidClick(async () => {
				const upgradeDialog = new UpgradeSqlMiaa(this._controllerModel);
				upgradeDialog.showDialog(loc.upgradeMiaa);
				let dialogClosed = await upgradeDialog.waitForClose();
				if (dialogClosed) {
					try {
						upgradeButton.enabled = false;
						vscode.window.showInformationMessage(loc.upgradingMiaa('kubectl get sqlmi -A\' should not be localized.'));
						await vscode.window.withProgress(
							{
								location: vscode.ProgressLocation.Notification,
								title: loc.upgradingIndirectMiaa(this._miaaModel.info.name, this._controllerModel.info.namespace),
								cancellable: true
							},
							async (_progress, _token): Promise<void> => {
								await this._azApi.az.sql.miarc.upgrade(
									this._miaaModel.info.name,
									{
										resourceGroup: undefined,
										namespace: this._controllerModel.info.namespace,
									}
								);
								try {
									await this._controllerModel.refresh(false, this._controllerModel.info.namespace);
								} catch (error) {
									vscode.window.showErrorMessage(loc.refreshFailed(error));
								}
							}
						);
					} catch (error) {
						console.log(error);
					}
				}
			}));

		return upgradeButton;
	}
}

