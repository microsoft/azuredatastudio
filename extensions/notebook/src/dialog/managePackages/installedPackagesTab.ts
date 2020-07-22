/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';

import { JupyterServerInstallation, PythonPkgDetails } from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { ManagePackagesDialog } from './managePackagesDialog';
import CodeAdapter from '../../prompts/adapter';
import { IQuestion, confirm } from '../../prompts/question';
import { IconPathHelper } from '../../common/iconHelper';

const localize = nls.loadMessageBundle();

export class InstalledPackagesTab {
	private prompter: CodeAdapter;

	private installedPkgTab: azdata.window.DialogTab;

	private packageTypeDropdown: azdata.DropDownComponent;
	private locationComponent: azdata.Component;
	private installedPackageCount: azdata.TextComponent;
	private installedPackagesTable: azdata.TableComponent;
	private installedPackagesLoader: azdata.LoadingComponent;
	private uninstallPackageButton: azdata.ButtonComponent;
	private view: azdata.ModelView | undefined;
	private formBuilder: azdata.FormBuilder;
	private disposables: vscode.Disposable[] = [];

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.prompter = new CodeAdapter();

		this.installedPkgTab = azdata.window.createTab(localize('managePackages.installedTabTitle', "Installed"));

		this.installedPkgTab.registerContent(async view => {
			this.view = view;

			// Dispose the resources
			this.disposables.push(view.onClosed(() => {
				this.disposables.forEach(d => {
					try { d.dispose(); } catch { }
				});
			}));
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
			this.packageTypeDropdown.onValueChanged(async () => {
				this.dialog.changeProvider((<azdata.CategoryValue>this.packageTypeDropdown.value).name);
				try {
					await this.resetLocations();
					await this.dialog.resetPages();
				}
				catch (err) {
					this.dialog.showErrorMessage(utils.getErrorMessage(err));

				}

			});

			this.installedPackageCount = view.modelBuilder.text().withProperties({
				value: ''
			}).component();

			this.installedPackagesTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						{
							value: localize('managePackages.pkgNameColumn', "Name"),
							type: azdata.ColumnType.text
						},
						{
							value: localize('managePackages.newPkgVersionColumn', "Version"),
							type: azdata.ColumnType.text
						},
						{
							value: localize('managePackages.deleteColumn', "Delete"),
							type: azdata.ColumnType.button,
							options: {
								icon: IconPathHelper.delete
							}
						}
					],
					data: [[]],
					height: '600px',
					width: '400px'
				}).component();
			this.disposables.push(this.installedPackagesTable.onCellAction(async (rowState) => {
				let buttonState = <azdata.ICellActionEventArgs>rowState;
				if (buttonState) {
					await this.doUninstallPackage([rowState.row]);
				}
			}));

			this.uninstallPackageButton = view.modelBuilder.button()
				.withProperties({
					label: localize('managePackages.uninstallButtonText', "Uninstall selected packages"),
					width: '200px'
				}).component();
			this.uninstallPackageButton.onDidClick(() => this.doUninstallPackage(this.installedPackagesTable.selectedRows));

			this.formBuilder = view.modelBuilder.formContainer()
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
				}]);
			await this.resetLocations();

			this.installedPackagesLoader = view.modelBuilder.loadingComponent()
				.withItem(this.formBuilder.component())
				.withProperties({
					loading: true
				}).component();

			await view.initializeModel(this.installedPackagesLoader);

			await this.loadInstalledPackagesInfo();
			this.packageTypeDropdown.focus();
		});
	}

	private async resetLocations(): Promise<void> {
		if (this.view) {
			if (this.locationComponent) {
				this.formBuilder.removeFormItem({
					component: this.locationComponent,
					title: localize('managePackages.location', "Location")
				});
			}

			this.locationComponent = await InstalledPackagesTab.getLocationComponent(this.view, this.dialog);

			this.formBuilder.insertFormItem({
				component: this.locationComponent,
				title: localize('managePackages.location', "Location")
			}, 1);
		}
	}

	/**
	 * Creates a component for package locations
	 * @param view Model view
	 * @param dialog Manage package dialog
	 */
	public static async getLocationComponent(view: azdata.ModelView, dialog: ManagePackagesDialog): Promise<azdata.Component> {
		const locations = await dialog.model.getLocations();
		let component: azdata.Component;
		if (locations && locations.length === 1) {
			component = view.modelBuilder.text().withProperties({
				value: locations[0].displayName
			}).component();
		} else if (locations) {
			let dropdownValues = locations.map(x => {
				return {
					name: x.name,
					displayName: x.displayName
				};
			});
			let locationDropDown = view.modelBuilder.dropDown().withProperties({
				values: dropdownValues,
				value: dropdownValues[0]
			}).component();

			locationDropDown.onValueChanged(async () => {
				dialog.changeLocation((<azdata.CategoryValue>locationDropDown.value).name);
				try {
					await dialog.resetPages();
				}
				catch (err) {
					dialog.showErrorMessage(utils.getErrorMessage(err));
				}
			});
			component = locationDropDown;
		} else {
			component = view.modelBuilder.text().withProperties({
			}).component();
		}
		if (locations && locations.length > 0) {
			dialog.changeLocation(locations[0].name);
		}
		return component;
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

	private async doUninstallPackage(rowNums: number[]): Promise<void> {
		if (!rowNums || rowNums.length === 0) {
			return;
		}

		this.uninstallPackageButton.updateProperties({ enabled: false });
		let doUninstall = await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: confirm,
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

				azdata.tasks.startBackgroundOperation({
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
