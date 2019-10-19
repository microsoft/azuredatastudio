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
import { PythonPkgType } from '../../common/constants';

const localize = nls.loadMessageBundle();

export class InstalledPackagesTab {
	private prompter: CodeAdapter;

	private installedPkgTab: azdata.window.DialogTab;

	private packageTypeDropdown: azdata.DropDownComponent;
	private installedPackageCount: azdata.TextComponent;
	private installedPackagesTable: azdata.TableComponent;
	private installedPackagesLoader: azdata.LoadingComponent;
	private uninstallPackageButton: azdata.ButtonComponent;

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.prompter = new CodeAdapter();

		this.installedPkgTab = azdata.window.createTab(localize('managePackages.installedTabTitle', "Installed"));

		this.installedPkgTab.registerContent(async view => {
			let dropdownValues: string[];
			if (this.dialog.currentPkgType === PythonPkgType.Anaconda) {
				dropdownValues = [PythonPkgType.Anaconda, PythonPkgType.Pip];
			} else {
				dropdownValues = [PythonPkgType.Pip];
			}
			this.packageTypeDropdown = view.modelBuilder.dropDown().withProperties({
				values: dropdownValues,
				value: dropdownValues[0]
			}).component();
			this.packageTypeDropdown.onValueChanged(() => {
				this.dialog.resetPages(this.packageTypeDropdown.value as PythonPkgType)
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
			if (this.dialog.currentPkgType === PythonPkgType.Anaconda) {
				pythonPackages = await this.jupyterInstallation.getInstalledCondaPackages();
			} else {
				pythonPackages = await this.jupyterInstallation.getInstalledPipPackages();
			}
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
				this.dialog.currentPkgType)
		});

		if (packageData && packageData.length > 0) {
			await this.installedPackagesTable.updateProperties({
				data: packageData,
				selectedRows: [0]
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
						let uninstallPromise: Promise<void>;
						if (this.dialog.currentPkgType === PythonPkgType.Anaconda) {
							uninstallPromise = this.jupyterInstallation.uninstallCondaPackages(packages);
						} else {
							uninstallPromise = this.jupyterInstallation.uninstallPipPackages(packages);
						}
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