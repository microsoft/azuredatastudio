/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as mssql from '../../../../mssql/src/mssql';

import { ExternalLanguageDialogBase } from './externalLanguageDialogBase';
import { ExternalLanguageContentsTable } from './externalLanguageContentsTable';
import { FileBrowserDialog } from './fileBrowserDialog';

const localize = nls.loadMessageBundle();

export class AddNewLanguageTab {
	private addNewPkgTab: azdata.window.DialogTab;
	private languageName: azdata.TextComponent | undefined;
	private editMode: boolean = false;
	private saveButton: azdata.ButtonComponent | undefined;

	constructor(private _dialog: ExternalLanguageDialogBase, private _language?: mssql.ExternalLanguage) {
		this.editMode = _language !== undefined;
		let language = this._language || {
			name: '',
			owner: '',
			contents: [],
			createdDate: ''
		};
		this.addNewPkgTab = azdata.window.createTab(localize('managePackages.addNewTabTitle', "Add new"));

		this.addNewPkgTab.registerContent(async view => {
			if (!this._dialog) {
				return;
			}

			this.languageName = view.modelBuilder.inputBox().withProperties({
				value: language.name,
				width: '400px'
			}).component();

			this.languageName.enabled = !this.editMode;

			let extensionFile = view.modelBuilder.inputBox().withProperties({
				value: '',
				width: '400px'
			}).component();
			let fileBrowser = view.modelBuilder.button().withProperties({
				label: '...',
				width: '20px'
			}).component();
			fileBrowser.onDidClick(async () => {
				let dialog = new FileBrowserDialog(this._dialog.model.connectionUrl);
				dialog.onPathSelected((selectedPath) => {
					extensionFile.value = selectedPath;
				});
				dialog.showDialog();
				//await this.doPackageInstall();
			});

			let fileBrowser2 = view.modelBuilder.button().withProperties({
				label: '...',
				width: '20px'
			}).component();
			fileBrowser2.onDidClick(async () => {
				let dialog = new FileBrowserDialog(this._dialog.model.connectionUrl);
				dialog.onPathSelected((selectedPath) => {
					let envName = '';
					switch (languageType.value) {
						case 'Java':
							envName = 'JRE_HOME';
							break;
						case 'R':
							envName = 'R_HOME';
							break;
						case 'Python':
							envName = 'PYTHONHOME';

						default:
							break;
					}
					envVariables.value = `{"${envName}":"${selectedPath}"`;
				});
				dialog.showDialog();
				//await this.doPackageInstall();
			});

			let extensionFileName = view.modelBuilder.inputBox().withProperties({
				value: '',
				width: '400px'
			}).component();
			let platformName = view.modelBuilder.inputBox().withProperties({
				value: '',
				width: '400px'
			}).component();
			let languageType = view.modelBuilder.dropDown().withProperties({
				values: ['Python', 'R', 'Java'],
				width: '400px'
			}).component();
			let envVariables = view.modelBuilder.inputBox().withProperties({
				value: '',
				width: '400px'
			}).component();
			let parameters = view.modelBuilder.inputBox().withProperties({
				value: '',
				width: '400px'
			}).component();
			let saveContentButton = view.modelBuilder.button().withProperties({
				label: 'Save Content',
				width: '100px'
			}).component();
			saveContentButton.onDidClick(async () => {
				let updatedContent: mssql.ExternalLanguageContent = {
					pathToExtension: extensionFile.value || '',
					extensionFileName: extensionFileName.value || '',
					platform: platformName.value || '',
					parameters: parameters.value || '',
					environmentVariables: envVariables.value || '',
					languageType: ''
				};

				let current = language.contents.find(x => x.platform === updatedContent.platform);
				if (current) {
					current.environmentVariables = updatedContent.environmentVariables;
					current.pathToExtension = updatedContent.pathToExtension;
					current.parameters = updatedContent.parameters;
				} else {
					language.contents.push(updatedContent);
				}

			});
			let table = new ExternalLanguageContentsTable(view.modelBuilder, this._dialog.model, language);
			table.onEdit((content) => {
				extensionFile.value = content.pathToExtension;
				extensionFileName.value = content.extensionFileName;
				platformName.value = content.platform;
				envVariables.value = content.environmentVariables;
				parameters.value = content.parameters;
				languageType.value = content.languageType;
			});
			table.loadData();
			this.saveButton = view.modelBuilder.button().withProperties({
				label: localize('managePackages.installButtonText', "Save"),
				width: '200px'
			}).component();
			this.saveButton.onDidClick(async () => {
				await this._dialog.model.saveLanguage(language);
			});

			let editFormModel = view.modelBuilder.formContainer()
				.withFormItems([{
					components: [{
						component: extensionFile,
						actions: [
							fileBrowser
						],
						title: ''
					}],
					title: 'Extension File'
				}, {
					component: extensionFileName,
					title: 'Extension File Name'
				}, {
					component: platformName,
					title: 'Platform'
				}, {
					components: [{
						component: languageType,
						actions: [
							fileBrowser2
						],
						title: ''
					}],
					title: 'Language Runtime'
				}, {
					component: envVariables,
					title: 'Env Variables'
				}, {
					component: parameters,
					title: 'Parameters'
				}, {
					component: saveContentButton,
					title: ''
				}]).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.languageName,
					title: 'Language Name'
				}, {
					component: table.component,
					title: 'Contents'
				}, {
					component: editFormModel,
					title: ''
				}, {
					component: this.saveButton,
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
		try {
			if (this.saveButton) {
				await this.saveButton.updateProperties({ enabled: false });
			}
		} finally {
		}
	}

	/*
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
				installPromise = this.dialog.model.installPackages([{ name: packageName, version: packageVersion }]);
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
	*/
}
