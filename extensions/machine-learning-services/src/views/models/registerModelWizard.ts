/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ModelViewBase } from './modelViewBase';
import { ApiWrapper } from '../../common/apiWrapper';
import { ModelSourcesComponent, ModelSourceType } from './modelSourcesComponent';
import { LocalModelsComponent } from './localModelsComponent';
import { AzureModelsComponent } from './azureModelsComponent';
import * as constants from '../../common/constants';
import { WizardView } from '../wizardView';
import { ModelSourcePage } from './modelSourcePage';
import { ModelDetailsPage } from './modelDetailsPage';

/**
 * Wizard to register a model
 */
export class RegisterModelWizard extends ModelViewBase {

	public modelResources: ModelSourcesComponent | undefined;
	public localModelsComponent: LocalModelsComponent | undefined;
	public azureModelsComponent: AzureModelsComponent | undefined;
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
	public open(): void {
		this.modelSourcePage = new ModelSourcePage(this._apiWrapper, this);
		this.modelDetailsPage = new ModelDetailsPage(this._apiWrapper, this);
		this.wizardView = new WizardView(this._apiWrapper);

		let wizard = this.wizardView.createWizard(constants.registerModelWizardTitle, [this.modelSourcePage, this.modelDetailsPage]);

		this.mainViewPanel = wizard;
		wizard.doneButton.label = constants.azureRegisterModel;
		wizard.generateScriptButton.hidden = true;
		wizard.displayPageTitles = true;
		wizard.registerNavigationValidator(async (pageInfo: azdata.window.WizardPageChangeInfo) => {
			if (pageInfo.newPage === undefined) {
				await this.registerModel();
				if (this._parentView) {
					this._parentView?.refresh();
				}
				return true;

			}
			return true;
		});

		wizard.open();
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
		this.modelResources = this.modelSourcePage?.modelResources;
		this.localModelsComponent = this.modelSourcePage?.localModelsComponent;
		this.azureModelsComponent = this.modelSourcePage?.azureModelsComponent;
	}

	/**
	 * Refresh the pages
	 */
	public async refresh(): Promise<void> {
		this.loadPages();
		this.wizardView?.refresh();
	}
}
