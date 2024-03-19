/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IconPathHelper } from '../../constants/iconPathHelper';

const DialogName = 'LoginPreMigrationValidationDialog';

export class LoginPreMigrationValidationDialog {
	private _dialog: azdata.window.Dialog | undefined;
	private _isOpen: boolean = false;

	private _resultsTable!: azdata.TableComponent;
	private _startButton!: azdata.ButtonComponent;
	private _revalidationButton!: azdata.ButtonComponent;
	private _cancelButton!: azdata.ButtonComponent;
	private _copyButton!: azdata.ButtonComponent;

	private _disposables: vscode.Disposable[] = [];

	private async _initializeDialog(dialog: azdata.window.Dialog): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			dialog.registerContent(async (view) => {
				try {
					const flex = await this.createContainer(view);

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

	private async createContainer(_view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const container = _view.modelBuilder.flexContainer()
			.withProps(
				{ CSSStyles: { 'margin': '8px 16px', 'flex-direction': 'column' } })
			.component();

		this._resultsTable = await this._createResultsTable(_view);

		container.addItem(this.createValidationControlsToolbar(_view), { flex: '0 0 auto' });
		container.addItem(this._resultsTable, { flex: '0 0 auto' });
		return container;
	}

	private createValidationControlsToolbar(_view: azdata.ModelView): azdata.ToolbarContainer {
		this._startButton = _view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.restartDataCollection,
				iconHeight: 18,
				iconWidth: 18,
				label: "Start validation",
			}).component();

		this._cancelButton = _view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.stop,
				iconHeight: 18,
				iconWidth: 18,
				label: "Stop validation",
				enabled: false,
			}).component();

		this._revalidationButton = _view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.redo,
				iconHeight: 18,
				iconWidth: 18,
				label: "Revalidate failed steps",
				enabled: false,
			}).component();

		this._copyButton = _view.modelBuilder.button()
			.withProps({
				iconPath: IconPathHelper.copy,
				iconHeight: 18,
				iconWidth: 18,
				label: "Copy details",
				enabled: false,
			}).component();

		const toolbar = _view.modelBuilder.toolbarContainer()
			.withToolbarItems([
				{ component: this._startButton },
				{ component: this._cancelButton },
				{ component: this._revalidationButton },
				{ component: this._copyButton }])
			.component();

		return toolbar;
	}

	private async _createResultsTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		return view.modelBuilder.table()
			.withProps({
				columns: [
					{
						value: 'test',
						name: "Validation steps",
						type: azdata.ColumnType.text,
						width: 380,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'image',
						name: '',
						type: azdata.ColumnType.icon,
						width: 20,
						headerCssClass: 'no-borders display-none',
						cssClass: 'no-borders align-with-header',
					},
					{
						value: 'message',
						name: "Status",
						type: azdata.ColumnType.text,
						width: 150,
						headerCssClass: 'no-borders',
						cssClass: 'no-borders align-with-header',
					},
				],
				data: [],
				width: 580,
				height: 300,
				CSSStyles: {
					'margin-top': '10px',
					'margin-bottom': '10px',
				},
			})
			.component();
	}
}
