/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from '../modelViewBase';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ModelSourcesComponent, ModelSourceType } from '../modelSourcesComponent';
import { LocalModelsComponent } from '../localModelsComponent';
import { AzureModelsComponent } from '../azureModelsComponent';
import * as constants from '../../../common/constants';
import { WizardView } from '../../wizardView';
import { ModelSourcePage } from '../modelSourcePage';
import { ModelDetailsPage } from '../modelDetailsPage';

/**
 * Wizard to register a model
 */
export class RegisterModelWizard extends ModelViewBase {

	public modelSourcePage: ModelSourcePage | undefined;
	public modelDetailsPage: ModelDetailsPage | undefined;
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
		this.wizardView = new WizardView(this._apiWrapper);

		let wizard = this.wizardView.createWizard(constants.registerModelTitle, [this.modelSourcePage, this.modelDetailsPage]);

		this.mainViewPanel = wizard;
		wizard.doneButton.label = constants.azureRegisterModel;
		wizard.generateScriptButton.hidden = true;
		wizard.displayPageTitles = true;
		wizard.registerNavigationValidator(async (pageInfo: azdata.window.WizardPageChangeInfo) => {
			let validated = this.wizardView ? await this.wizardView.validate(pageInfo) : false;
			if (validated && pageInfo.newPage === undefined) {
				wizard.cancelButton.enabled = false;
				wizard.backButton.enabled = false;
				let result = await this.registerModel();
				wizard.cancelButton.enabled = true;
				wizard.backButton.enabled = true;
				if (this._parentView) {
					await this._parentView?.refresh();
				}
				return result;

			}
			return validated;
		});

		await wizard.open();
	}

	public get modelResources(): ModelSourcesComponent | undefined {
		return this.modelSourcePage?.modelResources;
	}

	public get localModelsComponent(): LocalModelsComponent | undefined {
		return this.modelSourcePage?.localModelsComponent;
	}

	public get azureModelsComponent(): AzureModelsComponent | undefined {
		return this.modelSourcePage?.azureModelsComponent;
	}

	private async registerModel(): Promise<boolean> {
		try {
			if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
				await this.registerLocalModel(this.localModelsComponent.data, this.modelDetailsPage?.data);
			} else {
				await this.registerAzureModel(this.azureModelsComponent?.data, this.modelDetailsPage?.data);
			}
			this.showInfoMessage(constants.modelRegisteredSuccessfully);
			return true;
		} catch (error) {
			this.showErrorMessage(`${constants.modelFailedToRegister} ${constants.getErrorMessage(error)}`);
			return false;
		}
	}

	private loadPages(): void {
	}

	/**
	 * Refresh the pages
	 */
	public async refresh(): Promise<void> {
		this.loadPages();
		await this.wizardView?.refresh();
	}
}
