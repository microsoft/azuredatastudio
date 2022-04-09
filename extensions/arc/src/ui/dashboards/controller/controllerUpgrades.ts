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
		// this.disposables.push(
		// 	this._controllerModel.onDatabasesUpdated(() => this.eventuallyRunOnInitialized(() => this.handleDatabasesUpdated())),
		// );
	}
	private _upgradesContainer!: azdata.DivContainer;
	private _configureRetentionPolicyButton!: azdata.ButtonComponent;
	// private _connectToServerLoading!: azdata.LoadingComponent;
	// private _connectToServerButton!: azdata.ButtonComponent;
	private _upgradesTableLoading!: azdata.LoadingComponent;
	private _upgradesTable!: azdata.DeclarativeTableComponent;
	private _upgradesMessage!: azdata.TextComponent;
	private readonly _azApi: azExt.IExtension;

	// private _saveArgs: RPModel = {
	// 	recoveryPointObjective: '',
	// 	retentionDays: ''
	// };

	// Upgrade Args Notes
	// --desired-version -v  : The desired version tag to which the data controller will be upgraded,
	//                         or empty to use the latest.
	// --dry-run -d          : Indicates which instance would be upgraded but does not actually upgrade
	//                         the instances.
	// --k8s-namespace -k    : The Kubernetes namespace in which the data controller exists.
	// --name -n             : The name for the data controller.
	// --no-wait             : If given, the command will start the upgrade, but will not wait for the
	//                         entire upgrade to complete. Upgrade will continue in the background.
	// --resource-group -g   : The Azure resource group in which the data controller resource should be
	//                         added.
	// --target [Deprecated] : The desired version tag to which the data controller will be
	//                         upgraded, or empty to use the latest.
	//     Option '--target' has been deprecated and will be removed in a future release. Use '--
	//     desired-version' instead.
	// --use-k8s             : Upgrade data controller using local Kubernetes APIs.


	private _upgradeArgs = {
		desiredVersion: '',
		dryRun: false,
		k8snamespace: '',
		name: '',
		noWait: true,
		resourceGroup: '',
		usek8s: ''
	};

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
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		const upgradesLearnMoreLink = this.modelView.modelBuilder.hyperlink().withProps({
			label: loc.learnMore,
			url: 'https://docs.microsoft.com/azure/azure-arc/data/upgrade-data-controller-direct-cli?WT.mc_id=Portal-Microsoft_Azure_HybridData_Platform',
			CSSStyles: { 'margin-block-start': '0px', 'margin-block-end': '0px' }
		}).component();

		const upgradesInfoAndLink = this.modelView.modelBuilder.flexContainer()
			.withLayout({ flexWrap: 'wrap' })
			.withItems([
				upgradesInfoDescription,
				upgradesLearnMoreLink
			], { CSSStyles: { 'margin-right': '5px' } }).component();

		content.addItem(upgradesInfoAndLink, { CSSStyles: { 'min-height': '30px' } });

		const infoOnlyNextImmediateVersion = this.modelView.modelBuilder.text().withProps({
			value: loc.onlyNextImmediateVersion,
			CSSStyles: { ...cssStyles.text, 'margin-block-start': '0px', 'margin-block-end': '0px', 'max-width': 'auto' }
		}).component();

		content.addItem(infoOnlyNextImmediateVersion, { CSSStyles: { 'min-height': '30px' } });

		// Create loaded components

		// const connectToServerText = this.modelView.modelBuilder.text().withProps({
		// 	value: loc.miaaConnectionRequired
		// }).component();

		// this._connectToServerButton = this.modelView.modelBuilder.button().withProps({
		// 	label: loc.connectToServer,
		// 	enabled: false,
		// 	CSSStyles: { 'max-width': '125px', 'margin-left': '40%' }
		// }).component();

		// const connectToServerContainer = this.modelView.modelBuilder.divContainer().component();

		// connectToServerContainer.addItem(connectToServerText, { CSSStyles: { 'text-align': 'center', 'margin-top': '20px' } });
		// connectToServerContainer.addItem(this._connectToServerButton);

		// this._connectToServerLoading = this.modelView.modelBuilder.loadingComponent().withItem(connectToServerContainer).component();

		// this._upgradesContainer.addItem(this._connectToServerLoading, { CSSStyles: { 'margin-top': '20px' } });

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
					displayName: loc.releaseNotes,
					valueType: azdata.DeclarativeDataType.component,
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

		// For links in tables
		// displayName: loc.endpoint,
		// valueType: azdata.DeclarativeDataType.component,
		// isReadOnly: true,
		// width: '50%',
		// headerCssStyles: cssStyles.tableHeader,
		// rowCssStyles: {
		// 	...cssStyles.tableRow,
		// 	'overflow': 'hidden',
		// 	'text-overflow': 'ellipsis',
		// 	'white-space': 'nowrap',
		// 	'max-width': '0'
		// }

		this._upgradesMessage = this.modelView.modelBuilder.text()
			.withProps({ CSSStyles: { 'text-align': 'center' } })
			.component();

		this.handleDatabasesUpdated();
		this._upgradesTableLoading.component = this._upgradesTable;
		// this.disposables.push(
		// 	this._connectToServerButton!.onDidClick(async () => {
		// 		this._connectToServerButton!.enabled = false;
		// 		this._databasesTableLoading!.loading = true;
		// 		try {
		// 			await this._miaaModel.callGetDatabases();
		// 		} catch {
		// 			this._connectToServerButton!.enabled = true;
		// 		}
		// 	})
		// );
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
		// this.disposables.push(
		// this._configureRetentionPolicyButton.onDidClick(async () => {
		// const retentionPolicySqlDialog = new ConfigureRPOSqlDialog(this._controllerModel);
		// this.refreshRD();
		// retentionPolicySqlDialog.showDialog(loc.configureRP, this._saveArgs.retentionDays);

		// let rpArg = await retentionPolicySqlDialog.waitForClose();
		// if (rpArg) {
		// 	try {
		// 		this._configureRetentionPolicyButton.enabled = false;
		// 		this._saveArgs.retentionDays = rpArg.retentionDays;
		// 		await vscode.window.withProgress(
		// 			{
		// 				location: vscode.ProgressLocation.Notification,
		// 				title: loc.updatingInstance(this._controllerModel.info.name),
		// 				cancellable: false
		// 			},
		// 			async (_progress, _token): Promise<void> => {
		// 				if (this._controllerModel.info.connectionMode === ConnectionMode.direct) {
		// 					await this._azApi.az.sql.miarc.update(
		// 						this._controllerModel.info.name,
		// 						this._saveArgs,
		// 						this._controllerModel.info.resourceGroup,
		// 						undefined, // Indirect mode argument - namespace
		// 						undefined, // Indirect mode argument - usek8s
		// 						this._controllerModel.azAdditionalEnvVars);
		// 				} else {
		// 					await this._azApi.az.sql.miarc.update(
		// 						this._controllerModel.info.name,
		// 						this._saveArgs,
		// 						undefined, // Direct mode argument - resourceGroup
		// 						this._controllerModel.info.namespace,
		// 						true,
		// 						this._controllerModel.azAdditionalEnvVars);
		// 				}
		// 				try {
		// 					await this._controllerModel.refresh(false, this._controllerModel.info.namespace);
		// 				} catch (error) {
		// 					vscode.window.showErrorMessage(loc.refreshFailed(error));
		// 				}
		// 			}
		// 		);

		// 	} catch (error) {
		// 		vscode.window.showErrorMessage(loc.updateExtensionsFailed(error));
		// 	} finally {
		// 		this._configureRetentionPolicyButton.enabled = true;
		// 	}
		// }
		// }));

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
				formattedValues.push([versions[i], dates[i], '', this.createUpgradeButton('Current version', false, '')]);
			} else if (versions[i] === nextVersion) {
				formattedValues.push([versions[i], dates[i], '', this.createUpgradeButton('Upgrade', true, nextVersion)]);
			} else {
				formattedValues.push([versions[i], dates[i], '', '']);
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

		// 	if (this._miaaModel.databasesLastUpdated) {
		// 		// We successfully connected so now can remove the button and replace it with the actual databases table
		// 		this._databasesContainer.removeItem(this._connectToServerLoading);
		this._upgradesContainer.addItem(this._upgradesTableLoading, { CSSStyles: { 'margin-bottom': '20px' } });

		// 	} else {
		// 		// If we don't have an endpoint then there's no point in showing the connect button - but the logic
		// 		// to display text informing the user of this is already handled by the handleMiaaConfigUpdated
		// 		if (this._miaaModel?.config?.status.primaryEndpoint) {
		// 			this._connectToServerLoading.loading = false;
		// 			this._connectToServerButton.enabled = true;
		// 		}
		// 	}
	}

	// private refreshRD(): void {
	// 	this._saveArgs.retentionDays = this._miaaModel.config?.spec?.backup?.retentionPeriodInDays.toString() ?? '';
	// }

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
		const upgradeButton = this.modelView.modelBuilder.button().withProps({
			enabled: enabled,
			label: label,
		}).component();

		this.disposables.push(
			upgradeButton.onDidClick(async () => {
				const upgradeDialog = new UpgradeController(this._controllerModel);
				upgradeDialog.showDialog(loc.upgradeDataController);
				let args = await upgradeDialog.waitForClose();
				if (args) {
					try {
						//
						// private _upgradeArgs = {
						// 	desiredVersion: '',
						// 	dryRun: false,
						// 	k8snamespace: '',
						// 	name: '',
						// 	noWait: true,
						// 	resourceGroup: '',
						// 	usek8s: ''
						// };
						upgradeButton.enabled = false;
						this._upgradeArgs.name = args.instanceName; // False data, just setting the args here but should be determined by what version button was pressed
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

