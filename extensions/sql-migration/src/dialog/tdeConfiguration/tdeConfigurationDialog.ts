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
import { EOL } from 'os';
import { ConfigDialogSetting } from '../../models/tdeModels'
import { IconPathHelper } from '../../constants/iconPathHelper';

export class TdeConfigurationDialog {

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _adsMethodConfirmationContainer!: azdata.FlexContainer;
	private _adsConfirmationCheckBox!: azdata.CheckBoxComponent;
	private _manualMethodWarningContainer!: azdata.FlexContainer;
	private _networkPathText!: azdata.InputBoxComponent;
	private _validationTable!: azdata.TableComponent;
	private _validationMessagesText!: azdata.InputBoxComponent;
	private _onClosed: () => void;

	private _validationSuccessDescriptionErrorAndTips!: string[][];

	constructor(public migrationStateModel: MigrationStateModel, onClosed: () => void) {
		this._onClosed = onClosed;
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
			this.migrationStateModel._databasesForMigration.length);

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
				'text-align': 'justify'
			},
			links: [{
				text: constants.LEARN_MORE,
				url: 'https://learn.microsoft.com/sql/relational-databases/security/encryption/transparent-data-encryption',
				accessibilityInformation: {
					label: constants.LEARN_MORE
				}
			}]
		}).component();
		const selectDataSourceRadioButtons = this.createMethodsContainer(_view);
		container.addItems([
			encrypted_description1,
			encrypted_description2,
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
				checked: this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting() === ConfigDialogSetting.ExportCertificates,
				CSSStyles: {
					...styles.BODY_CSS
				},
			}).component();
		this._disposables.push(
			adsMethodButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel.tdeMigrationConfig.setPendingTdeMigrationMethod(ConfigDialogSetting.ExportCertificates);
					let validationTitleData = await this.migrationStateModel.getTdeValidationTitles();

					let networkPathValidated =
						(this.migrationStateModel.tdeMigrationConfig.getPendingNetworkPath() !== '') &&
						(this.migrationStateModel.tdeMigrationConfig.getPendingNetworkPath() === this.migrationStateModel.tdeMigrationConfig.getLastValidatedNetworkPath())

					let result = validationTitleData.result.map(validationTitle => {
						return [
							validationTitle,
							{
								'icon': networkPathValidated ? IconPathHelper.completedMigration : IconPathHelper.notFound,
								'title': networkPathValidated ? constants.TDE_VALIDATION_STATUS_SUCCEEDED : constants.TDE_VALIDATION_STATUS_PENDING
							},
							networkPathValidated ? constants.TDE_VALIDATION_STATUS_SUCCEEDED : constants.TDE_VALIDATION_STATUS_PENDING
						]
					});

					await this._validationTable.updateProperty('data', result)
					await this.updateUI();
				}
			}));

		this._adsMethodConfirmationContainer = this.createAdsConfirmationContainer(_view);

		adsMethodContainer.addItems([
			adsMethodButton,
			this._adsMethodConfirmationContainer]);

		const manualMethodContainer = _view.modelBuilder.flexContainer()
			.withProps(
				{
					CSSStyles: {
						'flex-direction': 'column',
						'display': 'inline'
					}
				})
			.component();

		const manualMethodButton = _view.modelBuilder.radioButton()
			.withProps({
				name: buttonGroup,
				label: constants.TDE_WIZARD_MIGRATION_OPTION_MANUAL,
				checked: this.migrationStateModel.tdeMigrationConfig.getAppliedConfigDialogSetting() === ConfigDialogSetting.DoNotExport,
				CSSStyles: { ...styles.BODY_CSS }
			}).component();

		this._disposables.push(
			manualMethodButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					this.migrationStateModel.tdeMigrationConfig.setPendingTdeMigrationMethod(ConfigDialogSetting.DoNotExport);
					await this.updateUI();
				}
			}));

		this._manualMethodWarningContainer = this.createManualWarningContainer(_view);

		manualMethodContainer.addItems([
			manualMethodButton,
			this._manualMethodWarningContainer
		]);

		radioButtonContainer.addItems([
			adsMethodContainer,
			manualMethodContainer]);

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
				'flex-direction': 'column',
				'display': 'none'
			}
		}).component();

		const adsMethodInfoMessage = _view.modelBuilder.infoBox()
			.withProps({
				text: constants.TDE_WIZARD_ADS_CERTS_INFO,
				style: 'information',
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '4px 14px 0px 14px',
					'text-align': 'justify'
				}
			}).component();

		const networkPathLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.TDE_WIZARD_CERTS_NETWORK_SHARE_LABEL,
				description: constants.TDE_WIZARD_CERTS_NETWORK_SHARE_INFO,
				requiredIndicator: true,
				CSSStyles: {
					...styles.LABEL_CSS,
					'margin': '4px 0 14px 45px'
				}
			}).component();
		this._networkPathText = _view.modelBuilder.inputBox()
			.withProps({
				value: '',
				width: '300px',
				placeHolder: constants.TDE_WIZARD_CERTS_NETWORK_SHARE_PLACEHOLDER,
				required: true,
				CSSStyles: { ...styles.BODY_CSS, 'margin-top': '-1em', 'margin-left': '45px' }
			}).component();
		this._disposables.push(
			this._networkPathText.onTextChanged(async networkPath => {
				this.migrationStateModel.tdeMigrationConfig.setPendingNetworkPath(networkPath);
				await this.updateUI();
			}));

		this._adsConfirmationCheckBox = _view.modelBuilder.checkBox()
			.withProps({
				label: constants.TDE_WIZARD_MIGRATION_OPTION_ADS_CONFIRM,
				checked: this.migrationStateModel.tdeMigrationConfig.getAppliedExportCertUserConsent(),
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '10px 0 14px 15px'
				}
			}).component();
		this._disposables.push(
			this._adsConfirmationCheckBox.onChanged(async checked => {
				this.migrationStateModel.tdeMigrationConfig.setPendingExportCertUserConsent(checked);
				await this.updateUI();
			}));

		const preValidationSeparator = _view.modelBuilder.separator().component();

		const validationRequiredLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.TDE_VALIDATION_REQUIREMENTS_MESSAGE,
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '4px 2px 4px 2px'
				}
			}).component();

		const runValidationButton = _view.modelBuilder.button()
			.withProps(
				{
					label: constants.TDE_VALIDATION_STATUS_RUN_VALIDATION,
					enabled: true
				}).component();

		this._disposables.push(
			runValidationButton.onDidClick(async (e) => {
				let data = this._validationTable.data.map((e) => {
					return [
						e[0],
						{
							'icon': IconPathHelper.inProgressMigration,
							'title': constants.TDE_VALIDATION_STATUS_RUNNING
						},
						constants.TDE_VALIDATION_STATUS_RUNNING
					]
				});
				await this._validationTable.updateProperty('data', data);

				let validationData = await this.migrationStateModel.runTdeValidation(
					this.migrationStateModel.tdeMigrationConfig.getPendingNetworkPath());

				let allValidationsSucceeded = true;

				this._validationSuccessDescriptionErrorAndTips = validationData.result.map(e => {
					return [
						e.validationStatus.toString(),
						e.validationDescription,
						e.validationErrorMessage,
						e.validationTroubleshootingTips
					]
				});

				let res = validationData.result.map(e => {
					if (e.validationStatus < 0) {
						allValidationsSucceeded = false;
					}

					return [
						e.validationTitle,
						{
							'icon': e.validationStatus > 0 ? IconPathHelper.completedMigration : IconPathHelper.error,
							'title': e.validationStatusString
						},
						e.validationStatusString
					]
				});

				await this._validationTable.updateProperty('data', res);

				if (allValidationsSucceeded) {
					this.migrationStateModel.tdeMigrationConfig.setLastValidatedNetworkPath(
						this.migrationStateModel.tdeMigrationConfig.getPendingNetworkPath());
					await this.updateUI();
				}
			}));

		this._validationTable = this._createValidationTable(_view);

		this._disposables.push(
			this._validationTable.onRowSelected(
				async (e) => {
					const selectedRows: number[] = this._validationTable.selectedRows ?? [];

					let message: string = '';
					selectedRows.forEach((rowIndex) => {

						let successful = this._validationSuccessDescriptionErrorAndTips[rowIndex][0] === "1" // Value will be "1" if successful
						let description = this._validationSuccessDescriptionErrorAndTips[rowIndex][1];
						let errorMessage = this._validationSuccessDescriptionErrorAndTips[rowIndex][2];
						let tips = this._validationSuccessDescriptionErrorAndTips[rowIndex][3];

						message = `${constants.TDE_VALIDATION_DESCRIPTION}:${EOL}${description}`;
						if (!successful) {
							message += `${EOL}${EOL}`;
							if (errorMessage?.length > 0) {
								message += `${constants.TDE_VALIDATION_ERROR}:${EOL}${errorMessage}${EOL}${EOL}`;
							}

							message += `${constants.TDE_VALIDATION_TROUBLESHOOTING_TIPS}:${EOL}${tips}`;
						}
					});

					this._validationMessagesText.value = message;
				}));

		this._validationMessagesText = _view.modelBuilder.inputBox()
			.withProps({
				inputType: 'text',
				height: 142,
				multiline: true,
				CSSStyles: { 'overflow': 'none auto' }
			})
			.component();

		const postValidationSeparator = _view.modelBuilder.separator().component();

		container.addItems([
			adsMethodInfoMessage,
			networkPathLabel,
			this._networkPathText,
			this._adsConfirmationCheckBox,
			preValidationSeparator,
			validationRequiredLabel,
			runValidationButton,
			this._validationTable,
			this._validationMessagesText,
			postValidationSeparator
		]);

		return container;
	}

	private _createValidationTable(view: azdata.ModelView): azdata.TableComponent {
		return view.modelBuilder.table()
			.withProps({
				columns: [
					{
						value: 'title',
						name: constants.TDE_VALIDATION_TITLE,
						type: azdata.ColumnType.text,
						width: 320,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'image',
						name: '',
						type: azdata.ColumnType.icon,
						width: 30,
						headerCssClass: 'no-borders display-none',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'message',
						name: constants.TDE_MIGRATE_COLUMN_STATUS,
						type: azdata.ColumnType.text,
						width: 100,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
				],
				data: [],
				width: 450,
				height: 80,
				CSSStyles: {
					'margin-top': '10px',
					'margin-bottom': '10px',
				},
			})
			.component();
	}

	private createManualWarningContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'flex-direction': 'column',
				'display': 'none'
			}
		}).component();

		const manualMethodConfirmationDialog = _view.modelBuilder.infoBox()
			.withProps({
				text: constants.TDE_WIZARD_MIGRATION_OPTION_MANUAL_WARNING,
				style: 'warning',
				CSSStyles: {
					...styles.BODY_CSS,
					'margin': '4px 14px 0px 14px'
				},
				links: [{
					text: constants.LEARN_MORE,
					url: 'https://learn.microsoft.com/azure/azure-sql/managed-instance/tde-certificate-migrate',
					accessibilityInformation: {
						label: constants.LEARN_MORE
					}
				}]
			}).component();

		container.addItems([
			manualMethodConfirmationDialog]);
		return container;
	}

	private async updateUI(): Promise<void> {
		let exportCertsUsingAds = this.migrationStateModel.tdeMigrationConfig.getPendingConfigDialogSetting() === ConfigDialogSetting.ExportCertificates;
		this._networkPathText.value = this.migrationStateModel.tdeMigrationConfig.getPendingNetworkPath();
		this._networkPathText.required = exportCertsUsingAds;
		this._adsConfirmationCheckBox.checked = this.migrationStateModel.tdeMigrationConfig.getPendingExportCertUserConsent();

		await utils.updateControlDisplay(this._adsMethodConfirmationContainer, exportCertsUsingAds);
		await utils.updateControlDisplay(this._manualMethodWarningContainer, this.migrationStateModel.tdeMigrationConfig.getPendingConfigDialogSetting() === ConfigDialogSetting.DoNotExport);

		this.dialog!.okButton.enabled = this.migrationStateModel.tdeMigrationConfig.isAnyChangeReadyToBeApplied();
	}

	public async openDialog(dialogName?: string,) {
		if (!this._isOpen) {

			this.migrationStateModel.tdeMigrationConfig.configurationShown();

			this._isOpen = true;
			this.dialog = azdata.window.createModelViewDialog(
				constants.TDE_WIZARD_TITLE,
				'TdeConfigurationDialog',
				'narrow');

			this.dialog.okButton.label = constants.APPLY;
			this.dialog.okButton.enabled = false;
			this._disposables.push(
				this.dialog.okButton.onClick(
					() => {
						this._isOpen = false;
						this.migrationStateModel.tdeMigrationConfig.applyConfigDialogSetting();
						this._onClosed();
					})
			);

			this._disposables.push(
				this.dialog.cancelButton.onClick(
					() => {
						this.migrationStateModel.tdeMigrationConfig.cancelConfigDialogSetting();
						this._isOpen = false;
						this._onClosed();
					}));

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
