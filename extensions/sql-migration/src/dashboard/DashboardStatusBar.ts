/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../constants/strings';

export interface ErrorEvent {
	connectionId: string;
	title: string;
	label: string;
	message: string;
}

export class DashboardStatusBar implements vscode.Disposable {
	private _errorTitle: string = '';
	private _errorLabel: string = '';
	private _errorDescription: string = '';
	private _errorDialogIsOpen: boolean = false;
	private _statusInfoBox: azdata.InfoBoxComponent;
	private _context: vscode.ExtensionContext;
	private _errorEvent: vscode.EventEmitter<ErrorEvent> = new vscode.EventEmitter<ErrorEvent>();
	private _disposables: vscode.Disposable[] = [];

	constructor(context: vscode.ExtensionContext, connectionId: string, statusInfoBox: azdata.InfoBoxComponent, errorEvent: vscode.EventEmitter<ErrorEvent>) {
		this._context = context;
		this._statusInfoBox = statusInfoBox;
		this._errorEvent = errorEvent;

		this._disposables.push(
			this._errorEvent.event(
				async (e) => {
					if (e.connectionId === connectionId) {
						return (e.title.length > 0 && e.label.length > 0)
							? await this.showError(e.title, e.label, e.message)
							: await this.clearError();
					}
				}));
	}

	dispose() {
		this._disposables.forEach(
			d => { try { d.dispose(); } catch { } });
	}

	public async showError(errorTitle: string, errorLabel: string, errorDescription: string): Promise<void> {
		this._errorTitle = errorTitle;
		this._errorLabel = errorLabel;
		this._errorDescription = errorDescription;
		this._statusInfoBox.style = 'error';
		this._statusInfoBox.text = errorTitle;
		this._statusInfoBox.ariaLabel = errorTitle;

		await this._updateStatusDisplay(this._statusInfoBox, true);
	}

	public async clearError(): Promise<void> {
		await this._updateStatusDisplay(this._statusInfoBox, false);
		this._errorTitle = '';
		this._errorLabel = '';
		this._errorDescription = '';
		this._statusInfoBox.style = 'success';
		this._statusInfoBox.text = '';
	}

	public async openErrorDialog(): Promise<void> {
		if (this._errorDialogIsOpen) {
			return;
		}

		try {
			const tab = azdata.window.createTab(this._errorTitle);
			tab.registerContent(async (view) => {
				const flex = view.modelBuilder.flexContainer()
					.withItems([
						view.modelBuilder.text()
							.withProps({ value: this._errorLabel, CSSStyles: { 'margin': '0px 0px 5px 5px' } })
							.component(),
						view.modelBuilder.inputBox()
							.withProps({
								value: this._errorDescription,
								readOnly: true,
								multiline: true,
								height: 400,
								inputType: 'text',
								display: 'inline-block',
								CSSStyles: { 'overflow': 'hidden auto', 'margin': '0px 0px 0px 5px' },
							})
							.component()])
					.withLayout({ flexFlow: 'column', width: 420, })
					.withProps({ CSSStyles: { 'margin': '0 10px 0 10px' } })
					.component();

				await view.initializeModel(flex);
			});

			const dialog = azdata.window.createModelViewDialog(
				this._errorTitle,
				'errorDialog',
				450,
				'flyout');
			dialog.content = [tab];
			dialog.okButton.label = loc.CLEAR;
			dialog.okButton.focused = true;
			dialog.okButton.position = 'left';
			dialog.cancelButton.label = loc.CLOSE;
			dialog.cancelButton.position = 'left';
			this._context.subscriptions.push(
				dialog.onClosed(async e => {
					if (e === 'ok') {
						await this.clearError();
					}
					this._errorDialogIsOpen = false;
				}));

			azdata.window.openDialog(dialog);
		} catch (error) {
			this._errorDialogIsOpen = false;
		}
	}

	private async _updateStatusDisplay(control: azdata.Component, visible: boolean): Promise<void> {
		await control.updateCssStyles({ 'display': visible ? 'inline' : 'none' });
	}
}
