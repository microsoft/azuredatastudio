/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, PerformanceDataSourceOptions } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';
import { EOL } from 'os';

export class GetAzureRecommendationDialog {
	private static readonly StartButtonText: string = constants.AZURE_RECOMMENDATION_START;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _performanceDataSource!: PerformanceDataSourceOptions;

	private _collectDataContainer!: azdata.FlexContainer;
	private _collectDataFolderInput!: azdata.InputBoxComponent;

	private _openExistingContainer!: azdata.FlexContainer;
	private _openExistingFolderInput!: azdata.InputBoxComponent;

	constructor(public skuRecommendationPage: SKURecommendationPage, public wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) {
		this._performanceDataSource = PerformanceDataSourceOptions.CollectData;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.createContainer(view);

					this._disposables.push(view.onClosed(e => {
						this._disposables.forEach(
							d => { try { d.dispose(); } catch { } });
					}));

					await view.initializeModel(flex);
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '8px 16px',
				'flex-direction': 'column',
			}
		}).component();
		const description1 = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();
		const description2 = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_DESCRIPTION2,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px',
			}
		}).component();
		const selectDataSourceRadioButtons = this.createDataSourceContainer(_view);
		container.addItems([
			description1,
			description2,
			selectDataSourceRadioButtons,
		]);
		return container;
	}

	private createDataSourceContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const chooseMethodText = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_CHOOSE_METHOD,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-top': '16px',
			}
		}).component();

		const buttonGroup = 'dataSourceContainer';
		const radioButtonContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'width': 'fit-content',
				'margin': '4px 0 16px',
			}
		}).component();

		const collectDataButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.AZURE_RECOMMENDATION_COLLECT_DATA,
				checked: this._performanceDataSource === PerformanceDataSourceOptions.CollectData,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0'
				},
			}).component();
		this._disposables.push(collectDataButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				await this.switchDataSourceContainerFields(PerformanceDataSourceOptions.CollectData);
			}
		}));

		const openExistingButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.AZURE_RECOMMENDATION_OPEN_EXISTING,
				checked: this._performanceDataSource === PerformanceDataSourceOptions.OpenExisting,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0 12px',
				}
			}).component();
		this._disposables.push(openExistingButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				await this.switchDataSourceContainerFields(PerformanceDataSourceOptions.OpenExisting);
			}
		}));

		radioButtonContainer.addItems([
			collectDataButton,
			openExistingButton
		]);

		this._collectDataContainer = this.createCollectDataContainer(_view);
		this._openExistingContainer = this.createOpenExistingContainer(_view);

		const container = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			chooseMethodText,
			radioButtonContainer,
			this._openExistingContainer,
			this._collectDataContainer,
		]).component();

		return container;
	}

	private createCollectDataContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'display': 'inline',
			}
		}).component();

		const instructions = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_COLLECT_DATA_FOLDER,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-bottom': '8px',
			}
		}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'align-items': 'center',
			}
		}).component();

		this._collectDataFolderInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: constants.FOLDER_NAME,
			readOnly: true,
			width: 320,
			CSSStyles: {
				'margin-right': '12px'
			},
		}).component();
		this._disposables.push(this._collectDataFolderInput.onTextChanged(async (value) => {
			if (value) {
				this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
				this.dialog!.okButton.enabled = true;
			}
		}));

		const browseButton = _view.modelBuilder.button().withProps({
			label: constants.BROWSE,
			width: 100,
			CSSStyles: {
				'margin': '0'
			}
		}).component();
		this._disposables.push(browseButton.onDidClick(async (e) => {
			let folder = await utils.promptUserForFolder();
			this._collectDataFolderInput.value = folder;
		}));

		selectFolderContainer.addItems([
			this._collectDataFolderInput,
			browseButton,
		]);

		container.addItems([
			instructions,
			selectFolderContainer,
		]);
		return container;
	}

	private createOpenExistingContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'display': 'none',
			}
		}).component();

		const instructions = _view.modelBuilder.text().withProps({
			value: constants.AZURE_RECOMMENDATION_OPEN_EXISTING_FOLDER,
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-bottom': '8px',
			}
		}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'row',
				'align-items': 'center',
			}
		}).component();

		this._openExistingFolderInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: constants.FOLDER_NAME,
			readOnly: true,
			width: 320,
			CSSStyles: {
				'margin-right': '12px'
			},
		}).component();
		this._disposables.push(this._openExistingFolderInput.onTextChanged(async (value) => {
			if (value) {
				this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
				this.dialog!.okButton.enabled = true;
			}
		}));

		const openButton = _view.modelBuilder.button().withProps({
			label: constants.OPEN,
			width: 100,
			CSSStyles: {
				'margin': '0'
			}
		}).component();
		this._disposables.push(openButton.onDidClick(async (e) => {
			let folder = await utils.promptUserForFolder();
			this._openExistingFolderInput.value = folder;
		}));

		selectFolderContainer.addItems([
			this._openExistingFolderInput,
			openButton,
		]);
		container.addItems([
			instructions,
			selectFolderContainer,
		]);
		return container;
	}

	private async switchDataSourceContainerFields(containerType: PerformanceDataSourceOptions): Promise<void> {
		this._performanceDataSource = containerType;

		let okButtonEnabled = false;
		switch (containerType) {
			case PerformanceDataSourceOptions.CollectData: {
				await this._collectDataContainer.updateCssStyles({ 'display': 'inline' });
				await this._openExistingContainer.updateCssStyles({ 'display': 'none' });

				if (this._collectDataFolderInput.value) {
					okButtonEnabled = true;
				}
				break;
			}
			case PerformanceDataSourceOptions.OpenExisting: {
				await this._collectDataContainer.updateCssStyles({ 'display': 'none' });
				await this._openExistingContainer.updateCssStyles({ 'display': 'inline' });

				if (this._openExistingFolderInput.value) {
					okButtonEnabled = true;
				}
				break;
			}
		}
		this.dialog!.okButton.enabled = okButtonEnabled;
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(constants.GET_AZURE_RECOMMENDATION, 'GetAzureRecommendationsDialog', 'narrow');

			this.dialog.okButton.label = GetAzureRecommendationDialog.StartButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));
			this._disposables.push(this.dialog.cancelButton.onClick(() => this._isOpen = false));

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);

			// if data source was previously selected, default folder value to previously selected
			switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
				case PerformanceDataSourceOptions.CollectData: {
					this._collectDataFolderInput.value = this.migrationStateModel._skuRecommendationPerformanceLocation;
					break;
				}
				case PerformanceDataSourceOptions.OpenExisting: {
					this._openExistingFolderInput.value = this.migrationStateModel._skuRecommendationPerformanceLocation;
					break;
				}
			}

			await this.switchDataSourceContainerFields(this._performanceDataSource);
		}
	}

	protected async execute() {
		this._isOpen = false;

		this.migrationStateModel._skuRecommendationPerformanceDataSource = this._performanceDataSource;
		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData: {
				await this.migrationStateModel.startPerfDataCollection(
					this.migrationStateModel._skuRecommendationPerformanceLocation,
					this.migrationStateModel._performanceDataQueryIntervalInSeconds,
					this.migrationStateModel._staticDataQueryIntervalInSeconds,
					this.migrationStateModel._numberOfPerformanceDataQueryIterations,
					this.skuRecommendationPage
				);
				break;
			}
			case PerformanceDataSourceOptions.OpenExisting: {
				const serverName = (await this.migrationStateModel.getSourceConnectionProfile()).serverName;
				const errors: string[] = [];
				try {
					void vscode.window.showInformationMessage(constants.AZURE_RECOMMENDATION_OPEN_EXISTING_POPUP);

					await this.skuRecommendationPage.startCardLoading();
					await this.migrationStateModel.getSkuRecommendations();

					const skuRecommendationError = this.migrationStateModel._skuRecommendationResults?.recommendationError;
					if (skuRecommendationError) {
						errors.push(`message: ${skuRecommendationError.message}`);
					}
				} catch (e) {
					console.log(e);
					errors.push(constants.SKU_RECOMMENDATION_ASSESSMENT_UNEXPECTED_ERROR(serverName, e));
				} finally {
					if (errors.length > 0) {
						this.wizard.message = {
							text: constants.SKU_RECOMMENDATION_ERROR(serverName),
							description: errors.join(EOL),
							level: azdata.window.MessageLevel.Error
						};
					}
				}
			}
		}

		await this.skuRecommendationPage.refreshSkuRecommendationComponents();
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
