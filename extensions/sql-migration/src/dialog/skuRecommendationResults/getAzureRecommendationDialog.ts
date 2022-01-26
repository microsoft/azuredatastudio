/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel, PerformanceDataSourceOptions } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';


export class GetAzureRecommendationDialog {
	private static readonly StartButtonText: string = constants.AZURE_RECOMMENDATION_START;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _collectDataContainer!: azdata.FlexContainer;
	private _openExistingContainer!: azdata.FlexContainer;


	constructor(public migrationStateModel: MigrationStateModel) {
		console.log('constructor GetAzureRecommendationDialog');
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
				'max-width': '400px',
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
					'margin': '0',
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
			value: constants.AZURE_RECOMMENDATION_SELECT_FOLDER,
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
			required: true,
			placeHolder: constants.FOLDER_NAME,
			// validationErrorMessage: "invalid location??",
			width: '300px'
		})
			// .withValidation(c => {
			// 	return true;
			// })
			.component();
		this._disposables.push(folderNameInput.onTextChanged(async (value) => {
			// TODO: use the _skuRecommendationPerformanceLocation value
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
			// TODO: browse folder on your local drive
			// TODO: maybe look at what OpenFolderAction is doing at src\vs\workbench\browser\actions\workspaceActions.ts
			console.log('on click BROWSE');
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
				'display': 'none',
			}
		}).component();

		const instructions = _view.modelBuilder.text().withProps({
			value: 'insert some helper text', // TODO
			CSSStyles: {
				...styles.LABEL_CSS,
				'margin-bottom': '8px',
			}
		}).component();

		const openButton = _view.modelBuilder.button().withProps({
			label: constants.OPEN, // TODO: rename as import?
			width: 100,
			CSSStyles: {
				'margin': '12px 0',
			}
		}).component();
		this._disposables.push(openButton.onDidClick(async (e) => {
			// TODO: import file
			console.log('on click OPEN/IMPORT');
		}));

		// TODO: parse import file and save as SkuRecommendation object
		// this.migrationStateModel._skuRecommendationResults =

		container.addItems([
			instructions,
			openButton,
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
		// TODO: fix _isOpen logic?
		// if (!this._isOpen) {
		this._isOpen = true;
		this.dialog = azdata.window.createModelViewDialog(constants.GET_AZURE_RECOMMENDATION, 'GetAzureRecommendationsDialog', 'narrow');

		this.dialog.okButton.label = GetAzureRecommendationDialog.StartButtonText;
		this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));

		this.dialog.cancelButton.hidden = true;

		const dialogSetupPromises: Thenable<void>[] = [];
		dialogSetupPromises.push(this.initializeDialog(this.dialog));
		azdata.window.openDialog(this.dialog);
		await Promise.all(dialogSetupPromises);
		// }
	}

	protected async execute() {
		this._isOpen = false;
		// TODO: start perf collection
		console.log('Start button');
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
