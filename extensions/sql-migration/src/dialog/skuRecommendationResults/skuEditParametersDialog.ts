/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { selectDropDownIndex } from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';

export const TARGET_PERCENTILE_VALUES = [99, 97, 95, 90, 75, 50];

export class SkuEditParametersDialog {
	private static readonly UpdateButtonText: string = constants.UPDATE;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _scaleFactorInput!: azdata.InputBoxComponent;
	private _targetPercentileDropdown!: azdata.DropDownComponent;
	private _enablePreviewValue!: boolean;

	constructor(
		public skuRecommendationPage: SKURecommendationPage,
		public migrationStateModel: MigrationStateModel) {

		this._enablePreviewValue = true;
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
					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'margin': '8px 16px', 'flex-direction': 'column' } })
			.component();

		const description = _view.modelBuilder.text()
			.withProps({
				value: constants.EDIT_PARAMETERS_TEXT,
				CSSStyles: { ...styles.BODY_CSS }
			})
			.component();

		const WIZARD_INPUT_COMPONENT_WIDTH = '300px';
		const scaleFactorLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.SCALE_FACTOR,
				description: constants.SCALE_FACTOR_TOOLTIP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		this._scaleFactorInput = _view.modelBuilder.inputBox()
			.withProps({
				required: true,
				validationErrorMessage: constants.INVALID_SCALE_FACTOR,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				CSSStyles: { 'margin-top': '-1em', 'margin-bottom': '8px' },
			}).withValidation(c => {
				if (Number(c.value) && Number(c.value) > 0) {
					return true;
				}
				return false;
			}).component();

		const targetPercentileLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.PERCENTAGE_UTILIZATION,
				description: constants.PERCENTAGE_UTILIZATION_TOOLTIP,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS }
			}).component();
		const createPercentageValues = () => {
			const values: azdata.CategoryValue[] = [];
			TARGET_PERCENTILE_VALUES.forEach(n => {
				const val = n.toString();
				values.push({
					displayName: constants.PERCENTILE(val),
					name: val,
				});
			});
			return values;
		};
		this._targetPercentileDropdown = _view.modelBuilder.dropDown()
			.withProps({
				values: createPercentageValues(),
				ariaLabel: constants.PERCENTAGE_UTILIZATION,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				editable: false,
				required: true,
				fireOnTextChange: true,
				CSSStyles: {
					'margin-top': '-1em',
					'margin-bottom': '8px',
				},
			}).component();

		const enablePreviewLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.ENABLE_PREVIEW_SKU,
				width: WIZARD_INPUT_COMPONENT_WIDTH,
				requiredIndicator: true,
				CSSStyles: { ...styles.LABEL_CSS, }
			}).component();
		const buttonGroup = 'enablePreviewSKUs';
		const enablePreviewRadioButtonContainer = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'width': 'fit-content',
					'margin-top': '-1em',
					'margin-bottom': '8px',
				}
			}).component();
		const enablePreviewButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.YES,
				checked: this._enablePreviewValue,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': 'fit-content',
					'margin': '0'
				},
			}).component();
		this._disposables.push(
			enablePreviewButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this._enablePreviewValue = true;
				}
			}));
		const disablePreviewButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.NO,
				checked: !this._enablePreviewValue,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': 'fit-content',
					'margin': '0 12px',
				}
			}).component();
		this._disposables.push(
			disablePreviewButton.onDidChangeCheckedState(checked => {
				if (checked) {
					this._enablePreviewValue = false;
				}
			}));
		enablePreviewRadioButtonContainer.addItems([
			enablePreviewButton,
			disablePreviewButton]);

		const enablePreviewInfoBox = _view.modelBuilder.infoBox()
			.withProps({
				text: constants.ENABLE_PREVIEW_SKU_INFO,
				style: 'information',
				CSSStyles: { ...styles.BODY_CSS, }
			}).component();

		container.addItems([
			description,
			scaleFactorLabel,
			this._scaleFactorInput,
			targetPercentileLabel,
			this._targetPercentileDropdown,
			enablePreviewLabel,
			enablePreviewRadioButtonContainer,
			enablePreviewInfoBox,
		]);
		return container;
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(
				constants.EDIT_RECOMMENDATION_PARAMETERS,
				'SkuEditParametersDialog',
				'narrow');

			this.dialog.okButton.label = SkuEditParametersDialog.UpdateButtonText;
			this._disposables.push(
				this.dialog.okButton.onClick(
					async () => await this.execute()));

			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => this._isOpen = false));

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));
			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);

			this._scaleFactorInput.value = this.migrationStateModel._skuScalingFactor.toString();
			this._enablePreviewValue = this.migrationStateModel._skuEnablePreview;
			(<azdata.CategoryValue[]>this._targetPercentileDropdown.values)?.forEach((percentile, index) => {
				if ((<azdata.CategoryValue>percentile).name.toLowerCase() === this.migrationStateModel._skuTargetPercentile.toString()) {
					selectDropDownIndex(this._targetPercentileDropdown, index);
				}
			});
		}
	}

	protected async execute() {
		this._isOpen = false;
		this.migrationStateModel._skuScalingFactor = Number(this._scaleFactorInput.value!);
		this.migrationStateModel._skuTargetPercentile = Number((<azdata.CategoryValue>this._targetPercentileDropdown.value).name);
		this.migrationStateModel._skuEnablePreview = this._enablePreviewValue;
		await this.skuRecommendationPage.refreshSkuParameters();
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
