/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import { hasRecommendations, selectDropDownIndex } from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendation/skuRecommendationPage';

export const TARGET_PERCENTILE_VALUES = [99, 97, 95, 90, 75, 50];

export class SkuEditParametersDialog {
	private static readonly UpdateButtonText: string = constants.UPDATE;

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _scaleFactorInput!: azdata.InputBoxComponent;
	private _targetPercentileDropdown!: azdata.DropDownComponent;
	private _enablePreviewValue: boolean = true;
	private _enableElasticRecommendation!: boolean;

	constructor(
		public skuRecommendationPage: SKURecommendationPage,
		public migrationStateModel: MigrationStateModel) {
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

		const enableElasticLabel = _view.modelBuilder.text().withProps({
			value: constants.ELASTIC_RECOMMENDATION_LABEL,
			width: WIZARD_INPUT_COMPONENT_WIDTH,
			requiredIndicator: true,
			CSSStyles: {
				...styles.LABEL_CSS,
			}
		}).component();
		const elasticButtonGroup = 'enableElasticRecommendations';
		const enableElasticRadioButtonContainer = _view.modelBuilder.flexContainer()
			.withProps({
				CSSStyles: {
					'flex-direction': 'row',
					'width': 'fit-content',
					'margin-top': '-1em',
					'margin-bottom': '8px',
				}
			}).component();
		const enableElasticButton = _view.modelBuilder.radioButton()
			.withProps({
				name: elasticButtonGroup,
				label: constants.YES,
				checked: this._enableElasticRecommendation,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': 'fit-content',
					'margin': '0'
				},
			}).component();
		this._disposables.push(enableElasticButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				this._enableElasticRecommendation = true;
			}
		}));
		const disableElasticButton = _view.modelBuilder.radioButton()
			.withProps({
				name: elasticButtonGroup,
				label: constants.NO,
				checked: !this._enableElasticRecommendation,
				CSSStyles: {
					...styles.BODY_CSS,
					'width': 'fit-content',
					'margin': '0 12px',
				}
			}).component();
		this._disposables.push(disableElasticButton.onDidChangeCheckedState(async (e) => {
			if (e) {
				this._enableElasticRecommendation = false;
			}
		}));
		enableElasticRadioButtonContainer.addItems([
			enableElasticButton,
			disableElasticButton
		]);

		const enableElasticInfoBox = _view.modelBuilder.infoBox()
			.withProps({
				text: constants.ELASTIC_RECOMMENDATION_INFO,
				style: 'information',
				CSSStyles: {
					...styles.BODY_CSS,
				}
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
			enableElasticLabel,
			enableElasticRadioButtonContainer,
			enableElasticInfoBox,
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
			this.dialog.okButton.position = 'left';
			this.dialog.cancelButton.position = 'left';
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
			this._enableElasticRecommendation = this.migrationStateModel._skuEnableElastic;
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
		this.migrationStateModel._skuEnableElastic = this._enableElasticRecommendation;
		if (hasRecommendations(this.migrationStateModel)) {
			await this.skuRecommendationPage.refreshAzureRecommendation();
		}
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
