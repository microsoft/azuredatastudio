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

const localize = nls.loadMessageBundle();

export interface ConfigurePythonModel {
	kernelName: string;
	pythonLocation: string;
	useExistingPython: boolean;
	pythonPathsPromise: Promise<PythonPathInfo[]>;
	packagesToInstall: PythonPkgDetails[];
	installation: JupyterServerInstallation;
}

export class ConfigurePythonWizard {
	private readonly InstallButtonText = localize('configurePython.okButtonText', "Install");
	public readonly InvalidLocationMsg = localize('configurePython.invalidLocationMsg', "The specified install location is invalid.");
	private readonly PythonNotFoundMsg = localize('configurePython.pythonNotFoundMsg', "No Python installation was found at the specified location.");

	private _wizard: azdata.window.Wizard;
	private model: ConfigurePythonModel;

	private _setupComplete: Deferred<void>;
	private pythonPathsPromise: Promise<PythonPathInfo[]>;

	constructor(private jupyterInstallation: JupyterServerInstallation) {
		this._setupComplete = new Deferred<void>();
		this.pythonPathsPromise = (new PythonPathLookup()).getSuggestions();
	}

	public get wizard(): azdata.window.Wizard {
		return this._wizard;
	}

	public get setupComplete(): Promise<void> {
		return this._setupComplete.promise;
	}

	public async start(kernelName?: string, rejectOnCancel?: boolean, ...args: any[]): Promise<void> {
		this.model = <ConfigurePythonModel>{
			kernelName: kernelName,
			pythonPathsPromise: this.pythonPathsPromise,
			installation: this.jupyterInstallation,
			pythonLocation: JupyterServerInstallation.getPythonPathSetting(),
			useExistingPython: JupyterServerInstallation.getExistingPythonSetting()
		};

		let pages: Map<number, BasePage> = new Map<number, BasePage>();

		let wizardTitle: string;
		if (kernelName) {
			wizardTitle = localize('configurePython.wizardNameWithKernel', "Configure Python to run {0} kernel", kernelName);
		} else {
			wizardTitle = localize('configurePython.wizardNameWithoutKernel', "Configure Python to run kernels");
		}
		this._wizard = azdata.window.createWizard(wizardTitle, 600);
		let page0 = azdata.window.createWizardPage(localize('configurePython.page0Name', "Configure Python Runtime"));
		let page1 = azdata.window.createWizardPage(localize('configurePython.page1Name', "Install Dependencies"));

		page0.registerContent(async (view) => {
			let configurePathPage = new ConfigurePathPage(this, page0, this.model, view);
			pages.set(0, configurePathPage);
			await configurePathPage.initialize();
			await configurePathPage.onPageEnter();
		});

		page1.registerContent(async (view) => {
			let pickPackagesPage = new PickPackagesPage(this, page1, this.model, view);
			pages.set(1, pickPackagesPage);
			await pickPackagesPage.initialize();
		});

		this._wizard.doneButton.label = this.InstallButtonText;
		this._wizard.cancelButton.onClick(() => {
			if (rejectOnCancel) {
				this._setupComplete.reject(localize('configurePython.pythonInstallDeclined', "Python installation was declined."));
			} else {
				this._setupComplete.resolve();
			}
		});

		this._wizard.onPageChanged(async info => {
			let newPage = pages.get(info.newPage);
			if (newPage) {
				await newPage.onPageEnter();
			}
		});

		this._wizard.registerNavigationValidator(async (info) => {
			let lastPage = pages.get(info.lastPage);
			let newPage = pages.get(info.newPage);

			// Hit "next" on last page, so handle submit
			let nextOnLastPage = !newPage && lastPage instanceof PickPackagesPage;
			if (nextOnLastPage) {
				return await this.handlePackageInstall();
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

		this._wizard.generateScriptButton.hidden = true;
		this._wizard.pages = [page0, page1];
		this._wizard.open();
	}

	public async close(): Promise<void> {
		await this._wizard.close();
	}

	public showErrorMessage(errorMsg: string) {
		this._wizard.message = <azdata.window.DialogMessage>{
			text: errorMsg,
			level: azdata.window.MessageLevel.Error
		};
	}

	public clearStatusMessage() {
		this._wizard.message = undefined;
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
				this._setupComplete.resolve();
			})
			.catch(err => {
				this._setupComplete.reject(utils.getErrorMessage(err));
			});

		return true;
	}

	private async isFileValid(pythonLocation: string): Promise<boolean> {
		try {
			const stats = await fs.stat(pythonLocation);
			if (stats.isFile()) {
				this.showErrorMessage(this.InvalidLocationMsg);
				return false;
			}
		} catch (err) {
			// Ignore error if folder doesn't exist, since it will be
			// created during installation
			if (err.code !== 'ENOENT') {
				this.showErrorMessage(err.message);
				return false;
			}
		}
		return true;
	}
}
