/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { MigrationStateModel, MigrationTargetType } from '../../models/stateMachine';
import { join } from 'path';
import * as constants from '../../constants/strings';
import * as contracts from '../../service/contracts';
import * as styles from '../../constants/styles';
import * as utils from '../../api/utils';
import { logError, TelemetryViews } from '../../telemetry';
import { IconPathHelper } from '../../constants/iconPathHelper';

export class GenerateProvisioningScriptDialog {

	private static readonly CloseButtonText: string = 'Close';

	private dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private _generateArmTemplateContainer!: azdata.FlexContainer;
	private _saveArmTemplateContainer!: azdata.FlexContainer;
	private _armTemplateErrorContainer!: azdata.FlexContainer;

	private _armTemplateTextBox!: azdata.TextComponent;
	private _armTemplateText!: string;

	constructor(public model: MigrationStateModel, public _targetType: MigrationTargetType) { }

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
				'margin': '0px 16px',
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
			value: constants.TARGET_PROVISIONING_IN_PROGRESS,
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

		// const armTemplateLoadingInfo = _view.modelBuilder.text().withProps({
		// 	// Replace with localized string in the future
		// 	value: 'We are generating an ARM template according to your recommended SKU. This may take some time.',
		// 	CSSStyles: {
		// 		...styles.BODY_CSS,
		// 	}
		// }).component();

		// const armTemplateLoadingInfoCcontainer = _view.modelBuilder.flexContainer().withLayout({
		// 	height: '100%',
		// 	flexFlow: 'row',
		// }).component();

		// armTemplateLoadingInfoCcontainer.addItem(armTemplateLoadingInfo, { flex: '0 0 auto' });

		const container = _view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column'
		}).withItems([
			armTemplateLoadingContainer,
			// armTemplateLoadingInfoCcontainer
		]).component();

		return container;
	}

	private CreateSaveArmTemplateContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const armTemplateLabel = _view.modelBuilder.text()
			.withProps({
				value: constants.TARGET_PROVISIONING_HEADER,
				CSSStyles: { ...styles.LABEL_CSS, 'margin': '12px 0 0', }
			}).component();

		const armTemplateDescription = _view.modelBuilder.text().withProps({
			value: constants.TARGET_PROVISIONING_DESCRIPTION,
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '8px',
			}
		}).component();

		const armTemplateLearnMoreLink = _view.modelBuilder.hyperlink().withProps({
			position: 'absolute',
			label: constants.TARGET_PROVISIONING_HYPERLINK_LABEL,
			url: 'https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/quickstart-create-templates-use-the-portal#edit-and-deploy-the-template',
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '24px'
			},
			showLinkIcon: true,
		}).component();

		const armTemplateLearnMoreContainer = _view.modelBuilder.flexContainer().withItems([
			armTemplateLearnMoreLink,
		]).withProps({
			height: 20,
			CSSStyles: {
				'margin-bottom': '8px',
			}
		}).component();

		const armTemplateWarning = _view.modelBuilder.infoBox().withProps({
			text: "The provided template is a quickstart template. After deployment, we recommend reviewing the {0} on how to solve common security requirements. Not all requirements are applicable to all environments, and you should consult your database and security team on which features to implement.",
			style: 'information',
			// width: '300px',
			CSSStyles: { ...styles.BODY_CSS, },
			links: [{
				text: "security best practices",
				url: 'https://learn.microsoft.com/azure/azure-sql/managed-instance/tde-certificate-migrate',
			}]
		}).component();

		const armTemplateSummary = _view.modelBuilder.text().withProps({
			value: this._targetType === MigrationTargetType.SQLMI
				? constants.TARGET_PROVISIONING_MI_DETAILS
				: this._targetType === MigrationTargetType.SQLVM
					? constants.TARGET_PROVISIONING_VM_DETAILS
					: constants.TARGET_PROVISIONING_DB_DETAILS(this.model._skuEnableElastic
						? this.model._skuRecommendationResults.recommendations?.sqlDbRecommendationResults.length!
						: this.model._skuRecommendationResults.recommendations?.sqlDbRecommendationResults.length!),
			CSSStyles: {
				...styles.BODY_CSS,
				'margin-bottom': '16px',
			},
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
			height: 400,
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
			armTemplateLabel,
			armTemplateDescription,
			armTemplateLearnMoreContainer,
			armTemplateWarning,
			armTemplateSummary,
			textContainer,
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
			value: constants.TARGET_PROVISIONING_ERROR,
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

			this.dialog = azdata.window.createModelViewDialog(constants.TARGET_PROVISIONING_TITLE, 'ViewArmTemplateDialog', 'medium');

			this.dialog.okButton.label = GenerateProvisioningScriptDialog.CloseButtonText;
			this.dialog.okButton.position = 'left';
			this._disposables.push(this.dialog.okButton.onClick(async () => await this.execute()));
			this.dialog.cancelButton.hidden = true;

			const armTemplateSaveButton = azdata.window.createButton('Save template', 'right');
			this._disposables.push(armTemplateSaveButton.onClick(async () => await this.saveArmTemplate()));

			const armTemplateCopyButton = azdata.window.createButton(constants.COPY_TO_CLIPBOARD, 'right');
			this._disposables.push(armTemplateCopyButton.onClick(async () => await this.copyArmTemplate()));

			const armTemplatePortalButton = azdata.window.createButton('Deploy in Azure Portal', 'right');
			this._disposables.push(armTemplatePortalButton.onClick(() => vscode.env.openExternal(vscode.Uri.parse("https://portal.azure.com/#create/Microsoft.Template"))));

			this.dialog.customButtons = [armTemplateSaveButton, armTemplateCopyButton, armTemplatePortalButton];

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
		void vscode.window.showInformationMessage(constants.TARGET_PROVISIONING_SAVE_SUCCESS(filePath?.path!));
	}

	private async copyArmTemplate(): Promise<void> {
		await vscode.env.clipboard.writeText(this._armTemplateText);
		void vscode.window.showInformationMessage(constants.COPIED_TO_CLIPBOARD);
	}
}
