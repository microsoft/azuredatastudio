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
	public async open(): Promise<void> {
		this.modelSourcePage = new ModelSourcePage(this._apiWrapper, this, [ModelSourceType.RegisteredModels, ModelSourceType.Local, ModelSourceType.Azure]);
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
			let validated = this.wizardView ? await this.wizardView.validate(pageInfo) : false;
			if (validated) {
				if (pageInfo.newPage === undefined) {
					this.onLoading();
					await this.predict();
					this.onLoaded();
					if (this._parentView) {
						this._parentView?.refresh();
					}
				}
				return true;

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
			this.wizardView.wizard.cancelButton.enabled = !loading;
		}
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

	public async getModelFileName(): Promise<string> {
		if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
			return this.localModelsComponent.data;
		} else if (this.modelResources && this.azureModelsComponent && this.modelResources.data === ModelSourceType.Azure) {
			return await this.azureModelsComponent.getDownloadedModel();
		} else if (this.modelSourcePage && this.modelSourcePage.registeredModelsComponent) {
			return await this.modelSourcePage.registeredModelsComponent.getDownloadedModel();
		}
		return '';
	}

	private async predict(): Promise<boolean> {
		try {
			let modelFilePath: string = '';
			let registeredModel: RegisteredModel | undefined = undefined;
			if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
				modelFilePath = this.localModelsComponent.data;
			} else if (this.modelResources && this.azureModelsComponent && this.modelResources.data === ModelSourceType.Azure) {
				modelFilePath = await this.azureModelsComponent.getDownloadedModel();
			} else {
				registeredModel = this.modelSourcePage?.registeredModelsComponent?.data;
			}

			await this.generatePredictScript(registeredModel, modelFilePath, this.columnsSelectionPage?.data);
			return true;
		} catch (error) {
			this.showErrorMessage(`${constants.modelFailedToRegister} ${constants.getErrorMessage(error)}`);
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
