/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import { EventEmitter } from 'stream';
import * as constants from '../../constants/strings';

export class CancelFeedbackDialog {
	private dialog!: azdata.window.Dialog;

	private _disposables: vscode.Disposable[] = [];

	private _creationEvent: EventEmitter = new EventEmitter;
	private _isOpen: boolean = false;

	private _view!: azdata.ModelView;

	private _cancelReasonsList: string[] = [];
	private _cancellationReasonSelected: string = constants.CANCEL_FEEDBACK_NO_REASON_SELECTED;
	private _othersReasonInputBoxContainer!: azdata.FlexContainer;

	private _callback!: (isCancelled: boolean, cancellationReason: string) => Promise<void>;

	constructor() {
	}

	private async initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					this._view = view;
					const flex = this.createContainer(view);

					await view.initializeModel(flex);

					this._disposables.push(
						dialog.okButton.onClick(
							async (e) => {
								await this._callback(true, this._cancellationReasonSelected);
							}));

					this._disposables.push(
						view.onClosed(e =>
							this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					this._creationEvent.once('done', async () => {
						azdata.window.closeDialog(this.dialog);
						resolve();
					});
				}
				catch (ex) {
					reject(ex);
				}
			});

			dialog.okButton.label = constants.YES;
			dialog.cancelButton.label = constants.NO;
		});
	}

	public async openDialog(callback: (result: boolean, cancellationReason: string) => Promise<void>) {
		if (!this._isOpen) {
			this._isOpen = true;
			this._callback = callback;

			this.dialog = azdata.window.createModelViewDialog(
				'',
				'cancelFeedbackDialog',
				381,
				'normal',
				'below',
				false,
				true
			);

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;
		}
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '0px 30px 0px 30px',
				'flex-direction': 'column',
				'gap': '20px',
				'display': 'flex'
			}
		}).component();

		const headingLabel = _view.modelBuilder.text().withProps({
			value: constants.CANCEL_FEEDBACK_DIALOG_TITLE,
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin': '20px 0px 0px 0px'
			}
		}).component();
		const description = _view.modelBuilder.text().withProps({
			value: constants.CANCEL_FEEDBACK_DIALOG_DESCRIPTION,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px'
			}
		}).component();

		this.createCancelReasonsContainer(_view);

		container.addItems([
			headingLabel,
			description,
			this.createCancelReasonsContainer(_view)
		]);

		return container;
	}

	private createCancelReasonsContainer(_view: azdata.ModelView): azdata.GroupContainer {
		const cancelReasonDescription = _view.modelBuilder.text().withProps({
			value: constants.CANCEL_FEEDBACK_REASON_CONTAINER_DESCRIPTION,
			CSSStyles: {
				...styles.SUBTITLE_LABEL_CSS,
				'margin': '0px 0px 0px 10px'
			}
		}).component();

		const cancellationReasonsGroupList: azdata.Component[] = [];

		cancellationReasonsGroupList.push(cancelReasonDescription);
		this._cancelReasonsList.forEach((cancelReason) => {
			cancellationReasonsGroupList.push(this.createSpecificReasonRadioButton(this._view, cancelReason));
		});
		cancellationReasonsGroupList.push(this.createOthersReasonRadioButton(this._view));

		this.createOthersInputBoxContainer(this._view);
		cancellationReasonsGroupList.push(this._othersReasonInputBoxContainer);

		const cancellationReasonsGroup = _view.modelBuilder.groupContainer()
			.withLayout({
				header: constants.CANCEL_FEEDBACK_REASON_CONTAINER_TITLE,
				collapsible: true,
				collapsed: true
			}).withItems(
				cancellationReasonsGroupList
			).component();

		return cancellationReasonsGroup;
	}

	private createSpecificReasonRadioButton(view: azdata.ModelView, buttonLabelText: string): azdata.RadioButtonComponent {
		const buttonGroup = 'cancelMigrationButtonGroup';
		const cancelReasonRadioButton = view.modelBuilder.radioButton()
			.withProps({
				label: buttonLabelText,
				name: buttonGroup,
				CSSStyles: {
					'font-size': '13px',
					'line-height': '18px',
					'font-weight': '400',
					'margin': '0px 0px 0px 9px',
				},
				checked: false
			}).component();

		this._disposables.push(
			cancelReasonRadioButton.onDidChangeCheckedState(checked => {
				if (checked) {
					this._cancellationReasonSelected = buttonLabelText;
				}
			}));

		return cancelReasonRadioButton;
	}

	private createOthersReasonRadioButton(view: azdata.ModelView): azdata.RadioButtonComponent {
		const buttonGroup = 'cancelMigrationButtonGroup';
		const cancelReasonRadioButton = view.modelBuilder.radioButton()
			.withProps({
				label: 'Others',
				name: buttonGroup,
				CSSStyles: {
					...styles.SUBTITLE_LABEL_CSS,
					'margin': '0px 0px 0px 9px'
				},
				checked: false
			}).component();

		this._disposables.push(
			cancelReasonRadioButton.onDidChangeCheckedState(async checked => {
				if (checked) {
					await this._othersReasonInputBoxContainer.updateCssStyles({
						'display': 'flex'
					});
					this._cancellationReasonSelected = constants.CANCEL_FEEDBACK_NO_REASON_SELECTED;
				} else {
					await this._othersReasonInputBoxContainer.updateCssStyles({
						'display': 'none'
					});
				}
			}));

		return cancelReasonRadioButton;
	}

	private createOthersInputBoxContainer(_view: azdata.ModelView): void {
		const othersReasonInputBox = this._view.modelBuilder.inputBox()
			.withProps({
				inputType: 'text',
				placeHolder: constants.WIZARD_CANCEL_REASON_OTHERS_INPUT_BOX_NOTE,
				maxLength: 100,
				height: 60,
				multiline: true,
				display: 'inline-block',
				CSSStyles: {
					...styles.SUBTITLE_LABEL_CSS,
					'margin': '0px 0px 0px 29px',
					'overflow': 'hidden auto'
				}
			}).component();

		this._disposables.push(
			othersReasonInputBox.onTextChanged(value => this._cancellationReasonSelected = value));

		this._othersReasonInputBoxContainer = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '0px',
				'flex-direction': 'column',
				'display': 'none'
			}
		}).withItems([othersReasonInputBox]).component();
	}

	public updateCancelReasonsList(cancelReasonsList: string[]): void {
		this._cancelReasonsList = cancelReasonsList;
	}
}
