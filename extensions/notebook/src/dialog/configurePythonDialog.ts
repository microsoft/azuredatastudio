/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as fs from 'fs';
import * as utils from '../common/utils';

import JupyterServerInstallation from '../jupyter/jupyterServerInstallation';
import { ApiWrapper } from '../common/apiWrapper';
import { Deferred } from '../common/promise';

const localize = nls.loadMessageBundle();

export class ConfigurePythonDialog {
	private dialog: azdata.window.Dialog;

	private readonly DialogTitle = localize('configurePython.dialogName', 'Configure Python for Notebooks');
	private readonly OkButtonText = localize('configurePython.okButtonText', 'Install');
	private readonly CancelButtonText = localize('configurePython.cancelButtonText', 'Cancel');
	private readonly BrowseButtonText = localize('configurePython.browseButtonText', 'Change location');
	private readonly LocationTextBoxTitle = localize('configurePython.locationTextBoxText', 'Notebook dependencies will be installed in this location');
	private readonly SelectFileLabel = localize('configurePython.selectFileLabel', 'Select');
	private readonly InstallationNote = localize('configurePython.installNote', 'This installation will take some time. It is recommended to not close the application until the installation is complete.');
	private readonly InvalidLocationMsg = localize('configurePython.invalidLocationMsg', 'The specified install location is invalid.');

	private pythonLocationTextBox: azdata.InputBoxComponent;
	private browseButton: azdata.ButtonComponent;

	private _setupComplete: Deferred<void>;

	constructor(private apiWrapper: ApiWrapper, private outputChannel: vscode.OutputChannel, private jupyterInstallation: JupyterServerInstallation) {
		this._setupComplete = new Deferred<void>();
	}

	/**
	 * Opens a dialog to configure python installation for notebooks.
	 * @param rejectOnCancel Specifies whether an error should be thrown after clicking Cancel.
	 * @returns A promise that is resolved when the python installation completes.
	 */
	public showDialog(rejectOnCancel: boolean = false): Promise<void> {
		this.dialog = azdata.window.createModelViewDialog(this.DialogTitle);

		this.initializeContent();

		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;
		this.dialog.cancelButton.onClick(() => {
			if (rejectOnCancel) {
				this._setupComplete.reject(localize('pythonInstallDeclined', 'Python installation was declined.'));
			} else {
				this._setupComplete.resolve();
			}
		});

		this.dialog.registerCloseValidator(() => this.handleInstall());

		azdata.window.openDialog(this.dialog);

		return this._setupComplete.promise;
	}

	private initializeContent(): void {
		this.dialog.registerContent(async view => {
			this.pythonLocationTextBox = view.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: JupyterServerInstallation.getPythonInstallPath(this.apiWrapper),
					width: '100%'
				}).component();

			this.browseButton = view.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: this.BrowseButtonText,
					width: '100px'
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

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.pythonLocationTextBox,
					title: this.LocationTextBoxTitle
				}, {
					component: this.browseButton,
					title: undefined
				}, {
					component: noteWrapper,
					title: undefined
				}]).component();


			await view.initializeModel(formModel);
		});
	}

	private async handleInstall(): Promise<boolean> {
		let pythonLocation = this.pythonLocationTextBox.value;
		if (!pythonLocation || pythonLocation.length === 0) {
			this.showErrorMessage(this.InvalidLocationMsg);
			return false;
		}

		try {
			let isValid = await this.isFileValid(pythonLocation);
			if (!isValid) {
				return false;
			}
		} catch (err) {
			this.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
			return false;
		}

		// Don't wait on installation, since there's currently no Cancel functionality
		this.jupyterInstallation.startInstallProcess(pythonLocation)
			.then(() => {
				this._setupComplete.resolve();
			})
			.catch(err => {
				this._setupComplete.reject(utils.getErrorMessage(err));
			});
		return true;
	}

	private isFileValid(pythonLocation: string): Promise<boolean> {
		let self = this;
		return new Promise<boolean>(function (resolve) {
			fs.stat(pythonLocation, function (err, stats) {
				if (err) {
					// Ignore error if folder doesn't exist, since it will be
					// created during installation
					if (err.code !== 'ENOENT') {
						self.showErrorMessage(err.message);
						resolve(false);
					}
				}
				else {
					if (stats.isFile()) {
						self.showErrorMessage(self.InvalidLocationMsg);
						resolve(false);
					}
				}
				resolve(true);
			});
		});
	}

	private async handleBrowse(): Promise<void> {
		let options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(utils.getUserHome()),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: this.SelectFileLabel
		};

		let fileUris: vscode.Uri[] = await this.apiWrapper.showOpenDialog(options);
		if (fileUris && fileUris[0]) {
			this.pythonLocationTextBox.value = fileUris[0].fsPath;
		}
	}

	private showErrorMessage(message: string): void {
		this.dialog.message = {
			text: message,
			level: azdata.window.MessageLevel.Error
		};
	}
}