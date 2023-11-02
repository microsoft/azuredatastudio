/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import * as constants from '../../constants/strings';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { MigrationStateModel, PerformanceDataSourceOptions } from '../../models/stateMachine';
import { SKURecommendationPage } from '../../wizard/skuRecommendation/skuRecommendationPage';
import { getSourceConnectionProfile } from '../../api/sqlUtils';
import { EOL } from 'os';
import { EventEmitter } from 'stream';


/*---------------------------------------------------------------------------------------------
* For selecting the path which contains the data files.
* This file contains the code for import performance data dialog.
-----------------------------------------------------------------------------------------------*/
export class ImportPerformanceDataDialog {
	private dialog!: azdata.window.Dialog;
	private _importButton!: azdata.ButtonComponent;

	private _disposables: vscode.Disposable[] = [];

	private _creationEvent: EventEmitter = new EventEmitter;
	private _isOpen: boolean = false;

	private _performanceDataSource!: PerformanceDataSourceOptions;
	private _openExistingContainer!: azdata.FlexContainer;
	private _openExistingFolderInput!: azdata.InputBoxComponent;

	constructor(public skuRecommendationPage: SKURecommendationPage, public wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) {
		this._performanceDataSource = PerformanceDataSourceOptions.OpenExisting;
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.createContainer(view);

					this._disposables.push(
						view.onClosed(e =>
							this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					await view.initializeModel(flex);

					this._creationEvent.once('done', async () => {
						azdata.window.closeDialog(this.dialog);
						resolve();
					});

				}
				catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '0px',
				'flex-direction': 'column',
			}
		}).component();
		const headingLabel = _view.modelBuilder.text().withProps({
			value: constants.IMPORT_PERFORMANCE_DATA,
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin-top': '5px',
			}
		}).component();
		const description = _view.modelBuilder.text().withProps({
			value: constants.IMPORT_PERFORMANCE_DATA_DIALOG_DESCRIPTION,
			CSSStyles: {
				...styles.TOOLBAR_CSS,
			}
		}).component();

		this._openExistingContainer = this.createOpenExistingFolderContainer(_view);

		this._importButton = _view.modelBuilder.button().withProps({
			label: constants.IMPORT,
			width: '80px',
			enabled: false,
			CSSStyles: {
				...styles.PERFORMANCE_DATA_DIALOG_CSS,
				'padding': '3px 20px 3px 20px',
				'gap': '10px'
			}
		}).component();

		this._disposables.push(this._importButton.onDidClick(async () => {
			await this.skuRecommendationPage.startCardLoading();
			void this.execute();
			this._creationEvent.emit('done');
		}));

		const cancelButton = _view.modelBuilder.button().withProps({
			label: constants.CANCEL,
			secondary: true,
			width: '80px',
			CSSStyles: {
				...styles.PERFORMANCE_DATA_DIALOG_CSS,
				'padding': '3px 20px 3px 20px',
				'gap': '10px'
			}
		}).component();

		this._disposables.push(cancelButton.onDidClick(e => {
			this._creationEvent.emit('done');
		}));

		const buttonContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'height': '48px',
				'margin-top': '20px',
				'margin-left': '70px',
			}
		}).component();

		buttonContainer.addItem(this._importButton, {
			flex: '0',
		});

		buttonContainer.addItem(cancelButton, {
			flex: '0',
			CSSStyles: {
				'margin-left': '2px',
				'width': '80px'
			}
		});

		container.addItems([
			headingLabel,
			description,
			this._openExistingContainer,
			buttonContainer
		]);
		return container;
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;

			this.dialog = azdata.window.createModelViewDialog(
				'',
				'ImportPerformanceDataDialog',
				350,
				'callout',
				'below',
				false,
				false,
				<azdata.window.IDialogProperties>{
					height: 51,
					width: 0,
					xPos: 0,
					yPos: 0
				}
			);

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;
		}
	}

	private createOpenExistingFolderContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'column',
					'margin-top': '10px'
				}
			})
			.component();

		const instructions = _view.modelBuilder.text().withProps({
			value: constants.IMPORT_PERFORMANCE_DATA_DIALOG_HELPER_MESSAGE,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '600',
			}
		}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'align-items': 'center',
					'marign-right': '30px'
				}
			})
			.component();

		this._openExistingFolderInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: constants.IMPORT_PERFORMANCE_DATA_DIALOG_OPEN_FOLDER,
			readOnly: true,
			height: 24,
			width: 222,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '400',
				'margin': '0px',
			},
		}).component();
		this._disposables.push(
			this._openExistingFolderInput.onTextChanged(async (value) => {
				if (value) {
					this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
					this.dialog!.okButton.enabled = true;
					this._importButton.enabled = true;
				}
			}));

		const openButton = _view.modelBuilder.button()
			.withProps({
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.openFolder,
				CSSStyles: {
					'margin': '0',
					'padding': '0',
				}
			}).component();
		this._disposables.push(
			openButton.onDidClick(
				async (e) => this._openExistingFolderInput.value = await utils.promptUserForFolder()));

		selectFolderContainer.addItems([
			this._openExistingFolderInput,
			openButton]);
		container.addItems([
			instructions,
			selectFolderContainer]);

		return container;
	}

	protected async execute() {
		this._isOpen = false;
		this.migrationStateModel._skuRecommendationPerformanceDataSource = this._performanceDataSource;

		const serverName = (await getSourceConnectionProfile()).serverName;
		const errors: string[] = [];
		try {
			await this.migrationStateModel.getSkuRecommendations();

			const skuRecommendationError = this.migrationStateModel._skuRecommendationResults?.recommendationError;
			if (skuRecommendationError) {
				errors.push(constants.SKU_RECOMMENDATION_ERROR_MESSAGE(skuRecommendationError));
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

		await this.skuRecommendationPage.refreshSkuRecommendationComponents();
	}
}
