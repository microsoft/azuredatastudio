/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../constants/iconPathHelper';
import * as loc from '../constants/strings';
import { sendSqlMigrationActionEvent, TelemetryActions, TelemetryViews } from '../telemtery';

export class FeedbackDialog {

	private static readonly DialogName: string = 'SqlMigrationFeedbackDialog';

	private _dialog!: azdata.window.Dialog;
	private _buttonGroup!: azdata.FlexContainer;
	private _isOpen: boolean = false;
	private _feedbackRating?: number;
	private _feedbackText?: string;

	constructor() {
	}

	public async openDialog() {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				'',
				FeedbackDialog.DialogName,
				440,
				'normal');

			this._dialog.registerContent(async view => {
				const headingGroup = view.modelBuilder
					.flexContainer()
					.withItems([
						view.modelBuilder
							.image()
							.withProperties<azdata.ImageComponentProperties>({
								iconPath: IconPathHelper.sendFeedback,
								iconHeight: 32,
								iconWidth: 32,
								height: 32,
								width: 32,
							})
							.component(),
						view.modelBuilder
							.text()
							.withProperties<azdata.TextComponentProperties>({
								value: loc.FEEDBACK_DIALOG_HEADING,
								CSSStyles: {
									'margin': '0 0 0 10px',
								},
							})
							.component(),
					])
					.withLayout({
						width: '100%',
						alignContent: 'flex-start',
						flexFlow: 'row',
					})
					.component();

				this._buttonGroup = view.modelBuilder
					.flexContainer()
					.withItems([
						this._createFeedbackButton(view, 0, loc.FEEDBACK_DIALOG_RATING_1),
						this._createFeedbackButton(view, 1, loc.FEEDBACK_DIALOG_RATING_2),
						this._createFeedbackButton(view, 2, loc.FEEDBACK_DIALOG_RATING_3),
						this._createFeedbackButton(view, 3, loc.FEEDBACK_DIALOG_RATING_4),
						this._createFeedbackButton(view, 4, loc.FEEDBACK_DIALOG_RATING_5),
					])
					.withLayout({
						alignContent: 'flex-start',
						flexFlow: 'row',
					})
					.withProperties<azdata.ComponentProperties>({
						display: 'inline-flex',
						ariaLabel: loc.FEEDBACK_DIALOG_HEADING,
					})
					.component();

				const feedbackInputBox = view.modelBuilder
					.inputBox()
					.withProperties<azdata.InputBoxProperties>({
						rows: 3,
						inputType: 'text',
						multiline: true,
						placeHolder: loc.FEEDBACK_DIALOG_PLACEHOLDER,
						CSSStyles: {
							'white-space': 'normal!important',
						},
					})
					.component();

				feedbackInputBox.onTextChanged(
					value => this._feedbackText = value);

				const privacyLink = view.modelBuilder
					.hyperlink()
					.withProperties<azdata.HyperlinkComponentProperties>({
						label: loc.FEEDBACK_DIALOG_PRIVACY_LINK,
						url: 'https://privacy.microsoft.com/privacystatement',
						showLinkIcon: true
					})
					.component();

				const formModel = view.modelBuilder
					.formContainer()
					.withFormItems([{
						components: [
							{
								component: headingGroup,
							},
							{
								component: this._buttonGroup,
							},
							{
								component: feedbackInputBox,
							},
							{
								component: privacyLink,
							}
						],
						title: ''
					}])
					.withLayout({ width: '100%' })
					.component();

				await view.initializeModel(formModel);
				await this._buttonGroup.items[0].focus();
			});

			this._dialog.okButton.label = loc.FEEDBACK_DIALOG_SUBMIT_BUTTON;
			this._dialog.okButton.onClick(async () => await this._execute());

			this._dialog.cancelButton.label = loc.FEEDBACK_DIALOG_CANCEL_BUTTON;
			this._dialog.cancelButton.onClick(() => this._cancel());

			azdata.window.openDialog(this._dialog);
		}
	}

	private async _execute() {
		sendSqlMigrationActionEvent(
			TelemetryViews.SqlMigrationFeedbackDialog,
			TelemetryActions.SendFeedback,
			{
				'FeedbackRating': this._feedbackRating?.toString() || '',
				'FeedbackMessage': this._feedbackText?.substr(0, 500) || '',
			});

		await vscode.window.showInformationMessage(loc.FEEDBACK_DIALOG_SENT_MESSAGE);
		this._isOpen = false;
	}

	private _cancel() {
		this._isOpen = false;
	}

	private _createFeedbackButton(view: azdata.ModelView, index: number, ariaLabel: string): azdata.Component {
		const button = view.modelBuilder
			.button()
			.withProperties<azdata.ButtonProperties>({
				ariaLabel: ariaLabel,
				height: '40px',
				buttonType: azdata.ButtonType.Normal,
				iconHeight: '24px',
				iconWidth: '38px',
				iconPath: IconPathHelper.blueStar,
				CSSStyles: {
					'margin': '0 10px 0 0',
				},
			})
			.component();

		button.onDidClick(() => this._updateButtonImages(index));

		return button;
	}

	private _updateButtonImages(index: number): void {
		const items: azdata.Component[] = this._buttonGroup?.items || [];
		this._feedbackRating = index;
		for (let i = 0; i < items.length; i++) {
			const btn = items[i] as azdata.ButtonComponent;
			btn.iconPath = i <= index
				? IconPathHelper.solidBlueStar
				: IconPathHelper.blueStar;
		}
	}
}
