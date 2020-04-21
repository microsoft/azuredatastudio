/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { ConfigurePythonPage } from './configurePythonPage';
import { ConfigurePathPage } from './configurePathPage';
import { PickPackagesPage } from './pickPackagesPage';

const localize = nls.loadMessageBundle();

export interface ConfigurePythonModel {
	kernelName: string;
}

export class ConfigurePythonWizard {
	private wizard: azdata.window.Wizard;
	private model: ConfigurePythonModel;

	public async start(kernelName: string, ...args: any[]) {
		this.model = { kernelName: kernelName };

		let pages: Map<number, ConfigurePythonPage> = new Map<number, ConfigurePythonPage>();

		this.wizard = azdata.window.createWizard(localize('configurePython.wizardName', 'Configure Python to run kernel ({0})', kernelName));
		let page0 = azdata.window.createWizardPage(localize('configurePython.page0Name', 'Configure Python Runtime'));
		let page1 = azdata.window.createWizardPage(localize('configurePython.page1Name', 'Install Dependencies'));

		let configurePathPage: ConfigurePathPage;
		page0.registerContent(async (view) => {
			configurePathPage = new ConfigurePathPage(page0, this.model, view);
			pages.set(0, configurePathPage);
			await configurePathPage.start().then(() => {
				configurePathPage.onPageEnter();
			});
		});

		let pickPackagesPage: PickPackagesPage;
		page1.registerContent(async (view) => {
			pickPackagesPage = new PickPackagesPage(page1, this.model, view);
			pages.set(1, pickPackagesPage);
			await pickPackagesPage.start();
		});

		this.wizard.onPageChanged(async info => {
			let newPage = pages.get(info.newPage);
			if (newPage) {
				await newPage.onPageEnter();
			}
		});

		this.wizard.registerNavigationValidator(async (info) => {
			let lastPage = pages.get(info.lastPage);
			let newPage = pages.get(info.newPage);

			// Hit "next" on last page, so handle submit
			let nextOnLastPage = !newPage && lastPage instanceof PickPackagesPage;
			if (nextOnLastPage) {
				let createSuccess = await this.handlePackageInstall();
				if (createSuccess) {
					this.showTaskComplete();
				}
				return createSuccess;
			}

			if (lastPage) {
				let pageValid = await lastPage.onPageLeave();
				if (!pageValid) {
					return false;
				}
			}

			this.clearStatusMessage();
			return true;
		});

		this.wizard.generateScriptButton.hidden = true;

		this.wizard.pages = [page0, page1];

		this.wizard.open();
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public changeDoneButtonLabel(label: string) {
		this.wizard.doneButton.label = label;
	}

	public showErrorMessage(errorMsg: string) {
		this.showStatusMessage(errorMsg, azdata.window.MessageLevel.Error);
	}

	public showInfoMessage(infoMsg: string) {
		this.showStatusMessage(infoMsg, azdata.window.MessageLevel.Information);
	}

	private showStatusMessage(message: string, level: azdata.window.MessageLevel) {
		this.wizard.message = <azdata.window.DialogMessage>{
			text: message,
			level: level
		};
	}

	public clearStatusMessage() {
		this.wizard.message = undefined;
	}

	private async handlePackageInstall(): Promise<boolean> {
		vscode.window.showInformationMessage('Install method not implemented.');
		return false;
	}

	private showTaskComplete() {
		this.wizard.registerOperation({
			connection: undefined,
			displayName: localize('tableFromFile.taskLabel', 'Create External Table'),
			description: undefined,
			isCancelable: false,
			operation: op => {
				op.updateStatus(azdata.TaskStatus.Succeeded);
			}
		});
	}
}
