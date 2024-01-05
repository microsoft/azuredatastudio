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
	private cancellationReasonsGroup!: azdata.GroupContainer;

	private _disposables: vscode.Disposable[] = [];

	private _creationEvent: EventEmitter = new EventEmitter;
	private _isOpen: boolean = false;

	private _view!: azdata.ModelView;
	private _cancelReasonsList: string[] = [];

	constructor(private wizardObject: azdata.window.Wizard) {
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
								await this.wizardObject.close();
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

	public async openDialog(dialogName?: string) {
		if (!this._isOpen) {
			this._isOpen = true;

			this.dialog = azdata.window.createModelViewDialog(
				'',
				'cancelMigration',
				450,
				'normal',
				'below',
				false,
				true,
				// <azdata.window.IDialogProperties>{
				// 	height: 100,
				// 	width: 100,
				// 	xPos: 100,
				// 	yPos: 100
				// }
			);

			const promise = this.initializeDialog(this.dialog);
			azdata.window.openDialog(this.dialog);
			await promise;
		}
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer().withProps({
			CSSStyles: {
				'margin': '20px',
				'flex-direction': 'column',
				'gap': '20px'
			}
		}).component();

		const headingLabel = _view.modelBuilder.text().withProps({
			value: "Cancel Migration",
			CSSStyles: {
				...styles.PAGE_TITLE_CSS,
				'margin': '0px',
			}
		}).component();
		const description = _view.modelBuilder.text().withProps({
			value: "Do you want to cancel migration? Your unsaved changes will be discarded.",
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '400',
				'margin': '0px',
			}
		}).component();

		this.createCancelReasonsContainer(_view);

		container.addItems([
			headingLabel,
			description,
			this.cancellationReasonsGroup
		]);

		return container;
	}

	private createCancelReasonsContainer(_view: azdata.ModelView): void {
		const cancelReasonDescription = _view.modelBuilder.text().withProps({
			value: "Please take a moment to tell us the reason for canceling the migration. This will help us improve the experience.",
			CSSStyles: {
				'font-size': '13px',
				'line-height': '18px',
				'font-weight': '400',
				'margin': '0px',
			}
		}).component();

		const cancellationReasonsGroupList: azdata.Component[] = [];
		cancellationReasonsGroupList.push(cancelReasonDescription);
		this._cancelReasonsList.forEach((cancelReason) => {
			cancellationReasonsGroupList.push(this.createCancelReasonRadioButton(this._view, cancelReason));
		});

		this.cancellationReasonsGroup = _view.modelBuilder.groupContainer()
			.withLayout({
				header: "Reason for canceling migration",
				collapsible: true,
				collapsed: true
			}).withItems(
				cancellationReasonsGroupList
			).component();
	}

	private createCancelReasonRadioButton(view: azdata.ModelView, buttonLabelText: string): azdata.RadioButtonComponent {
		const buttonGroup = 'resumeMigration';
		const cancelReasonRadioButton = view.modelBuilder.radioButton()
			.withProps({
				label: buttonLabelText,
				name: buttonGroup,
				CSSStyles: {
					'font-size': '13px',
					'line-height': '18px',
					'font-weight': '400',
					'margin': '0px',
				},
				checked: false
			}).component();

		this._disposables.push(
			cancelReasonRadioButton.onDidChangeCheckedState(checked => {
				if (checked) {
					// TODO- Telemetry
				}
			}));

		return cancelReasonRadioButton;
	}

	public updateCancelReasonsList(cancelReasonsList: string[]): void {
		this._cancelReasonsList = cancelReasonsList;
	}
}
