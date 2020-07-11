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
import { ColumnsSelectionPage } from './columnsSelectionPage';
import { ImportedModel } from '../../../modelManagement/interfaces';
import { ModelArtifact } from './modelArtifact';
import { ModelBrowsePage } from '../modelBrowsePage';

/**
 * Wizard to register a model
 */
export class PredictWizard extends ModelViewBase {

	public modelSourcePage: ModelSourcePage | undefined;
	public columnsSelectionPage: ColumnsSelectionPage | undefined;
	public modelBrowsePage: ModelBrowsePage | undefined;
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
		this.modelSourceType = ModelSourceType.RegisteredModels;
		this.modelSourcePage = new ModelSourcePage(this._apiWrapper, this, [ModelSourceType.RegisteredModels, ModelSourceType.Local, ModelSourceType.Azure]);
		this.columnsSelectionPage = new ColumnsSelectionPage(this._apiWrapper, this);
		this.modelBrowsePage = new ModelBrowsePage(this._apiWrapper, this, false);
		this.wizardView = new WizardView(this._apiWrapper);

		let wizard = this.wizardView.createWizard(constants.makePredictionTitle,
			[this.modelSourcePage,
			this.modelBrowsePage,
			this.columnsSelectionPage]);

		this.mainViewPanel = wizard;
		wizard.doneButton.label = constants.predictModel;
		wizard.generateScriptButton.hidden = true;
		wizard.displayPageTitles = true;
		wizard.doneButton.onClick(async () => {
			await this.onClose();
		});
		wizard.cancelButton.onClick(async () => {
			await this.onClose();
		});
		wizard.registerNavigationValidator(async (pageInfo: azdata.window.WizardPageChangeInfo) => {
			let validated: boolean = true;
			if (pageInfo.newPage === undefined || pageInfo.newPage > pageInfo.lastPage) {
				validated = this.wizardView ? await this.wizardView.validate(pageInfo) : false;
			}
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

	public async getModelFileName(): Promise<ModelArtifact | undefined> {
		if (this.modelResources && this.localModelsComponent && this.modelResources.data === ModelSourceType.Local) {
			return new ModelArtifact(this.localModelsComponent.data[0], false);
		} else if (this.modelResources && this.azureModelsComponent && this.modelResources.data === ModelSourceType.Azure) {
			return await this.azureModelsComponent.getDownloadedModel();
		} else if (this.modelBrowsePage && this.modelBrowsePage.registeredModelsComponent) {
			return await this.modelBrowsePage.registeredModelsComponent.modelTable?.getDownloadedModel();
		}
		return undefined;
	}

	private async predict(): Promise<boolean> {
		try {
			let modelFilePath: string | undefined;
			let registeredModel: ImportedModel | undefined = undefined;
			if (this.modelResources && this.modelResources.data && this.modelResources.data === ModelSourceType.RegisteredModels
				&& this.modelBrowsePage && this.modelBrowsePage.registeredModelsComponent) {
				const data = this.modelBrowsePage?.registeredModelsComponent?.data;
				registeredModel = data && data.length > 0 ? data[0] : undefined;
			} else {
				const artifact = await this.getModelFileName();
				modelFilePath = artifact?.filePath;
			}

			await this.generatePredictScript(registeredModel, modelFilePath, this.columnsSelectionPage?.data);
			return true;
		} catch (error) {
			this.showErrorMessage(`${constants.modelFailedToRegister} ${constants.getErrorMessage(error)}`);
			return false;
		}
	}

	private async onClose(): Promise<void> {
		const artifact = await this.getModelFileName();
		if (artifact) {
			artifact.close();
		}
		await this.wizardView?.disposePages();
	}

	/**
	 * Refresh the pages
	 */
	public async refresh(): Promise<void> {
		await this.wizardView?.refresh();
	}
}
