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
import { ColumnsSelectionPage } from './columnsSelectionPage';
import { RegisteredModel } from '../../../modelManagement/interfaces';

/**
 * Wizard to register a model
 */
export class PredictWizard extends ModelViewBase {

	public modelSourcePage: ModelSourcePage | undefined;
	//public modelDetailsPage: ModelDetailsPage | undefined;
	public columnsSelectionPage: ColumnsSelectionPage | undefined;
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
		this.modelSourcePage = new ModelSourcePage(this._apiWrapper, this, [ModelSourceType.RegisteredModels, ModelSourceType.Local, ModelSourceType.Azure]);
		//this.modelDetailsPage = new ModelDetailsPage(this._apiWrapper, this);
		this.columnsSelectionPage = new ColumnsSelectionPage(this._apiWrapper, this);
		this.wizardView = new WizardView(this._apiWrapper);

		let wizard = this.wizardView.createWizard(constants.makePredictionTitle,
			[this.modelSourcePage,
			this.columnsSelectionPage]);

		this.mainViewPanel = wizard;
		wizard.doneButton.label = constants.predictModel;
		wizard.generateScriptButton.hidden = true;
		wizard.displayPageTitles = true;
		wizard.registerNavigationValidator(async (pageInfo: azdata.window.WizardPageChangeInfo) => {
			if (pageInfo.newPage === undefined) {
				wizard.cancelButton.enabled = false;
				wizard.backButton.enabled = false;
				await this.predict();
				wizard.cancelButton.enabled = true;
				wizard.backButton.enabled = true;
				if (this._parentView) {
					this._parentView?.refresh();
				}
				return true;

			}
			return true;
		});

		wizard.open();
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

	private async predict(): Promise<boolean> {
		try {

			let modelFilePath: string = '';
			if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
				modelFilePath = this.localModelsComponent.data;
			} else if (this.modelResources && this.azureModelsComponent && this.modelResources.data === ModelSourceType.Azure) {
				modelFilePath = await this.downloadAzureModel(this.azureModelsComponent?.data);
			}
			let registeredModel: RegisteredModel = Object.assign({}, { filePath: modelFilePath },
				this.modelSourcePage?.registeredModelsComponent?.data);

			await this.generatePredictScript(registeredModel, this.columnsSelectionPage?.data);
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
