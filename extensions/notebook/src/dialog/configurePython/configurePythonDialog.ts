/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { promises as fs } from 'fs';
import * as utils from '../../common/utils';

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { Deferred } from '../../common/promise';
import { PythonPathLookup, PythonPathInfo } from '../pythonPathLookup';

const localize = nls.loadMessageBundle();

export class ConfigurePythonDialog {
	private dialog: azdata.window.Dialog;

	private readonly DialogTitle = localize('configurePython.dialogName', "Configure Python for Notebooks");
	private readonly InstallButtonText = localize('configurePython.okButtonText', "Install");
	private readonly CancelButtonText = localize('configurePython.cancelButtonText', "Cancel");
	private readonly BrowseButtonText = localize('configurePython.browseButtonText', "Browse");
	private readonly LocationTextBoxTitle = localize('configurePython.locationTextBoxText', "Python Install Location");
	private readonly SelectFileLabel = localize('configurePython.selectFileLabel', "Select");
	private readonly InstallationNote = localize('configurePython.installNote', "This installation will take some time. It is recommended to not close the application until the installation is complete.");
	private readonly InvalidLocationMsg = localize('configurePython.invalidLocationMsg', "The specified install location is invalid.");
	private readonly PythonNotFoundMsg = localize('configurePython.pythonNotFoundMsg', "No python installation was found at the specified location.");

	private pythonLocationDropdown: azdata.DropDownComponent;
	private pythonDropdownLoader: azdata.LoadingComponent;
	private browseButton: azdata.ButtonComponent;
	private newInstallButton: azdata.RadioButtonComponent;
	private existingInstallButton: azdata.RadioButtonComponent;

	private setupComplete: Deferred<void>;
	private pythonPathsPromise: Promise<PythonPathInfo[]>;
	private usingCustomPath: boolean;

	constructor(private jupyterInstallation: JupyterServerInstallation) {
		this.setupComplete = new Deferred<void>();
		this.pythonPathsPromise = (new PythonPathLookup()).getSuggestions();
		this.usingCustomPath = false;
	}

	/**
	 * Opens a dialog to configure python installation for notebooks.
	 * @param rejectOnCancel Specifies whether an error should be thrown after clicking Cancel.
	 * @returns A promise that is resolved when the python installation completes.
	 */
	public showDialog(rejectOnCancel: boolean = false): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(this.DialogTitle);

		this.initializeContent();

		this.dialog.okButton.label = this.InstallButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;
		this.dialog.cancelButton.onClick(() => {
			if (rejectOnCancel) {
				this.setupComplete.reject(localize('configurePython.pythonInstallDeclined', "Python installation was declined."));
			} else {
				this.setupComplete.resolve();
			}
		});

		this.dialog.registerCloseValidator(() => this.handleInstall());

		azdata.window.openDialog(this.dialog);

