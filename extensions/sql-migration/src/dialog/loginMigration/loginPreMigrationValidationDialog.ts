/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

const DialogName = 'LoginPreMigrationValidationDialog';

export class LoginPreMigrationValidationDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _disposables: vscode.Disposable[] = [];

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = this.createContainer(view);

					this._disposables.push(
						view.onClosed(e =>
							this._disposables.forEach(
								d => { try { d.dispose(); } catch { } })));

					await view.initializeModel(flex);

					resolve();
				} catch (ex) {
					reject(ex);
				}
			});
		});
	}

	public async openDialog(dialogTitle: string = "Running Validation"): Promise<void> {
		if (!this._isOpen) {
			this._isOpen = true;
			this._dialog = azdata.window.createModelViewDialog(
				dialogTitle,
				DialogName,
				600);

			const promise = this._initializeDialog(this._dialog);
			azdata.window.openDialog(this._dialog);
			await promise;

			return;
		}
	}

	private createContainer(_view: azdata.ModelView): azdata.FlexContainer {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'margin': '8px 16px', 'flex-direction': 'column' } })
			.component();

		return container;
	}

	// private createValidation {
	// const toolbar = view.modelBuilder.toolbarContainer()
	// 	.withToolbarItems([
	// 		{ component: this._startButton },
	// 		{ component: this._cancelButton },
	// 		{ component: this._revalidationButton },
	// 		{ component: this._copyButton }])
	// 	.component();
}
