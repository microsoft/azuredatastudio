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
// import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';
// import { EOL } from 'os';
// import { getSourceConnectionProfile } from '../../api/sqlUtils';

export class XEventsAssessmentDialog {
	// private static readonly StartButtonText: string = constants.AZURE_RECOMMENDATION_START;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _performanceDataSource!: PerformanceDataSourceOptions;
	private _collectDataContainer!: azdata.FlexContainer;
	private _collectDataFolderInput!: azdata.InputBoxComponent;
	private _openExistingContainer!: azdata.FlexContainer;
	private _openExistingFolderInput!: azdata.InputBoxComponent;

	constructor(public wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) { }

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
			ariaLabel: constants.AZURE_RECOMMENDATION_CHOOSE_METHOD,
			ariaRole: 'radiogroup',
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
		this._disposables.push(
			collectDataButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					await this.switchDataSourceContainerFields(
						PerformanceDataSourceOptions.CollectData);
				}
			}));

		const openExistingButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.AZURE_RECOMMENDATION_OPEN_EXISTING,
				checked: this._performanceDataSource === PerformanceDataSourceOptions.OpenExisting,
				CSSStyles: { ...styles.BODY_CSS, 'margin': '0 12px' }
			}).component();
		this._disposables.push(
			openExistingButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					await this.switchDataSourceContainerFields(
						PerformanceDataSourceOptions.OpenExisting);
				}
			}));

		radioButtonContainer.addItems([
			collectDataButton,
			openExistingButton]);

		this._collectDataContainer = this.createCollectDataContainer(_view);
		this._openExistingContainer = this.createOpenExistingContainer(_view);

		const container = _view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				chooseMethodText,
				radioButtonContainer,
				this._openExistingContainer,
				this._collectDataContainer])
			.component();

		return container;
	}

	private createCollectDataContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'column', 'display': 'inline' } })
			.component();

		const instructions = _view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_RECOMMENDATION_COLLECT_DATA_FOLDER,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-bottom': '8px' }
			}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'row', 'align-items': 'center' } })
			.component();

		this._collectDataFolderInput = _view.modelBuilder.inputBox()
			.withProps({
				placeHolder: constants.FOLDER_NAME,
				readOnly: true,
				width: 320,
				CSSStyles: { 'margin-right': '12px' },
				ariaLabel: constants.AZURE_RECOMMENDATION_COLLECT_DATA_FOLDER
			}).component();
		this._disposables.push(
			this._collectDataFolderInput.onTextChanged(async (value) => {
				if (value) {
					this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
					this.dialog!.okButton.enabled = true;
				}
			}));

		const browseButton = _view.modelBuilder.button()
			.withProps({
				label: constants.BROWSE,
				width: 100,
				CSSStyles: { 'margin': '0' }
			}).component();
		this._disposables.push(browseButton.onDidClick(async (e) => {
			let folder = await utils.promptUserForFolder();
			this._collectDataFolderInput.value = folder;
		}));

		selectFolderContainer.addItems([
			this._collectDataFolderInput,
			browseButton]);

		container.addItems([
			instructions,
			selectFolderContainer]);
		return container;
	}

	private createOpenExistingContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'column', 'display': 'none', } })
			.component();

		const instructions = _view.modelBuilder.text()
			.withProps({
				value: constants.AZURE_RECOMMENDATION_OPEN_EXISTING_FOLDER,
				CSSStyles: { ...styles.LABEL_CSS, 'margin-bottom': '8px' }
			}).component();

		const selectFolderContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'flex-direction': 'row', 'align-items': 'center' } })
			.component();

		this._openExistingFolderInput = _view.modelBuilder.inputBox().withProps({
			placeHolder: constants.FOLDER_NAME,
			readOnly: true,
			width: 320,
			CSSStyles: { 'margin-right': '12px' },
			ariaLabel: constants.AZURE_RECOMMENDATION_OPEN_EXISTING_FOLDER
		}).component();
		this._disposables.push(
			this._openExistingFolderInput.onTextChanged(async (value) => {
				if (value) {
					this.migrationStateModel._skuRecommendationPerformanceLocation = value.trim();
					this.dialog!.okButton.enabled = true;
				}
			}));

		const openButton = _view.modelBuilder.button()
			.withProps({
				label: constants.OPEN,
				width: 100,
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

	private async switchDataSourceContainerFields(containerType: PerformanceDataSourceOptions): Promise<void> {
		this._performanceDataSource = containerType;

		let okButtonEnabled = false;
		switch (containerType) {
			case PerformanceDataSourceOptions.CollectData:
				await utils.updateControlDisplay(this._collectDataContainer, true);
				await utils.updateControlDisplay(this._openExistingContainer, false);

				if (this._collectDataFolderInput.value) {
					okButtonEnabled = true;
				}
				break;
			case PerformanceDataSourceOptions.OpenExisting:
				await utils.updateControlDisplay(this._collectDataContainer, false);
				await utils.updateControlDisplay(this._openExistingContainer, true);

				if (this._openExistingFolderInput.value) {
					okButtonEnabled = true;
				}
				break;
		}
		this.dialog!.okButton.enabled = okButtonEnabled;
	}

	public async openDialog() {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(
				'Assess extended event traces',
				'XEventsAssessmentDialog',
				'narrow');

			// this.dialog.okButton.label = XEventsAssessmentDialog.StartButtonText;
			this.dialog.okButton.position = 'left';

			this._disposables.push(
				this.dialog.okButton.onClick(
					async () => await this.execute()));

			this.dialog.cancelButton.position = 'left';
			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => this._isOpen = false));

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;

			// if data source was previously selected, default folder value to previously selected
			switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
				case PerformanceDataSourceOptions.CollectData:
					this._collectDataFolderInput.value = this.migrationStateModel._skuRecommendationPerformanceLocation;
					break;
				case PerformanceDataSourceOptions.OpenExisting:
					this._openExistingFolderInput.value = this.migrationStateModel._skuRecommendationPerformanceLocation;
					break;
			}

			await this.switchDataSourceContainerFields(this._performanceDataSource);
		}
	}

	protected async execute() {
		this._isOpen = false;

		this.migrationStateModel._skuRecommendationPerformanceDataSource = this._performanceDataSource;
		switch (this.migrationStateModel._skuRecommendationPerformanceDataSource) {
			case PerformanceDataSourceOptions.CollectData:
				//
				break;
			case PerformanceDataSourceOptions.OpenExisting: {
				//
				break;
			}
		}
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
