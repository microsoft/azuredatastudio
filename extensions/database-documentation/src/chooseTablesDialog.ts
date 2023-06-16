/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import * as utils from './common/utils';

import * as vscode from 'vscode';
import { AddTablesDialog } from './addTablesDialog';

// TODO: localize

interface Deferred<T> {
	resolve: (result: T | Promise<T>) => void;
	reject: (reason: any) => void;
}

export class ChooseTablesDialog {
	// Azdata api
	private azdata = utils.getAzdataApi();

	// Dialog variables
	public dialog: azdata.window.Dialog;
	public dialogName: string = "Choose Tables to Document";
	private chooseTablesTab: azdata.window.DialogTab;
	private chosenTablesTable: azdata.TableComponent;
	private addTablesButton: azdata.ButtonComponent;
	private removeTablesButton: azdata.ButtonComponent;
	private chosenTables: string[][];
	private availableTables: string[][];
	private rowConst: number = 30;

	// Context variables
	private databaseName: string;
	private connection: azdata.connection.ConnectionProfile;
	private queryProvider: azdata.QueryProvider;

	// Dialog misc.
	private toDispose: vscode.Disposable[] = [];
	private initDialogComplete: Deferred<void>;
	private initDialogPromise: Promise<void> = new Promise<void>((resolve, reject) => this.initDialogComplete = { resolve, reject });

	// Dialog events
	private _onSuccess: vscode.EventEmitter<string[]> = new vscode.EventEmitter<string[]>();
	public readonly onSuccess: vscode.Event<string[]> = this._onSuccess.event;

	constructor(connection: azdata.connection.ConnectionProfile, databaseName: string) {
		this.connection = connection;
		this.databaseName = databaseName;

		this.queryProvider = this.azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", this.azdata.DataProviderType.QueryProvider);

		this.dialog = this.azdata.window.createModelViewDialog(this.dialogName);
		this.dialog.registerCloseValidator(async () => {
			return true;
		});
	}

	public async openDialog(): Promise<void> {

		this.dialog = this.azdata.window.createModelViewDialog(this.dialogName);

		this.chooseTablesTab = this.azdata.window.createTab(this.dialogName);
		await this.initializeChooseTablesTab();
		this.dialog.content = [this.chooseTablesTab];

		this.dialog.okButton.label = "OK";
		this.dialog.okButton.enabled = true;
		this.toDispose.push(this.dialog.okButton.onClick(async () => await this.handleOkButtonClick()));

		this.dialog.cancelButton.label = "Cancel";
		this.toDispose.push(this.dialog.cancelButton.onClick(async () => await this.cancel()));

		this.azdata.window.openDialog(this.dialog);
		await this.initDialogPromise;
	}

	public async handleOkButtonClick(): Promise<void> {
		const result = this.chosenTables.reduce((res, tableItem) => res.concat(tableItem), []);
		this._onSuccess.fire(result);
		this.cancel();
	}

	protected async cancel(): Promise<void> {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	private async initializeChooseTablesTab(): Promise<void> {
		this.chooseTablesTab.registerContent(async view => {

			let connectionUri = await this.azdata.connection.getUriForConnection(this.connection.connectionId);

			let query = `SELECT TABLE_NAME FROM [${this.databaseName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
			let result = await this.queryProvider.runQueryAndReturn(connectionUri, query);

			if (result.columnInfo[0].columnName === 'ErrorMessage') {
				throw new Error(result.rows[0][0].displayValue);
			}

			this.chosenTables = result.rows.map(row => [row[0].displayValue]);
			this.chosenTables.sort((a, b) => a[0].localeCompare(b[0]));
			this.availableTables = [];
			const tableLength = this.chosenTables.length * this.rowConst;

			this.chosenTablesTable = view.modelBuilder.table()
				.withProps({
					columns: [
						"Table Name",
					],
					data: this.chosenTables,
					height: tableLength,
					width: 420
				}).component();


			this.addTablesButton = view.modelBuilder.button()
				.withProps({
					label: "Add Table",
					width: 110,
					secondary: true
				}).component();

			this.addTablesButton.onDidClick(async () => {
				if (this.availableTables.length !== 0) {
					let addTablesDialog = new AddTablesDialog(this.availableTables);
					await addTablesDialog.openDialog();

					addTablesDialog.onSuccess((index) => {
						const addedTable = this.availableTables.splice(index, 1)[0];

						let insertionIndex = -1;
						for (let i = 0; i < this.chosenTables.length; i++) {
							if (addedTable[0].localeCompare(this.chosenTables[i][0]) < 0) {
								insertionIndex = i;
								break;
							}
						}

						if (insertionIndex === -1) {
							this.chosenTables.push(addedTable);
						}
						else {
							this.chosenTables.splice(insertionIndex, 0, addedTable);
						}

						const updatedHeight = this.chosenTables.length * this.rowConst;

						// Update the table data and height
						this.chosenTablesTable.updateProperties({
							data: this.chosenTables,
							height: updatedHeight
						});

					})
				}
				else {
					vscode.window.showInformationMessage("No available tables to choose from!");
				}
			});

			this.removeTablesButton = view.modelBuilder.button()
				.withProps({
					label: "Remove Table",
					width: 110,
					secondary: true
				}).component();

			this.removeTablesButton.onDidClick(() => {
				const selectedRow = this.chosenTablesTable.selectedRows[0];

				// Remove the selected row from the table data, and add it to avaiable tables
				this.availableTables.push(this.chosenTables.splice(selectedRow, 1)[0]);
				this.availableTables.sort((a, b) => a[0].localeCompare(b[0]));

				const updatedHeight = this.chosenTables.length * this.rowConst;

				// Update the table data and height
				this.chosenTablesTable.updateProperties({
					data: this.chosenTables,
					height: updatedHeight
				});

			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([
					{
						title: "Current Chosen Tables",
						components: [
							{
								component: this.chosenTablesTable,
								actions: [this.addTablesButton, this.removeTablesButton]
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