		return this.setupComplete.promise;
	}

	private initializeContent(): void {
		this.dialog.registerContent(async view => {
			this.pythonLocationDropdown = view.modelBuilder.dropDown()
				.withProperties<azdata.DropDownProperties>({
					value: undefined,
					values: [],
					width: '100%'
				}).component();
			this.pythonDropdownLoader = view.modelBuilder.loadingComponent()
				.withItem(this.pythonLocationDropdown)
				.withProperties<azdata.LoadingComponentProperties>({
					loading: false
				})
				.component();

			this.browseButton = view.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: this.BrowseButtonText,
					width: '70px'
				}).component();
			this.browseButton.onDidClick(() => this.handleBrowse());

			let installationNoteText = view.modelBuilder.text().withProperties({
				value: this.InstallationNote
			}).component();
			let noteWrapper = view.modelBuilder.flexContainer().component();
			noteWrapper.addItem(installationNoteText, {
				flex: '1 1 auto',
				CSSStyles: {
					'margin-top': '60px',
					'padding-left': '15px',
					'padding-right': '15px',
					'border': '1px solid'
				}
			});

			let useExistingPython = JupyterServerInstallation.getExistingPythonSetting();
			this.createInstallRadioButtons(view.modelBuilder, useExistingPython);

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newInstallButton,
					title: localize('configurePython.installationType', "Installation Type")
				}, {
					component: this.existingInstallButton,
					title: ''
				}, {
					component: this.pythonDropdownLoader,
					title: this.LocationTextBoxTitle
				}, {
					component: this.browseButton,
					title: ''
				}, {
					component: noteWrapper,
					title: ''
				}]).component();

			await view.initializeModel(formModel);

			await this.updatePythonPathsDropdown(useExistingPython);
		});
	}

	private async updatePythonPathsDropdown(useExistingPython: boolean): Promise<void> {
		await this.pythonDropdownLoader.updateProperties({ loading: true });
		try {
			let pythonPaths: PythonPathInfo[];
			let dropdownValues: azdata.CategoryValue[];
			if (useExistingPython) {
				pythonPaths = await this.pythonPathsPromise;
				if (pythonPaths && pythonPaths.length > 0) {
					dropdownValues = pythonPaths.map(path => {
						return {
							displayName: `${path.installDir} (Python ${path.version})`,
							name: path.installDir
						};
					});
				} else {
					dropdownValues = [{
						displayName: 'No supported Python versions found.',
						name: ''
					}];
				}
			} else {
				let defaultPath = JupyterServerInstallation.DefaultPythonLocation;
				dropdownValues = [{
					displayName: `${defaultPath} (Default)`,
					name: defaultPath
				}];
			}

			this.usingCustomPath = false;
			await this.pythonLocationDropdown.updateProperties({
				value: dropdownValues[0],
				values: dropdownValues
			});
		} finally {
			await this.pythonDropdownLoader.updateProperties({ loading: false });
		}
	}

	private createInstallRadioButtons(modelBuilder: azdata.ModelBuilder, useExistingPython: boolean): void {
		let buttonGroup = 'installationType';
		this.newInstallButton = modelBuilder.radioButton()
			.withProperties<azdata.RadioButtonProperties>({
				name: buttonGroup,
				label: localize('configurePython.newInstall', "New Python installation"),
				checked: !useExistingPython
			}).component();
		this.newInstallButton.onDidClick(() => {
			this.existingInstallButton.checked = false;
			this.updatePythonPathsDropdown(false)
				.catch(err => {
					this.showErrorMessage(utils.getErrorMessage(err));
				});
		});

		this.existingInstallButton = modelBuilder.radioButton()
			.withProperties<azdata.RadioButtonProperties>({
				name: buttonGroup,
				label: localize('configurePython.existingInstall', "Use existing Python installation"),
				checked: useExistingPython
			}).component();
		this.existingInstallButton.onDidClick(() => {
			this.newInstallButton.checked = false;
			this.updatePythonPathsDropdown(true)
				.catch(err => {
					this.showErrorMessage(utils.getErrorMessage(err));
				});
		});
	}

	private async handleInstall(): Promise<boolean> {
		let pythonLocation = (this.pythonLocationDropdown.value as azdata.CategoryValue).name;
		if (!pythonLocation || pythonLocation.length === 0) {
			this.showErrorMessage(this.InvalidLocationMsg);
			return false;
		}

		let useExistingPython = !!this.existingInstallButton.checked;
		try {
			let isValid = await this.isFileValid(pythonLocation);
			if (!isValid) {
				return false;
			}

			if (useExistingPython) {
				let exePath = JupyterServerInstallation.getPythonExePath(pythonLocation, true);
				let pythonExists = await utils.exists(exePath);
				if (!pythonExists) {
					this.showErrorMessage(this.PythonNotFoundMsg);
					return false;
				}
			}
		} catch (err) {
			this.showErrorMessage(utils.getErrorMessage(err));
			return false;
		}

		// Don't wait on installation, since there's currently no Cancel functionality
		this.jupyterInstallation.startInstallProcess(false, { installPath: pythonLocation, existingPython: useExistingPython })
			.then(() => {
				this.setupComplete.resolve();
			})
			.catch(err => {
				this.setupComplete.reject(utils.getErrorMessage(err));
			});

		return true;
	}

	private async isFileValid(pythonLocation: string): Promise<boolean> {
		let self = this;
		try {
			const stats = await fs.stat(pythonLocation);
			if (stats.isFile()) {
				self.showErrorMessage(self.InvalidLocationMsg);
				return false;
			}
		} catch (err) {
			// Ignore error if folder doesn't exist, since it will be
			// created during installation
			if (err.code !== 'ENOENT') {
				self.showErrorMessage(err.message);
				return false;
			}
		}
		return true;
	}

	private async handleBrowse(): Promise<void> {
		let options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(utils.getUserHome()),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: this.SelectFileLabel
		};

		let fileUris: vscode.Uri[] = await vscode.window.showOpenDialog(options);
		if (fileUris && fileUris[0]) {
			let existingValues = <azdata.CategoryValue[]>this.pythonLocationDropdown.values;
			let filePath = fileUris[0].fsPath;
			let newValue = {
				displayName: `${filePath} (Custom)`,
				name: filePath
			};

			if (this.usingCustomPath) {
				existingValues[0] = newValue;
			} else {
				existingValues.unshift(newValue);
				this.usingCustomPath = true;
			}

			await this.pythonLocationDropdown.updateProperties({
				value: existingValues[0],
				values: existingValues
			});
		}
	}

	private showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}
