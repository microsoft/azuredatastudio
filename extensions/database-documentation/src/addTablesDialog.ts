/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';

// TODO: localize

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class AddTablesDialog {
	// Dialog variables
	public dialog: azdata.window.Dialog;
	public dialogName: string = "Tables";
	private addTablesTable: azdata.TableComponent;
	private availableTables: string[][];

	// Dialog misc.
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	// Dialog events
	private _onSuccess: vscode.EventEmitter<number> = new vscode.EventEmitter<number>();
	public readonly onSuccess: vscode.Event<number> = this._onSuccess.event;

	constructor(availableTables: string[][]) {
		this.availableTables = availableTables;
		this.dialog = azdata.window.createModelViewDialog(this.dialogName);
		this.dialog.registerCloseValidator(async () => {
			return true;
		});
	}

	public async openDialog(): Promise<void> {

		this.dialog = azdata.window.createModelViewDialog(this.dialogName);

		await this.initializeContent();

		this.dialog.okButton.label = "OK";
		this.dialog.okButton.enabled = true;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.handleOkButtonClick()));

		this.dialog.cancelButton.label = "Cancel";
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

		azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	public async handleOkButtonClick(): Promise<void> {
		const sendOver = this.addTablesTable.selectedRows[0]
		this._onSuccess.fire(sendOver);
		this.cancel();
	}

	protected async cancel(): Promise<void> {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private async initializeContent(): Promise<void> {
		this.dialog.registerContent(async view => {

			this.addTablesTable = view.modelBuilder.table()
				.withProps({
					columns: [
						"Table Name",
					],
					data: this.availableTables,
					height: 500,
					width: 420
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: "Tables",
						components: [
							{
								component: this.addTablesTable,
							}
						]
					}
				])
				.withLayout({
					width: '100%',
				}).component();

			await view.initializeModel(formModel);

			this.initDialogComplete.resolve();
		});
	}
}
