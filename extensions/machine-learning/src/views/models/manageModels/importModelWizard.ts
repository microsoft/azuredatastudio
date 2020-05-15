/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase, ModelSourceType } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ModelSourcesComponent } from '../modelSourcesComponent';
import { LocalModelsComponent } from '../localModelsComponent';
import { AzureModelsComponent } from '../azureModelsComponent';
import * as constants from '../../../common/constants';
import { WizardView } from '../../wizardView';
import { ModelSourcePage } from '../modelSourcePage';
import { ModelDetailsPage } from '../modelDetailsPage';
import { ModelBrowsePage } from '../modelBrowsePage';
import { ModelImportLocationPage } from './modelImportLocationPage';

/**
 * Wizard to register a model
 */
export class ImportModelWizard extends ModelViewBase {

	public modelSourcePage: ModelSourcePage | undefined;
	public modelBrowsePage: ModelBrowsePage | undefined;
	public modelDetailsPage: ModelDetailsPage | undefined;
	public modelImportTargetPage: ModelImportLocationPage | undefined;
	public wizardView: WizardView | undefined;
	private _parentView: ModelViewBase | undefined;

	constructor(
		apiWrapper: ApiWrapper,
		root: string,
		parent?: ModelViewBase) {
		super(apiWrapper, root);
		this._parentView = parent;
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public async open(): Promise<void> {
		this.modelSourcePage = new ModelSourcePage(this._apiWrapper, this);
		this.modelDetailsPage = new ModelDetailsPage(this._apiWrapper, this);
		this.modelBrowsePage = new ModelBrowsePage(this._apiWrapper, this);
		this.modelImportTargetPage = new ModelImportLocationPage(this._apiWrapper, this);
		this.wizardView = new WizardView(this._apiWrapper);

		let wizard = this.wizardView.createWizard(constants.registerModelTitle, [this.modelImportTargetPage, this.modelSourcePage, this.modelBrowsePage, this.modelDetailsPage]);

		this.mainViewPanel = wizard;
		wizard.doneButton.label = constants.azureRegisterModel;
		wizard.generateScriptButton.hidden = true;
		wizard.displayPageTitles = true;
		wizard.registerNavigationValidator(async (pageInfo: azdata.window.WizardPageChangeInfo) => {
			let validated: boolean = true;
			if (pageInfo.newPage > pageInfo.lastPage) {
				validated = this.wizardView ? await this.wizardView.validate(pageInfo) : false;
			}
			if (validated && pageInfo.newPage === undefined) {
				this.onLoading();
				let result = await this.registerModel();
				this.onLoaded();
				if (this._parentView) {
					this._parentView.importTable = this.importTable;
					await this._parentView.refresh();
				}
				return result;

			}
			return validated;
		});

		await wizard.open();
	}

	private onLoading(): void {
		this.refreshButtons(true);
	}

	private onLoaded(): void {
		this.refreshButtons(false);
	}

	private refreshButtons(loading: boolean): void {
		if (this.wizardView && this.wizardView.wizard) {
			this.wizardView.wizard.cancelButton.enabled = !loading;
			this.wizardView.wizard.backButton.enabled = !loading;
		}
	}

	public get modelResources(): ModelSourcesComponent | undefined {
		return this.modelSourcePage?.modelResources;
	}

	public get localModelsComponent(): LocalModelsComponent | undefined {
		return this.modelBrowsePage?.localModelsComponent;
	}

	public get azureModelsComponent(): AzureModelsComponent | undefined {
		return this.modelBrowsePage?.azureModelsComponent;
	}

	private async registerModel(): Promise<boolean> {
		try {
			if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
				await this.importLocalModel(this.modelsViewData);
			} else {
				await this.importAzureModel(this.modelsViewData);
			}
			this._apiWrapper.showInfoMessage(constants.modelRegisteredSuccessfully);
			await this.storeImportConfigTable();

			return true;
		} catch (error) {
			await this.showErrorMessage(`${constants.modelFailedToRegister} ${constants.getErrorMessage(error)}`);
			return false;
		}
	}

	/**
	 * Refresh the pages
	 */
	public async refresh(): Promise<void> {
		await this.wizardView?.refresh();
	}
}
