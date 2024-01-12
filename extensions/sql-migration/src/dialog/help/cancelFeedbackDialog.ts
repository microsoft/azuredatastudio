/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import { EventEmitter } from 'stream';

export class CancelFeedbackDialog {
	private dialog!: azdata.window.Dialog;

	private _disposables: vscode.Disposable[] = [];

	private _creationEvent: EventEmitter = new EventEmitter;
	private _isOpen: boolean = false;

	private _view!: azdata.ModelView;

	private _cancelReasonsList: string[] = [];
	private _cancellationReasonSelected: string = 'No reason selected';
	private _othersReasonInputBoxContainer!: azdata.FlexContainer;

	private _callback!: (isCancelled: boolean, cancellationReason: string) => Promise<void>;

	// TODO - Update all the string with localised strings
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

			dialog.okButton.label = "Yes";
			dialog.cancelButton.label = "No";
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
			value: "Cancel Migration",
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin': '20px 0px 0px 0px'
			}
		}).component();
		const description = _view.modelBuilder.text().withProps({
			value: "Do you want to cancel migration? Your unsaved changes will be discarded.",
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
			value: "Please take a moment to tell us the reason for canceling the migration. This will help us improve the experience.",
			// TODO - Take out all the styles to styles.ts
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
				header: "Reason for canceling migration",
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
					this._cancellationReasonSelected = 'No Reason Selected';
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
				placeHolder: "If you selected others, please write a short note.",
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
