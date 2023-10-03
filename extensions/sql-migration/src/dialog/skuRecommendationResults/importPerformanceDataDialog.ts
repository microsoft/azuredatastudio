/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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

export class ImportPerformanceDataDialog {
	private dialog!: azdata.window.Dialog;
	private _okButton!: azdata.ButtonComponent;

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
				'margin': '8px 16px',
				'flex-direction': 'column',
			}
		}).component();
		// const description1 = _view.modelBuilder.text().withProps({
		// 	value: "Import Performance Data",
		// 	CSSStyles: {
		// 		...styles.PAGE_TITLE_CSS,
		// 	}
		// }).component();
		const description = _view.modelBuilder.text().withProps({
			value: "Import this data file from an existing folder, if you have already collected it using Data Migration Assistant.",
			CSSStyles: {
				...styles.TOOLBAR_CSS,
				'margin-top': '8px',
			}
		}).component();

		this._openExistingContainer = this.createOpenExistingFolderContainer(_view);

		this._okButton = _view.modelBuilder.button().withProps({
			label: constants.OK,
			width: '80px',
			enabled: false
		}).component();

		this._disposables.push(this._okButton.onDidClick(async () => {
			await this.execute();
			this._creationEvent.emit('done');
		}));

		const cancelButton = _view.modelBuilder.button().withProps({
			label: constants.CANCEL,
			width: '80px'
		}).component();

		this._disposables.push(cancelButton.onDidClick(e => {
			this._creationEvent.emit('done');
		}));

		const buttonContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin-top': '5px'
			}
		}).component();

		buttonContainer.addItem(this._okButton, {
			flex: '0',
			CSSStyles: {
				'width': '80px'
			}
		});

		buttonContainer.addItem(cancelButton, {
			flex: '0',
			CSSStyles: {
				'margin-left': '8px',
				'width': '80px'
			}
		});


		container.addItems([
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
				'Import performance data',
				'ImportPerformanceDataDialog',
				362,
				'callout',
				'below',
				false,
				true,
				<azdata.window.IDialogProperties>{
					height: 10,
					width: 10,
					xPos: 20,
					yPos: 20
				}
			);

			this.dialog.okButton.label = "Import";
			this.dialog.okButton.position = 'right';

			this._disposables.push(
				this.dialog.okButton.onClick(
					async () => await this.execute()));

			this.dialog.cancelButton.position = 'right';
			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => this._isOpen = false));

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;
		}
	}

	private createOpenExistingFolderContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'column' } })
			.component();

		const instructions = _view.modelBuilder.text().withProps({
			value: "Select a folder on your local drive",
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '600',
			}
		}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'row', 'align-items': 'center' } })
			.component();

		this._openExistingFolderInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: "Select a file",
			readOnly: true,
			height: 24,
			width: 222,
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '400',
			},
			// ariaLabel: constants.AZURE_RECOMMENDATION_OPEN_EXISTING_FOLDER
		}).component();
		this._disposables.push(
			this._openExistingFolderInput.onTextChanged(async (value) => {
				if (value) {
					this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
					this.dialog!.okButton.enabled = true;
					this._okButton.enabled = true;
				}
			}));

		const openButton = _view.modelBuilder.button()
			.withProps({
				iconHeight: 24,
				iconWidth: 24,
				iconPath: IconPathHelper.expandButtonOpen,
				CSSStyles: { 'margin': '0' }
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
			// await this.skuRecommendationPage.startCardLoading();
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

		await this.skuRecommendationPage.refreshSkuRecommendationComponents();
	}
}
