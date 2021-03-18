/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as loc from '../../localizedConstants';
import { INotebookService, Notebook } from '../../services/notebookService';
import { IToolsService } from '../../services/toolsService';
import { InputComponents, setModelValues } from '../modelViewUtils';
import { ResourceTypeModel } from '../resourceTypeModel';
import { ResourceTypeWizard } from '../resourceTypeWizard';
import { DeploymentType, NotebookWizardDeploymentProvider, NotebookWizardInfo } from '../../interfaces';
import { IPlatformService } from '../../services/platformService';
import { NotebookWizardAutoSummaryPage } from './notebookWizardAutoSummaryPage';
import { NotebookWizardPage } from './notebookWizardPage';
import { isUserCancelledError } from '../../common/utils';

export class NotebookWizardModel extends ResourceTypeModel {
	private _inputComponents: InputComponents = {};

	public get notebookService(): INotebookService {
		return this.wizard.notebookService;
	}

	public get platformService(): IPlatformService {
		return this.wizard.platformService;
	}

	public get toolsService(): IToolsService {
		return this.wizard.toolsService;
	}

	public get wizardInfo(): NotebookWizardInfo {
		return this.notebookProvider.notebookWizard;
	}

	public get inputComponents(): InputComponents {
		return this._inputComponents;
	}

	constructor(public notebookProvider: NotebookWizardDeploymentProvider, wizard: ResourceTypeWizard) {
		super(notebookProvider, wizard);
		if (this.notebookProvider.notebookWizard.codeCellInsertionPosition === undefined) {
			this.notebookProvider.notebookWizard.codeCellInsertionPosition = 0;
		}
		this.wizard.wizardObject.title = this.notebookProvider.notebookWizard.title;
		this.wizard.wizardObject.doneButton.label = this.notebookProvider.notebookWizard.doneAction?.label || loc.deployNotebook;
		this.wizard.wizardObject.generateScriptButton.label = this.notebookProvider.notebookWizard.scriptAction?.label || loc.scriptToNotebook;
	}

	public get deploymentType(): DeploymentType | undefined {
		return this.notebookProvider.notebookWizard.type;
	}

	public initialize(): void {
		this.wizard.setPages(this.getPages());
	}

	/**
	 * Generates the notebook and returns true if generation was done and so the wizard should be closed.
	 **/
	public async onGenerateScript(): Promise<boolean> {
		const lastPage = this.wizard.lastPage! as NotebookWizardPage;
		if (lastPage.validatePage()) {
			let notebook: Notebook | undefined;
			try {
				notebook = await this.prepareNotebookAndEnvironment();
			} catch (e) {
				// If there was a user prompt while preparing the Notebook environment (such as prompting for password) and the user
				// cancelled out of that then we shouldn't display an error since that's a normal case but should still keep the Wizard
				// open so they can make any changes they want and try again without needing to re-enter the information again.
				if (isUserCancelledError(e)) {
					return false;
				}
				throw e;
			}
			if (notebook) { // open the notebook if it was successfully prepared
				await this.openNotebook(notebook);
			}
			return true; // generation done (or cancelled at user request) so close the wizard
		} else {
			return false; // validation failed so do not attempt to generate the notebook and do not close the wizard
		}
	}

	public async onOk(): Promise<void> {
		const notebook = await this.prepareNotebookAndEnvironment();
		const openedNotebook = await this.openNotebook(notebook);
		openedNotebook.runAllCells();
	}

	private async openNotebook(notebook: Notebook) {
		const notebookPath = this.notebookService.getNotebookPath(this.wizardInfo.notebook);
		return await this.notebookService.openNotebookWithContent(notebookPath, JSON.stringify(notebook, undefined, 4));
	}

	private async prepareNotebookAndEnvironment(): Promise<Notebook> {
		await setModelValues(this.inputComponents, this);
		const env: NodeJS.ProcessEnv = process.env;
		this.setEnvironmentVariables(env, (varName) => {
			const isPassword = !!this.inputComponents[varName]?.isPassword;
			return isPassword;
		});
		const notebook: Notebook = await this.notebookService.getNotebook(this.wizardInfo.notebook);
		// generate python code statements for all variables captured by the wizard
		const statements = this.getCodeCellContentForNotebook(
			this.toolsService.toolsForCurrentProvider,
			(varName) => {
				const isPassword = !!this.inputComponents[varName]?.isPassword;
				return !isPassword;
			}
		);
		// insert generated code statements into the notebook.
		notebook.cells.splice(
			this.wizardInfo.codeCellInsertionPosition ?? 0,
			0,
			{
				cell_type: 'code',
				source: statements,
				metadata: {},
				outputs: [],
				execution_count: 0
			}
		);
		return notebook;
	}

	private getPages(): NotebookWizardPage[] {
		const pages: NotebookWizardPage[] = [];
		for (let pageIndex: number = 0; pageIndex < this.wizardInfo.pages.length; pageIndex++) {
			if (this.wizardInfo.pages[pageIndex].isSummaryPage && this.wizardInfo.isSummaryPageAutoGenerated) {
				// If we are auto-generating the summary page
				pages.push(new NotebookWizardAutoSummaryPage(this, pageIndex));
			} else {
				pages.push(new NotebookWizardPage(this, pageIndex));
			}
		}
		return pages;
	}
}
