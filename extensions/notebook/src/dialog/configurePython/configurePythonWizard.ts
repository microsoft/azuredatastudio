/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { BasePage } from './basePage';
import { ConfigurePathPage } from './configurePathPage';
import { PickPackagesPage } from './pickPackagesPage';
import { JupyterServerInstallation, PythonPkgDetails, PythonInstallSettings } from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { promises as fs } from 'fs';
import { Deferred } from '../../common/promise';
import { PythonPathInfo, PythonPathLookup } from '../pythonPathLookup';
import { ApiWrapper } from '../../common/apiWrapper';

const localize = nls.loadMessageBundle();

export interface ConfigurePythonModel {
	kernelName: string;
	pythonLocation: string;
	useExistingPython: boolean;
	usingCustomPath: boolean;
	pythonPathsPromise: Promise<PythonPathInfo[]>;
	packagesToInstall: PythonPkgDetails[];
}

export class ConfigurePythonWizard {
	private readonly InstallButtonText = localize('configurePython.okButtonText', "Install");
	public readonly InvalidLocationMsg = localize('configurePython.invalidLocationMsg', "The specified install location is invalid.");
	private readonly PythonNotFoundMsg = localize('configurePython.pythonNotFoundMsg', "No python installation was found at the specified location.");

	private wizard: azdata.window.Wizard;
	private model: ConfigurePythonModel;

	private setupComplete: Deferred<void>;
	private pythonPathsPromise: Promise<PythonPathInfo[]>;
	private usingCustomPath: boolean;

	constructor(private apiWrapper: ApiWrapper, private jupyterInstallation: JupyterServerInstallation) {
		this.setupComplete = new Deferred<void>();
		this.pythonPathsPromise = (new PythonPathLookup()).getSuggestions();
		this.usingCustomPath = false;
	}

	public async start(kernelName: string, rejectOnCancel: boolean = false, ...args: any[]): Promise<void> {
		this.model = <ConfigurePythonModel>{
			kernelName: kernelName,
			usingCustomPath: this.usingCustomPath,
			pythonPathsPromise: this.pythonPathsPromise
		};

		let pages: Map<number, BasePage> = new Map<number, BasePage>();

		this.wizard = azdata.window.createWizard(localize('configurePython.wizardName', 'Configure Python to run kernel ({0})', kernelName));
		let page0 = azdata.window.createWizardPage(localize('configurePython.page0Name', 'Configure Python Runtime'));
		let page1 = azdata.window.createWizardPage(localize('configurePython.page1Name', 'Install Dependencies'));

		page0.registerContent(async (view) => {
			let configurePathPage = new ConfigurePathPage(this.apiWrapper, this, page0, this.model, view);
			pages.set(0, configurePathPage);
			await configurePathPage.start().then(() => {
				configurePathPage.onPageEnter();
			});
		});

		page1.registerContent(async (view) => {
			let pickPackagesPage = new PickPackagesPage(this.apiWrapper, this, page1, this.model, view);
			pages.set(1, pickPackagesPage);
			await pickPackagesPage.start();
		});

		this.wizard.doneButton.label = this.InstallButtonText;
		this.wizard.cancelButton.onClick(() => {
			if (rejectOnCancel) {
				this.setupComplete.reject(localize('configurePython.pythonInstallDeclined', "Python installation was declined."));
			} else {
				this.setupComplete.resolve();
			}
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

		return this.setupComplete.promise;
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
		let pythonLocation = this.model.pythonLocation;
		let useExistingPython = this.model.useExistingPython;
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
		let installSettings: PythonInstallSettings = {
			installPath: pythonLocation,
			existingPython: useExistingPython,
			specificPackages: this.model.packagesToInstall
		};
		this.jupyterInstallation.startInstallProcess(false, installSettings)
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
