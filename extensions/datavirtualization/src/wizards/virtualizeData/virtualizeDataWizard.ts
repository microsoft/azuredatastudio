/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ApiWrapper } from '../../apiWrapper';
import { DataSourceWizardService } from '../../services/contracts';
import { SelectDataSourcePage } from './selectDataSourcePage';
import { ConnectionDetailsPage } from './connectionDetailsPage';
import { SummaryPage } from './summaryPage';
import { ObjectMappingPage } from './objectMappingPage';
import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { sqlFileExtension } from '../../constants';
import { AppContext } from '../../appContext';
import { CreateMasterKeyPage } from './createMasterKeyPage';
import { getErrorMessage } from '../../utils';
import { VDIManager } from './virtualizeDataInputManager';

export class VirtualizeDataWizard {
	private _wizard: azdata.window.Wizard;
	private _wizardPageWrappers: IWizardPageWrapper[];
	private _dataModel: VirtualizeDataModel;
	private _vdiManager: VDIManager;

	constructor(
		private _connection: azdata.connection.ConnectionProfile,
		private _wizardService: DataSourceWizardService,
		private _appContext: AppContext) {
	}

	public async openWizard(): Promise<void> {
		await this.initialize();
		await this._wizard.open();
	}

	private async initialize(): Promise<void> {
		this._wizard = azdata.window.createWizard(localize('getExtDataTitle', 'Virtualize Data'));
		this._wizard.nextButton.enabled = false;

		// TODO: Add placeholder loading page or spinner here
		this._vdiManager = new VDIManager();
		this._dataModel = new VirtualizeDataModel(this._connection, this._wizardService, this._wizard, this._vdiManager);
		await this._dataModel.createSession();

		this._wizardPageWrappers = [
			new SelectDataSourcePage(this),
			new CreateMasterKeyPage(this._dataModel, this._vdiManager, this.appContext),
			new ConnectionDetailsPage(this._dataModel, this._vdiManager, this._appContext),
			new ObjectMappingPage(this._dataModel, this._vdiManager, this._appContext),
			new SummaryPage(this._dataModel, this._vdiManager, this._appContext)
		];

		this._wizardPageWrappers.forEach(w => {
			let page = w.getPage();
			if (page) { page['owner'] = w; }
		});

		this._vdiManager.setInputPages(this._wizardPageWrappers);
		this._vdiManager.setVirtualizeDataModel(this._dataModel);

		this._wizard.pages = this._wizardPageWrappers.map(wrapper => wrapper.getPage());
		this._wizard.displayPageTitles = true;

		this._wizard.cancelButton.onClick(() => this.actionClose());

		this._wizard.doneButton.label = localize('doneButtonLabel', 'Create');
		this._wizard.doneButton.hidden = true;

		this._wizard.generateScriptButton.onClick(async () => await this.actionGenerateScript());
		this._wizard.generateScriptButton.hidden = true;
		this._wizard.generateScriptButton.enabled = false;

		this._wizard.registerNavigationValidator(async (info) => await this.actionValidateInputAndUpdateNextPage(info));

		this._wizard.onPageChanged(info => this.actionChangePage(info));
	}

	private async actionClose(): Promise<void> {
		try {
			let sessionId = this._dataModel.sessionId;
			if (sessionId) {
				await this._wizardService.disposeWizardSession(sessionId);
			}
		} catch (error) {
			this.apiWrapper.showErrorMessage(error.toString());
		}
	}

	private async actionGenerateScript(): Promise<void> {
		try {
			// Disable the button while generating the script to prevent an issue where multiple quick
			// button presses would duplicate the script. (There's no good reason to allow multiple
			// scripts to be generated anyways)
			this._wizard.generateScriptButton.enabled = false;
			let virtualizeDataInput = this._vdiManager.virtualizeDataInput;
			let response = await this._dataModel.generateScript(virtualizeDataInput);
			if (response.isSuccess) {
				let sqlScript: string = response.script;
				let doc = await this.apiWrapper.openTextDocument({ language: sqlFileExtension, content: sqlScript });
				await this.apiWrapper.showDocument(doc);
				await azdata.queryeditor.connect(doc.uri.toString(), this._dataModel.connection.connectionId);

				this._dataModel.showWizardInfo(
					localize('openScriptMsg',
						'The script has opened in a document window. You can view it once the wizard is closed.'));
			} else {
				let eMessage = response.errorMessages.join('\n');
				this._dataModel.showWizardError(eMessage);
			}
		} catch (error) {
			this._dataModel.showWizardError(error.toString());
			// re-enable button if an error occurred since we didn't actually generate a script
			this._wizard.generateScriptButton.enabled = true;
		}
	}

	private actionChangePage(info: azdata.window.WizardPageChangeInfo): void {
		this.toggleLastPageButtons(info.newPage === (this._wizard.pages.length - 1));
	}

	private toggleLastPageButtons(isLastPage: boolean): void {
		this._wizard.doneButton.hidden = !isLastPage;
		this._wizard.generateScriptButton.hidden = !isLastPage;
		this._wizard.generateScriptButton.enabled = isLastPage;
	}

	private async actionValidateInputAndUpdateNextPage(info: azdata.window.WizardPageChangeInfo): Promise<boolean> {
		this._wizard.message = undefined;

		// Skip validation for moving to a previous page
		if (info.newPage < info.lastPage) {
			return true;
		}

		try {
			let currentPageWrapper: IWizardPageWrapper = this.GetWizardPageWrapper(info.lastPage);
			if (!currentPageWrapper || !(await currentPageWrapper.validate())) { return false; }

			if (!info.newPage) { return true; }
			let newPageWrapper: IWizardPageWrapper = this.GetWizardPageWrapper(info.newPage);
			if (!newPageWrapper) { return false; }

			await newPageWrapper.updatePage();
			return true;
		} catch (error) {
			this._dataModel.showWizardError(getErrorMessage(error));
		}

		return false;
	}

	private GetWizardPageWrapper(pageIndex: number): IWizardPageWrapper {
		if (!this._wizard || !this._wizard.pages || this._wizard.pages.length === 0
			|| pageIndex < 0 || pageIndex >= this._wizard.pages.length) { return undefined; }
		let wizardPage = this._wizard.pages[pageIndex];
		return wizardPage && wizardPage['owner'];
	}

	private get apiWrapper(): ApiWrapper {
		return this._appContext.apiWrapper;
	}

	public get appContext(): AppContext {
		return this._appContext;
	}

	public get dataModel(): VirtualizeDataModel {
		return this._dataModel;
	}

	public get vdiManager(): VDIManager {
		return this._vdiManager;
	}

	public get wizard(): azdata.window.Wizard {
		return this._wizard;
	}

	public get wizardPageWrappers(): IWizardPageWrapper[] {
		return this._wizardPageWrappers;
	}
}
