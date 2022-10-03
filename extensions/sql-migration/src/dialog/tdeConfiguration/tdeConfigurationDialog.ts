/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { SKURecommendationPage } from '../../wizard/skuRecommendationPage';


export class TdeConfigurationDialog {

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _adsMethodConfirmationContainer!: azdata.FlexContainer;
	private _adsConfirmationCheckBox!: azdata.CheckBoxComponent;

	constructor(public skuRecommendationPage: SKURecommendationPage, public wizard: azdata.window.Wizard, public migrationStateModel: MigrationStateModel) {
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
		const encryptedDescriptionText = constants.TDE_WIZARD_DATABASES_SELECTED(
			this.migrationStateModel.tdeMigrationConfig.getTdeEnabledDatabasesCount(),
			this.migrationStateModel._assessedDatabaseList.length);

		const encrypted_description1 = _view.modelBuilder.text().withProps({
			value: encryptedDescriptionText,
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();
		const encrypted_description2 = _view.modelBuilder.text().withProps({
			value: constants.TDE_WIZARD_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-top': '8px',
			}
		}).component();
		const learnMoreLink = _view.modelBuilder.hyperlink()
			.withProps({
				label: constants.LEARN_MORE,
				ariaLabel: constants.LEARN_MORE,
				url: 'https://learn.microsoft.com/sql/relational-databases/security/encryption/transparent-data-encryption',
				showLinkIcon: true,
			}).component();
		const selectDataSourceRadioButtons = this.createMethodsContainer(_view);
		container.addItems([
			encrypted_description1,
			encrypted_description2,
			learnMoreLink,
			selectDataSourceRadioButtons,
		]);
		return container;
	}


	private createMethodsContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const chooseMethodText = _view.modelBuilder.text().withProps({
			value: constants.TDE_WIZARD_MIGRATION_CAPTION,
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
				'flex-direction': 'column'
			}
		}).component();

		const adsMethodContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{
					CSSStyles: {
						'flex-direction': 'column',
						'display': 'inline'
					}
				})
			.component();

		const adsMethodButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.TDE_WIZARD_MIGRATION_OPTION_ADS,
				checked: this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodAds(),
				CSSStyles: {
					...styles.BODY_CSS
				},
			}).component();
		this._disposables.push(
			adsMethodButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel.tdeMigrationConfig.setTdeMigrationMethod(true);
					await this.updateUI();
				}
			}));

		// const learnMoreLink = _view.modelBuilder.hyperlink()
		// 	.withProps({
		// 		label: constants.LEARN_MORE,
		// 		ariaLabel: constants.LEARN_MORE,
		// 		url: 'https://learn.microsoft.com/sql/relational-databases/security/encryption/transparent-data-encryption',
		// 		showLinkIcon: true,
		// 	}).component();

		this._adsMethodConfirmationContainer = this.createAdsConfirmationContainer(_view);

		adsMethodContainer.addItems([
			adsMethodButton,
			//learnMoreLink,
			this._adsMethodConfirmationContainer]);

		const manualMethodButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.TDE_WIZARD_MIGRATION_OPTION_MANUAL,
				checked: this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodManual(),
				CSSStyles: { ...styles.BODY_CSS }
			}).component();
		this._disposables.push(
			manualMethodButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel.tdeMigrationConfig.setTdeMigrationMethod(false);
					await this.updateUI();
				}
			}));

		radioButtonContainer.addItems([
			adsMethodContainer,
			manualMethodButton]);

		const container = _view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'column' })
			.withItems([
				chooseMethodText,
				radioButtonContainer
			])
			.component();

		return container;
	}

	private createAdsConfirmationContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column'
			}
		}).component();

		this._adsConfirmationCheckBox = _view.modelBuilder.checkBox()
			.withProps({
				label: constants.TDE_WIZARD_MIGRATION_OPTION_ADS_CONFIRM,
				checked: this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodAdsConfirmed(),
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '4px 0 14px 14px'
				}
			}).component();
		this._disposables.push(
			this._adsConfirmationCheckBox.onChanged(async checked => {
				this.migrationStateModel.tdeMigrationConfig.setAdsConfirmation(checked);
				await this.updateUI();
			}));

		container.addItems([
			this._adsConfirmationCheckBox]);
		return container;
	}

	private async updateUI(): Promise<void> {
		const useAds = this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodAds();

		this._adsConfirmationCheckBox.checked = this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodAdsConfirmed();
		await utils.updateControlDisplay(this._adsMethodConfirmationContainer, useAds);

		this.dialog!.okButton.enabled = this.migrationStateModel.tdeMigrationConfig.isTdeMigrationMethodSet();
	}

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {

			this.migrationStateModel.tdeMigrationConfig.configurationShown();

			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(
				constants.TDE_WIZARD_TITLE,
				'TdeConfigurationDialog',
				'narrow');

			this.dialog.okButton.label = constants.APPLY;
			this._disposables.push(
				this.dialog.okButton.onClick(
					(eventArgs) => {
						this._isOpen = false;
						this.migrationStateModel.tdeMigrationConfig.setConfigurationCompleted();
					})
			);

			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => this._isOpen = false));

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;

			await this.updateUI();
		}
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}
}
