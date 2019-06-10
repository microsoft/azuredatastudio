/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';

import JupyterServerInstallation, { PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { ManagePackagesDialog } from './managePackagesDialog';
import CodeAdapter from '../../prompts/adapter';
import { QuestionTypes, IQuestion } from '../../prompts/question';

const localize = nls.loadMessageBundle();

export class InstalledPackagesTab {
	private prompter: CodeAdapter;

	private installedPkgTab: azdata.window.DialogTab;

	private installedPackageCount: azdata.TextComponent;
	private installedPackagesTable: azdata.TableComponent;
	private installedPackagesLoader: azdata.LoadingComponent;
	private uninstallPackageButton: azdata.ButtonComponent;

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.prompter = new CodeAdapter();

		this.installedPkgTab = azdata.window.createTab(localize('managePackages.installedTabTitle', "Installed"));

		this.installedPkgTab.registerContent(async view => {
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
		let packagesLocation: string;

		await this.installedPackagesLoader.updateProperties({ loading: true });
		await this.uninstallPackageButton.updateProperties({ enabled: false });
		try {
			pythonPackages = await this.jupyterInstallation.getInstalledPipPackages();
			packagesLocation = await this.jupyterInstallation.getPythonPackagesPath();
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

		let countMsg: string;
		if (packagesLocation && packagesLocation.length > 0) {
			countMsg = localize('managePackages.packageCount', "{0} packages found in '{1}'",
				packageCount,
				packagesLocation);
		} else {
			countMsg = localize('managePackages.packageCountNoPath', "{0} packages found",
				packageCount);
		}
		await this.installedPackageCount.updateProperties({
			value: countMsg
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
			message: localize('managePackages.confirmUninstall', 'Are you sure you want to uninstall the specified packages?'),
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
				this.dialog.showInfoMessage(
					localize('managePackages.backgroundUninstallStarted',
						"Started background uninstall for {0}.",
						packagesStr));

				await this.jupyterInstallation.uninstallPipPackages(packages);

				this.jupyterInstallation.outputChannel.appendLine(
					localize('managePackages.backgroundUninstallComplete',
						"Completed uninstall for {0}.",
						packagesStr));

				await this.loadInstalledPackagesInfo();
			} catch (err) {
				this.dialog.showErrorMessage(utils.getErrorMessage(err));
			}
		}

		this.uninstallPackageButton.updateProperties({ enabled: true });
	}
}