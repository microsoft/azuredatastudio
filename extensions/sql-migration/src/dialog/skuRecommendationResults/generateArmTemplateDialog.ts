/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import { join } from 'path';
import * as contracts from '../../service/contracts';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { logError, TelemetryViews } from '../../telemetry';
import { IconPathHelper } from '../../constants/iconPathHelper';

export class GenerateArmTemplateDialog {

	private static readonly CloseButtonText: string = 'Close';

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _generateArmTemplateContainer!: azdata.FlexContainer;
	private _saveArmTemplateContainer!: azdata.FlexContainer;
	private _armTemplateErrorContainer!: azdata.FlexContainer;

	private _armTemplateTextBox!: azdata.TextComponent;
	private _armTemplateText!: string;

	constructor(public model: MigrationStateModel, public _targetType: MigrationTargetType) {

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
		this._generateArmTemplateContainer = this.CreateGenerateArmTemplateContainer(_view);
		this._saveArmTemplateContainer = this.CreateSaveArmTemplateContainer(_view);
		this._armTemplateErrorContainer = this.CreateArmTemplateErrorContainer(_view);
		container.addItems([
			this._generateArmTemplateContainer,
			this._saveArmTemplateContainer,
			this._armTemplateErrorContainer
		]);
		return container;
	}

	private CreateGenerateArmTemplateContainer(_view: azdata.ModelView): azdata.FlexContainer {

		const armTemplateLoader = _view.modelBuilder.loadingComponent().component();

		const armTemplateProgress = _view.modelBuilder.text().withProps({
			// Replace with localized string in the future
			value: 'ARM template generation in progress...',
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-right': '20px'
			}
		}).component();

		const armTemplateLoadingContainer = _view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'row',
		}).component();

		armTemplateLoadingContainer.addItem(armTemplateProgress, { flex: '0 0 auto' });
		armTemplateLoadingContainer.addItem(armTemplateLoader, { flex: '0 0 auto' });

		const armTemplateLoadingInfo = _view.modelBuilder.text().withProps({
			// Replace with localized string in the future
			value: 'We are generating an ARM template according to your recommended SKU. This may take some time.',
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		const armTemplateLoadingInfoCcontainer = _view.modelBuilder.flexContainer().withLayout({
			height: '100%',
			flexFlow: 'row',
		}).component();

		armTemplateLoadingInfoCcontainer.addItem(armTemplateLoadingInfo, { flex: '0 0 auto' });

		const container = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			armTemplateLoadingContainer,
			armTemplateLoadingInfoCcontainer
		]).component();

		return container;
	}

	private CreateSaveArmTemplateContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const armTemplateDescription = _view.modelBuilder.text().withProps({
			// Replace with localized string in the future
			value: 'ARM templates enable you to define the infrastructure requirements for your deployments on Azure.',
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '8px',
			}
		}).component();

		const armTemplateLearnMoreLink = _view.modelBuilder.hyperlink().withProps({
			// Replace with localized string in the future
			position: 'absolute',
			label: 'Learn more on how to deploy ARM templates',
			url: 'https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/quickstart-create-templates-use-the-portal#edit-and-deploy-the-template',
			CSSStyles: {
				...styles.BODY_CSS,
			}
		}).component();

		const armTemplateLearnMoreContainer = _view.modelBuilder.flexContainer().withItems([
			armTemplateLearnMoreLink,
		]).withProps({
			height: 20,
			CSSStyles: {
				'margin-bottom': '8px',
			}
		}).component();

		this._armTemplateTextBox = _view.modelBuilder.text().withProps({
			value: this._armTemplateText,
			width: '100%',
			height: '100%',
			CSSStyles: {
				'font': '14px "Monaco", "Menlo", "Consolas", "Droid Sans Mono", "Inconsolata", "Courier New", monospace',
				'margin': '0',
				'white-space': 'pre',
				'background-color': '#eeeeee',
			}

		}).component();

		const textContainer = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			height: 600,
		}).withProps({
			CSSStyles: {
				'overflow': 'auto',
				'user-select': 'text',
				'margin-bottom': '8px',
			}
		}).withItems([
			this._armTemplateTextBox
		]).component();

		const container = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			position: 'relative',
		}).withProps({
			display: 'none',
		}).withItems([
			armTemplateDescription,
			armTemplateLearnMoreContainer,
			textContainer
		]).component();

		return container;
	}

	private CreateArmTemplateErrorContainer(_view: azdata.ModelView): azdata.FlexContainer {

		const errorIcon = _view.modelBuilder.image().withProps({
			iconPath: IconPathHelper.error,
			iconHeight: 17,
			iconWidth: 17,
			width: 20,
			height: 20
		}).component();

		const errorText = _view.modelBuilder.text().withProps({
			// Replace with localized string in the future
			value: 'An error occurred while generating the ARM template. Please try again.',
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-left': '8px'
			}
		}).component();

		const container = _view.modelBuilder.flexContainer().withProps({
			display: 'none',
		}).component();

		container.addItem(errorIcon, { flex: '0 0 auto' });
		container.addItem(errorText, { flex: '0 0 auto' });

		return container;
	}

	private async updateArmTemplateStatus(succeeded: boolean): Promise<void> {
		await this._generateArmTemplateContainer.updateCssStyles({ 'display': 'none' });

		if (succeeded) {
			this._armTemplateText = fs.readFileSync(this.model._provisioningScriptResult.result.provisioningScriptFilePath).toString();
			this._armTemplateTextBox.value = this._armTemplateText;
			await this._saveArmTemplateContainer.updateCssStyles({ 'display': 'inline' });
		}
		else {
			await this._armTemplateErrorContainer.updateCssStyles({ 'display': 'inline' });
		}
	}

	public async openDialog(dialogName?: string, recommendations?: contracts.SkuRecommendationResult) {
		if (!this._isOpen) {
			this._isOpen = true;

			this.dialog = azdata.window.createModelViewDialog('Generate ARM template', 'ViewArmTemplateDialog', 'medium');

			this.dialog.okButton.label = GenerateArmTemplateDialog.CloseButtonText;
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));
			this.dialog.cancelButton.hidden = true;

			const armTemplateSaveButton = azdata.window.createButton('Save template', 'left');
			this._disposables.push(armTemplateSaveButton.onClick(async () => await this.saveArmTemplate()));

			this.dialog.customButtons = [armTemplateSaveButton];

			const dialogSetupPromises: Thenable<void>[] = [];
			dialogSetupPromises.push(this.initializeDialog(this.dialog));

			azdata.window.openDialog(this.dialog);
			await Promise.all(dialogSetupPromises);

			// Generate ARM template upon opening dialog
			await this.model.generateProvisioningScript(this._targetType);
			const error = this.model._provisioningScriptResult.error;

			if (error) {
				logError(TelemetryViews.ProvisioningScriptWizard, 'ProvisioningScriptGenerationUnexpectedError', error);
				await this.updateArmTemplateStatus(false);
			}
			else {
				await this.updateArmTemplateStatus(true);
			}
		}
	}

	protected async execute() {
		this._isOpen = false;
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	private async saveArmTemplate(): Promise<void> {
		const filePath = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.file(join(utils.getUserHome()!, 'ARMTemplate-' + this._targetType + '-' + new Date().toISOString().split('T')[0] + '.json')),
			filters: {
				'JSON File': ['json']
			}
		});

		fs.writeFileSync(filePath!.fsPath, this._armTemplateText);
		void vscode.window.showInformationMessage('Successfully saved ARM template to ' + filePath + '.');
	}

}
