/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as styles from '../../constants/styles';
import { EventEmitter } from 'stream';
import { sendSqlMigrationActionEvent, TelemetryAction, TelemetryViews, getTelemetryProps } from '../../telemetry';
import { MigrationStateModel } from '../../models/stateMachine';

export class CancelFeedbackDialog {
	private dialog!: azdata.window.Dialog;

	private _disposables: vscode.Disposable[] = [];

	private _creationEvent: EventEmitter = new EventEmitter;
	private _isOpen: boolean = false;

	private _view!: azdata.ModelView;

	private _cancelReasonsList: string[] = [];
	private _cancellationReasonSelected: string = 'No reason selected';
	private _othersReasonInputBoxContainer!: azdata.FlexContainer;

	// TODO - Update all the string with localised strings
	constructor(private wizardObject: azdata.window.Wizard, private migrationStateModel: MigrationStateModel) {
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

								sendSqlMigrationActionEvent(
									TelemetryViews.LoginMigrationWizard,
									TelemetryAction.PageButtonClick,
									{
										...getTelemetryProps(this.migrationStateModel),
										'buttonPressed': TelemetryAction.Cancel,
										'pageTitle': this.wizardObject.pages[this.wizardObject.currentPage].title,
										'cancellationReason': this._cancellationReasonSelected
									},
									{});
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
				'margin': '20px',
				'flex-direction': 'column',
				'gap': '20px',
				'display': 'flex'
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
			this.createCancelReasonsContainer(_view)
		]);

		return container;
	}

	private createCancelReasonsContainer(_view: azdata.ModelView): azdata.GroupContainer {
		const cancelReasonDescription = _view.modelBuilder.text().withProps({
			value: "Please take a moment to tell us the reason for canceling the migration. This will help us improve the experience.",
			// TODO - Take out all the styles to styles.ts
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
					this._cancellationReasonSelected = buttonLabelText;
				}
			}));

		return cancelReasonRadioButton;
	}

	private createOthersReasonRadioButton(view: azdata.ModelView): azdata.RadioButtonComponent {
		const buttonGroup = 'resumeMigration';
		const cancelReasonRadioButton = view.modelBuilder.radioButton()
			.withProps({
				label: 'Others',
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
					'margin': '0px 0px 0px 20px',
					'overflow': 'hidden auto',
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
