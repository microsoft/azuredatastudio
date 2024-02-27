/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import path = require('path');
import { MigrationStateModel } from '../../models/stateMachine';
import * as constants from '../../constants/strings';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { logError, TelemetryViews } from '../../telemetry';
import { IconPathHelper } from '../../constants/iconPathHelper';
import { SelectStorageAccountDialog } from './SelectStorageAccountDialog';

export class GenerateProvisioningScriptDialog {

	private static readonly CloseButtonText: string = 'Close';

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];
	private _armTemplateTextBox!: azdata.TextComponent;
	private _armTemplateText!: string;

	constructor(public model: MigrationStateModel, public _targetType: utils.MigrationTargetType) { }

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.CreateSaveArmTemplateContainer(view);

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

	private CreateSaveArmTemplateContainer(_view: azdata.ModelView): azdata.FlexContainer {

		const armTemplateDescription = _view.modelBuilder.text().withProps({
			value: constants.TARGET_PROVISIONING_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '8px',
				'height': '36'
			}
		}).component();

		this._armTemplateTextBox = _view.modelBuilder.text().withProps({
			value: this._armTemplateText,
			width: '100%',
			height: '100%',
			CSSStyles: {
				'font': '12px "Monaco", "Menlo", "Consolas", "Droid Sans Mono", "Inconsolata", "Courier New", monospace',
				'margin': '0',
				'padding': '8px',
				'white-space': 'pre',
				'background-color': '#eeeeee',
				'overflow-x': 'hidden',
				'word-break': 'break-all'
			}
		}).component();

		const textContainer = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: 700,
		}).withProps({
			CSSStyles: {
				'overflow': 'auto',
				'user-select': 'text',
				'margin-bottom': '8px',
			}
		}).withItems([
			this._armTemplateTextBox
		]).component();

		const saveTemplateButton = _view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.TARGET_PROVISIONING_TITLE,
				width: 117,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.openFolder,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		saveTemplateButton.onDidClick(async () => {
			const folder = await utils.promptUserForFolder();
			if (folder) {
				if (this._armTemplateText) {
					let destinationFilePath: string | undefined;
					switch (this._targetType) {
						case utils.MigrationTargetType.SQLMI:
							destinationFilePath = path.join(folder, 'ARMTemplate-AzureSqlManagedInstance' + new Date().toISOString().split('T')[0] + '.json');
							break;

						case utils.MigrationTargetType.SQLVM:
							destinationFilePath = path.join(folder, 'ARMTemplate-AzureSqlVirtualMachine' + new Date().toISOString().split('T')[0] + '.json');
							break;

						case utils.MigrationTargetType.SQLDB:
							destinationFilePath = path.join(folder, 'ARMTemplate-AzureSqlDatabase' + new Date().toISOString().split('T')[0] + '.json');
							break;
					}
					fs.writeFileSync(destinationFilePath!, this._armTemplateText);
				} else {
					console.log(this.model._armTemplateResult.generateTemplateError);
					// log in telemetry -- TO DO
				}
			}
		});

		const uploadTemlateToAzureButton = _view.modelBuilder.button()
			.withProps({
				buttonType: azdata.ButtonType.Normal,
				label: constants.UPLOAD_TEMPLATE_TO_AZURE,
				width: 127,
				height: 36,
				iconHeight: 16,
				iconWidth: 16,
				iconPath: IconPathHelper.import,
				CSSStyles: {
					...styles.TOOLBAR_CSS
				}
			}).component();

		uploadTemlateToAzureButton.onDidClick(async () => {
			const selectAzureAccountDialog = new SelectStorageAccountDialog(this.model, this._targetType);
			await selectAzureAccountDialog.initialize();
		});

		const buttonsContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'display': 'flex',
				'flex-direction': 'row',
				'margin': '5px 5px 5px 5px',
				'width': '244px',
				'height': '36px',
			}
		}).component();

		buttonsContainer.addItem(saveTemplateButton);
		buttonsContainer.addItem(uploadTemlateToAzureButton);

		const container = _view.modelBuilder.flexContainer().
			withProps({
				CSSStyles: {
					'margin': '10px 10px 10px 10px',
					'flex-direction': 'column',
				}
			})
			.withItems([
				armTemplateDescription,
				buttonsContainer,
				textContainer,
			]).component();

		return container;
	}

	private async displayArmTemplate(): Promise<void> {
		this._armTemplateText = (this.model._armTemplateResult.template)!;
		this._armTemplateTextBox.value = this._armTemplateText;
	}



	public async openDialog() {
		if (!this._isOpen) {
			this._isOpen = true;

			this.dialog = azdata.window.createModelViewDialog(constants.TARGET_PROVISIONING_TITLE, 'ViewArmTemplateDialog', 'medium');

			this.dialog.okButton.label = GenerateProvisioningScriptDialog.CloseButtonText;
			this.dialog.okButton.position = 'left';
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));
			this.dialog.cancelButton.hidden = true;

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);

			await this.model.getArmTemplate(this._targetType);

			const error = this.model._armTemplateResult.generateTemplateError;

			if (error) {
				logError(TelemetryViews.ProvisioningScriptWizard, 'ProvisioningScriptGenerationError', error);
			}
			else {
				await this.displayArmTemplate();
			}
		}
	}

	protected async execute() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

}
