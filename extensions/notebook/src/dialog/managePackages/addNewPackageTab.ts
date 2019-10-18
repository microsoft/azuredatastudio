/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as request from 'request';

import { JupyterServerInstallation, PipPackageOverview } from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { ManagePackagesDialog } from './managePackagesDialog';
import { PythonPkgType } from '../../common/constants';

const localize = nls.loadMessageBundle();

export class AddNewPackageTab {
	private addNewPkgTab: azdata.window.DialogTab;

	private newPackagesSearchBar: azdata.InputBoxComponent;
	private packagesSearchButton: azdata.ButtonComponent;
	private newPackagesName: azdata.TextComponent;
	private newPackagesNameLoader: azdata.LoadingComponent;
	private newPackagesVersions: azdata.DropDownComponent;
	private newPackagesVersionsLoader: azdata.LoadingComponent;
	private newPackagesSummary: azdata.TextComponent;
	private newPackagesSummaryLoader: azdata.LoadingComponent;
	private packageInstallButton: azdata.ButtonComponent;

	private readonly InvalidTextPlaceholder = localize('managePackages.invalidTextPlaceholder', "N/A");
	private readonly PackageNotFoundError = localize('managePackages.packageNotFound', "Could not find the specified package");
	private readonly SearchPlaceholder = (pkgType: string) => localize('managePackages.searchBarPlaceholder', "Search {0} packages", pkgType);

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.addNewPkgTab = azdata.window.createTab(localize('managePackages.addNewTabTitle', "Add new"));

		this.addNewPkgTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox().withProperties({ width: '400px' }).component();

