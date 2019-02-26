/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as fs from 'fs';
import * as utils from '../common/utils';

import { AppContext } from '../common/appContext';
import JupyterServerInstallation from '../jupyter/jupyterServerInstallation';

const localize = nls.loadMessageBundle();

export class ConfigurePythonDialog {
	private dialog: sqlops.window.modelviewdialog.Dialog;

	private readonly DialogTitle = localize('configurePython.dialogName', 'Configure Python for Notebooks');
	private readonly OkButtonText = localize('configurePython.okButtonText', 'Install');
	private readonly CancelButtonText = localize('configurePython.cancelButtonText', 'Cancel');
	private readonly BrowseButtonText = localize('configurePython.browseButtonText', 'Change location');
	private readonly LocationTextBoxTitle = localize('configurePython.locationTextBoxText', 'Notebook dependencies will be installed in this location');
	private readonly SelectFileLabel = localize('configurePython.selectFileLabel', 'Select');
	private readonly InstallationNote = localize('configurePython.installNote', 'This installation will take some time. It is recommended to not close the application until the installation is complete.');
	private readonly InvalidLocationMsg = localize('configurePython.invalidLocationMsg', 'The specified install location is invalid.');

	private pythonLocationTextBox: sqlops.InputBoxComponent;
	private browseButton: sqlops.ButtonComponent;

	constructor(private appContext: AppContext, private outputChannel: vscode.OutputChannel, private jupyterInstallation: JupyterServerInstallation) {
	}

	public async showDialog() {
		this.dialog = sqlops.window.modelviewdialog.createDialog(this.DialogTitle);

		this.initializeContent();

		this.dialog.okButton.label = this.OkButtonText;
		this.dialog.cancelButton.label = this.CancelButtonText;

		this.dialog.registerCloseValidator(() => this.handleInstall());

		sqlops.window.modelviewdialog.openDialog(this.dialog);
	}

	private initializeContent() {
		this.dialog.registerContent(async view => {
			this.pythonLocationTextBox = view.modelBuilder.inputBox()
				.withProperties<sqlops.InputBoxProperties>({
					value: JupyterServerInstallation.getPythonInstallPath(this.appContext.apiWrapper),
					width: '100%'
				}).component();

			this.browseButton = view.modelBuilder.button()
				.withProperties<sqlops.ButtonProperties>({
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
			this.appContext.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
			return false;
		}

		// Don't wait on installation, since there's currently no Cancel functionality
		this.jupyterInstallation.startInstallProcess(pythonLocation).catch(err => {
			this.appContext.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
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

		let fileUris: vscode.Uri[] = await this.appContext.apiWrapper.showOpenDialog(options);
		if (fileUris && fileUris[0]) {
			this.pythonLocationTextBox.value = fileUris[0].fsPath;
		}
	}

	private showInfoMessage(message: string) {
		this.dialog.message = {
			text: message,
			level: sqlops.window.modelviewdialog.MessageLevel.Information
		};
	}

	private showErrorMessage(message: string) {
		this.dialog.message = {
			text: message,
			level: sqlops.window.modelviewdialog.MessageLevel.Error
		};
	}
}