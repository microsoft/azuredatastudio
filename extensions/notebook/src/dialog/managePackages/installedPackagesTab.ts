/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import { JupyterServerInstallation, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { ManagePackagesDialog } from './managePackagesDialog';
import CodeAdapter from '../../prompts/adapter';
import { QuestionTypes, IQuestion } from '../../prompts/question';

const localize = nls.loadMessageBundle();

export class InstalledPackagesTab {
	private prompter: CodeAdapter;

	private installedPkgTab: azdata.window.DialogTab;

	private packageTypeDropdown: azdata.DropDownComponent;
	private locationComponent: azdata.TextComponent;
	private installedPackageCount: azdata.TextComponent;
	private installedPackagesTable: azdata.TableComponent;
	private installedPackagesLoader: azdata.LoadingComponent;
	private uninstallPackageButton: azdata.ButtonComponent;

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.prompter = new CodeAdapter();

		this.installedPkgTab = azdata.window.createTab(localize('managePackages.installedTabTitle', "Installed"));

		this.installedPkgTab.registerContent(async view => {

			// TODO: only supporting single location for now. We should add a drop down for multi locations mode
			//
			let locationTitle = await this.dialog.model.getLocationTitle();
			this.locationComponent = view.modelBuilder.text().withProperties({
				value: locationTitle
			}).component();

			let dropdownValues = this.dialog.model.getPackageTypes().map(x => {
				return {
					name: x.providerId,
					displayName: x.packageType
				};
			});
			let defaultPackageType = this.dialog.model.getDefaultPackageType();
			this.packageTypeDropdown = view.modelBuilder.dropDown().withProperties({
				values: dropdownValues,
				value: defaultPackageType
			}).component();
			this.dialog.changeProvider(defaultPackageType.providerId);
			this.packageTypeDropdown.onValueChanged(() => {
				this.dialog.resetPages((<azdata.CategoryValue>this.packageTypeDropdown.value).name)
					.catch(err => {
						this.dialog.showErrorMessage(utils.getErrorMessage(err));
					});
			});

			this.installedPackageCount = view.modelBuilder.text().withProperties({
				value: ''
			}).component();

			this.installedPackagesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						localize('managePackages.pkgNameColumn', "Name"),
						localize('managePackages.newPkgVersionColumn', "Version")
					],
					data: [[]],
					height: '600px',
					width: '400px'
				}).component();

			this.uninstallPackageButton = view.modelBuilder.button()
				.withProperties({
					label: localize('managePackages.uninstallButtonText', "Uninstall selected packages"),
					width: '200px'
				}).component();
			this.uninstallPackageButton.onDidClick(() => this.doUninstallPackage());

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.locationComponent,
					title: localize('managePackages.location', "Location")
				}, {
					component: this.packageTypeDropdown,
					title: localize('managePackages.packageType', "Package Type")
				}, {
					component: this.installedPackageCount,
					title: ''
				}, {
					component: this.installedPackagesTable,
					title: ''
				}, {
					component: this.uninstallPackageButton,
					title: ''
				}]).component();

			this.installedPackagesLoader = view.modelBuilder.loadingComponent()
				.withItem(formModel)
				.withProperties({
					loading: true
				}).component();

			await view.initializeModel(this.installedPackagesLoader);

			await this.loadInstalledPackagesInfo();
			this.packageTypeDropdown.focus();
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this.installedPkgTab;
	}

	public async loadInstalledPackagesInfo(): Promise<void> {
		let pythonPackages: PythonPkgDetails[];

		await this.installedPackagesLoader.updateProperties({ loading: true });
		await this.uninstallPackageButton.updateProperties({ enabled: false });
		try {
			pythonPackages = await this.dialog.model.listPackages();
		} catch (err) {
			this.dialog.showErrorMessage(utils.getErrorMessage(err));
		} finally {
			await this.installedPackagesLoader.updateProperties({ loading: false });
		}

		let packageData: string[][];
		let packageCount: number;
		if (pythonPackages) {
			packageCount = pythonPackages.length;
			packageData = pythonPackages.map(pkg => [pkg.name, pkg.version]);
		} else {
			packageCount = 0;
		}

		await this.installedPackageCount.updateProperties({
			value: localize('managePackages.packageCount', "{0} {1} packages found",
				packageCount,
				this.dialog.model.currentPackageType)
		});

		if (packageData) {
			await this.installedPackagesTable.updateProperties({
				data: packageData,
				selectedRows: packageData.length > 0 ? [0] : []
			});
			await this.uninstallPackageButton.updateProperties({ enabled: true });
		}
	}

	private async doUninstallPackage(): Promise<void> {
		let rowNums = this.installedPackagesTable.selectedRows;
		if (!rowNums || rowNums.length === 0) {
			return;
		}

		this.uninstallPackageButton.updateProperties({ enabled: false });
		let doUninstall = await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: localize('managePackages.confirmUninstall', "Are you sure you want to uninstall the specified packages?"),
			default: false
		});

		if (doUninstall) {
			try {
				let packages: PythonPkgDetails[] = rowNums.map(rowNum => {
					let row = this.installedPackagesTable.data[rowNum];
					return {
						name: row[0],
						version: row[1]
					};
				});

				let packagesStr = packages.map(pkg => {
					return `${pkg.name} ${pkg.version}`;
				}).join(', ');
				let taskName = localize('managePackages.backgroundUninstallStarted',
					"Uninstalling {0}",
					packagesStr);

				this.jupyterInstallation.apiWrapper.startBackgroundOperation({
					displayName: taskName,
					description: taskName,
					isCancelable: false,
					operation: op => {
						let uninstallPromise: Promise<void> = this.dialog.model.uninstallPackages(packages);
						uninstallPromise
							.then(async () => {
								let uninstallMsg = localize('managePackages.backgroundUninstallComplete',
									"Completed uninstall for {0}",
									packagesStr);

								op.updateStatus(azdata.TaskStatus.Succeeded, uninstallMsg);
								this.jupyterInstallation.outputChannel.appendLine(uninstallMsg);

								await this.loadInstalledPackagesInfo();
							})
							.catch(err => {
								let uninstallFailedMsg = localize('managePackages.backgroundUninstallFailed',
									"Failed to uninstall {0}. Error: {1}",
									packagesStr,
									utils.getErrorMessage(err));

								op.updateStatus(azdata.TaskStatus.Failed, uninstallFailedMsg);
								this.jupyterInstallation.outputChannel.appendLine(uninstallFailedMsg);
							});
					}
				});
			} catch (err) {
				this.dialog.showErrorMessage(utils.getErrorMessage(err));
			}
		}

		this.uninstallPackageButton.updateProperties({ enabled: true });
	}
}
