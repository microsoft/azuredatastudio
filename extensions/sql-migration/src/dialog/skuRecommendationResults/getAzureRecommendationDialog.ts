/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, PerformanceDataSourceOptions, MigrationTargetType } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';


export class GetAzureRecommendationDialog {
	private static readonly StartButtonText: string = constants.AZURE_RECOMMENDATION_START;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _collectDataContainer!: azdata.FlexContainer;
	private _openExistingContainer!: azdata.FlexContainer;


	constructor(public skuRecommendationPage: SKURecommendationPage, public migrationStateModel: MigrationStateModel) {
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
				'margin': '4px 0 8px',
			}
		}).component();

		const collectDataButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.AZURE_RECOMMENDATION_COLLECT_DATA,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '0'
				},
				checked: true,
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
			}
		}).component();

		const folderNameInput = _view.modelBuilder.inputBox().withProps({
			// TO-DO: now that there are two input boxes, one for the start data collection workflow and one for the import existing data workflow,
			// this needs to be updated so that the Start button in this dialog is greyed out only when *neither* of them has a value, but un-greyed
			// when *either* one has a value
			required: false,
			placeHolder: constants.FOLDER_NAME,
			// validationErrorMessage: "invalid location??",
			width: '300px'
		})
			// .withValidation(c => {
			// 	return true;
			// })
			.component();
		this._disposables.push(folderNameInput.onTextChanged(async (value) => {
			this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
			console.log('this.migrationStateModel._skuRecommendationPerformanceLocation', this.migrationStateModel._skuRecommendationPerformanceLocation);
		}));

		const browseButton = _view.modelBuilder.button().withProps({
			label: constants.BROWSE,
			width: 100,
			CSSStyles: {
				'margin': '0'
			}
		}).component();
		this._disposables.push(browseButton.onDidClick(async (e) => {
			console.log('on click BROWSE');

			let folder = await this.handleBrowse();
			folderNameInput.value = folder;			// update value of textbox, which in turn will update this.migrationStateModel._skuRecommendationPerformanceLocation via onTextChanged()
		}));

		selectFolderContainer.addItems([
			folderNameInput,
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
				'display': 'inline',
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
			}
		}).component();

		const folderNameInput = _view.modelBuilder.inputBox().withProps({
			// TO-DO: now that there are two input boxes, one for the start data collection workflow and one for the import existing data workflow,
			// this needs to be updated so that the Start button in this dialog is greyed out only when *neither* of them has a value, but un-greyed
			// when *either* one has a value
			required: false,
			placeHolder: constants.FOLDER_NAME,
			// validationErrorMessage: "invalid location??",
			width: '300px'
		})
			// .withValidation(c => {
			// 	return true;
			// })
			.component();
		this._disposables.push(folderNameInput.onTextChanged(async (value) => {
			this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
			console.log('this.migrationStateModel._skuRecommendationPerformanceLocation', this.migrationStateModel._skuRecommendationPerformanceLocation);
		}));

		// TO-DO: for some reason the open button for the import workflow renders a few pixels lower than the open button for the start data collection workflow
		const openButton = _view.modelBuilder.button().withProps({
			label: constants.OPEN, // TODO: rename as import?
			width: 100,
			CSSStyles: {
				'margin': '12px 0',
			}
		}).component();
		this._disposables.push(openButton.onDidClick(async (e) => {
			console.log('on click OPEN/IMPORT');

			let folder = await this.handleBrowse();
			folderNameInput.value = folder;			// update value of textbox, which in turn will update this.migrationStateModel._skuRecommendationPerformanceLocation via onTextChanged()
		}));

		selectFolderContainer.addItems([
			folderNameInput,
			openButton,
		]);
		container.addItems([
			instructions,
			selectFolderContainer,
		]);
		return container;
	}

	private async switchDataSourceContainerFields(containerType: PerformanceDataSourceOptions): Promise<void> {
		await this._collectDataContainer.updateCssStyles({ 'display': (containerType === PerformanceDataSourceOptions.CollectData) ? 'inline' : 'none' });
		await this._openExistingContainer.updateCssStyles({ 'display': (containerType === PerformanceDataSourceOptions.OpenExisting) ? 'inline' : 'none' });

		this.migrationStateModel._skuRecommendationPerformanceDataSource = containerType;

		// TODO: update the 'Start' button text?
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(constants.GET_AZURE_RECOMMENDATION, 'GetAzureRecommendationsDialog', 'narrow');

			this.dialog.okButton.label = GetAzureRecommendationDialog.StartButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

			this.dialog.cancelButton.onClick(() => this._isOpen = false);

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);
		}
	}

	protected async execute() {
		this._isOpen = false;
		console.log('Start button');

		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData: {
				// start data collection entry point
				// TO-DO: expose the rest of these in the UI
				const perfQueryIntervalInSec = 3;
				const staticQueryIntervalInSec = 30;
				const numberOfIterations = 5;

				await this.migrationStateModel.startPerfDataCollection(
					this.migrationStateModel._skuRecommendationPerformanceLocation,
					perfQueryIntervalInSec,
					staticQueryIntervalInSec,
					numberOfIterations
				);
				break;
			}
			case PerformanceDataSourceOptions.OpenExisting: {
				// get SKU recommendation entry point
				// TO-DO: expose the rest of these in the UI
				const perfQueryIntervalInSec = 30;
				const targetPlatforms = [MigrationTargetType.SQLDB, MigrationTargetType.SQLMI, MigrationTargetType.SQLVM];
				const targetPercentile = 95;
				const scalingFactor = 100;
				const startTime = '1900-01-01 00:00:00';
				const endTime = '2200-01-01 00:00:00';

				await this.migrationStateModel.getSkuRecommendations(
					this.migrationStateModel._skuRecommendationPerformanceLocation,
					perfQueryIntervalInSec,
					targetPlatforms,
					targetPercentile,
					scalingFactor,
					startTime,
					endTime,
					this.migrationStateModel._databaseAssessment);

				console.log('results - this.migrationStateModel._skuRecommendationResults:');
				console.log(this.migrationStateModel._skuRecommendationResults);
				break;
			}
		}

		await this.skuRecommendationPage.refreshCardText();
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	// TO-DO: add validation
	private async handleBrowse(): Promise<string> {
		let path = '';

		let options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(utils.getUserHome()!),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
		};

		let fileUris = await vscode.window.showOpenDialog(options);
		if (fileUris && fileUris?.length > 0 && fileUris[0]) {
			path = fileUris[0].fsPath;
		}

		return path;
	}
}