			this.packagesSearchButton = view.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: localize('managePackages.searchButtonLabel', "Search"),
					width: '200px'
				}).component();
			this.packagesSearchButton.onDidClick(() => {
				this.loadNewPackageInfo();
			});

			this.newPackagesName = view.modelBuilder.text().withProperties({ width: '400px' }).component();
			this.newPackagesNameLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesName)
				.component();

			this.newPackagesVersions = view.modelBuilder.dropDown().withProperties({ width: '400px' }).component();
			this.newPackagesVersionsLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesVersions)
				.component();

			this.newPackagesSummary = view.modelBuilder.text().withProperties({ width: '400px' }).component();
			this.newPackagesSummaryLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesSummary)
				.component();

			this.packageInstallButton = view.modelBuilder.button().withProperties({
				label: localize('managePackages.installButtonText', "Install"),
				width: '200px'
			}).component();
			this.packageInstallButton.onDidClick(() => {
				this.doPackageInstall();
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Package Version")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.packageInstallButton,
					title: ''
				}]).component();

			await view.initializeModel(formModel);

			await this.resetPageFields();
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this.addNewPkgTab;
	}

	public async resetPageFields(): Promise<void> {
		await this.toggleNewPackagesFields(false);
		try {
			await this.packageInstallButton.updateProperties({ enabled: false });

			await this.newPackagesSearchBar.updateProperties({
				value: '',
				placeHolder: this.SearchPlaceholder(this.dialog.currentPkgType)
			});
			await this.setFieldsToEmpty();
		} finally {
			await this.toggleNewPackagesFields(true);
		}
	}

	private async toggleNewPackagesFields(enable: boolean): Promise<void> {
		await this.packagesSearchButton.updateProperties({ enabled: enable });
		await this.newPackagesNameLoader.updateProperties({ loading: !enable });
		await this.newPackagesVersionsLoader.updateProperties({ loading: !enable });
		await this.newPackagesSummaryLoader.updateProperties({ loading: !enable });
	}

	private async setFieldsToEmpty(): Promise<void> {
		await this.newPackagesName.updateProperties({
			value: this.InvalidTextPlaceholder
		});
		await this.newPackagesVersions.updateProperties({
			values: [this.InvalidTextPlaceholder],
			value: this.InvalidTextPlaceholder
		});
		await this.newPackagesSummary.updateProperties({
			value: this.InvalidTextPlaceholder
		});
	}

	private async loadNewPackageInfo(): Promise<void> {
		await this.packageInstallButton.updateProperties({ enabled: false });
		await this.toggleNewPackagesFields(false);
		try {
			let packageName = this.newPackagesSearchBar.value;
			if (!packageName || packageName.length === 0) {
				return;
			}

			let pipPackage: PipPackageOverview;
			if (this.dialog.currentPkgType === PythonPkgType.Anaconda) {
				pipPackage = await this.fetchCondaPackage(packageName);
			} else {
				pipPackage = await this.fetchPypiPackage(packageName);
			}
			if (!pipPackage.versions || pipPackage.versions.length === 0) {
				this.dialog.showErrorMessage(
					localize('managePackages.noVersionsFound',
						"Could not find any valid versions for the specified package"));
				await this.setFieldsToEmpty();
				return;
			}

			await this.newPackagesName.updateProperties({
				value: packageName
			});
			await this.newPackagesVersions.updateProperties({
				values: pipPackage.versions,
				value: pipPackage.versions[0],
			});
			await this.newPackagesSummary.updateProperties({
				value: pipPackage.summary
			});

			// Only re-enable install on success
			await this.packageInstallButton.updateProperties({ enabled: true });
		} catch (err) {
			this.dialog.showErrorMessage(utils.getErrorMessage(err));
			await this.setFieldsToEmpty();
		} finally {
			await this.toggleNewPackagesFields(true);
		}
	}

	private async fetchPypiPackage(packageName: string): Promise<PipPackageOverview> {
		return new Promise<PipPackageOverview>((resolve, reject) => {
			request.get(`https://pypi.org/pypi/${packageName}/json`, { timeout: 10000 }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(this.PackageNotFoundError);
				}

				if (response.statusCode !== 200) {
					return reject(
						localize('managePackages.packageRequestError',
							"Package info request failed with error: {0} {1}",
							response.statusCode,
							response.statusMessage));
				}

				let versionNums: string[] = [];
				let packageSummary = '';

				let packagesJson = JSON.parse(body);
				if (packagesJson) {
					if (packagesJson.releases) {
						let versionKeys = Object.keys(packagesJson.releases);
						versionKeys = versionKeys.filter(versionKey => {
							let releaseInfo = packagesJson.releases[versionKey];
							return Array.isArray(releaseInfo) && releaseInfo.length > 0;
						});
						versionNums = utils.sortPackageVersions(versionKeys, false);
					}

					if (packagesJson.info && packagesJson.info.summary) {
						packageSummary = packagesJson.info.summary;
					}
				}

				resolve({
					name: packageName,
					versions: versionNums,
					summary: packageSummary
				});
			});
		});
	}

	private async fetchCondaPackage(packageName: string): Promise<PipPackageOverview> {
		let condaExe = this.jupyterInstallation.getCondaExePath();
		let cmd = `"${condaExe}" search --json ${packageName}`;
		let packageResult: string;
		try {
			packageResult = await this.jupyterInstallation.executeBufferedCommand(cmd);
		} catch (err) {
			throw new Error(this.PackageNotFoundError);
		}

		if (packageResult) {
			let packageJson = JSON.parse(packageResult);
			if (packageJson) {
				if (packageJson.error) {
					throw new Error(packageJson.error);
				}

				let packages = packageJson[packageName];
				if (Array.isArray(packages)) {
					let allVersions = packages.filter(pkg => pkg && pkg.version).map(pkg => pkg.version);
					let singletonVersions = new Set<string>(allVersions);
					let sortedVersions = utils.sortPackageVersions(Array.from(singletonVersions), false);
					return {
						name: packageName,
						versions: sortedVersions,
						summary: undefined
					};
				}
			}
		}

		return undefined;
	}

	private async doPackageInstall(): Promise<void> {
		let packageName = this.newPackagesName.value;
		let packageVersion = this.newPackagesVersions.value as string;
		if (!packageName || packageName.length === 0 ||
			!packageVersion || packageVersion.length === 0) {
			return;
		}

		let taskName = localize('managePackages.backgroundInstallStarted',
			"Installing {0} {1}",
			packageName,
			packageVersion);
		this.jupyterInstallation.apiWrapper.startBackgroundOperation({
			displayName: taskName,
			description: taskName,
			isCancelable: false,
			operation: op => {
				let installPromise: Promise<void>;
				if (this.dialog.currentPkgType === PythonPkgType.Anaconda) {
					installPromise = this.jupyterInstallation.installCondaPackages([{ name: packageName, version: packageVersion }], false);
				} else {
					installPromise = this.jupyterInstallation.installPipPackages([{ name: packageName, version: packageVersion }], false);
				}
				installPromise
					.then(async () => {
						let installMsg = localize('managePackages.backgroundInstallComplete',
							"Completed install for {0} {1}",
							packageName,
							packageVersion);

						op.updateStatus(azdata.TaskStatus.Succeeded, installMsg);
						this.jupyterInstallation.outputChannel.appendLine(installMsg);

						await this.dialog.refreshInstalledPackages();
					})
					.catch(err => {
						let installFailedMsg = localize('managePackages.backgroundInstallFailed',
							"Failed to install {0} {1}. Error: {2}",
							packageName,
							packageVersion,
							utils.getErrorMessage(err));

						op.updateStatus(azdata.TaskStatus.Failed, installFailedMsg);
						this.jupyterInstallation.outputChannel.appendLine(installFailedMsg);
					});
			}
		});
	}
}
