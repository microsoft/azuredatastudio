/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ImportPage } from '../api/importPage';
import { InsertDataResponse } from '../../services/contracts';
import * as constants from '../../common/constants';

export class SummaryPage extends ImportPage {
	private _table: azdata.TableComponent;
	private _statusText: azdata.TextComponent;
	private _loading: azdata.LoadingComponent;
	private _form: azdata.FormContainer;

	public get table(): azdata.TableComponent {
		return this._table;
	}

	public set table(table: azdata.TableComponent) {
		this._table = table;
	}

	public get statusText(): azdata.TextComponent {
		return this._statusText;
	}

	public set statusText(statusText: azdata.TextComponent) {
		this._statusText = statusText;
	}

	public get loading(): azdata.LoadingComponent {
		return this._loading;
	}

	public set loading(loading: azdata.LoadingComponent) {
		this._loading = loading;
	}

	public get form(): azdata.FormContainer {
		return this._form;
	}

	public set form(form: azdata.FormContainer) {
		this._form = form;
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().component();
		this.statusText = this.view.modelBuilder.text().component();
		this.loading = this.view.modelBuilder.loadingComponent().withItem(this.statusText).component();

		this.form = this.view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: this.table,
					title: constants.importInformationText
				},
				{
					component: this.loading,
					title: constants.importStatusText
				}
			]
		).component();

		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.loading.loading = true;
		this.populateTable();
		await this.handleImport();
		this.loading.loading = false;
		this.instance.setImportAnotherFileVisibility(true);

		return true;
	}

	async onPageLeave(): Promise<boolean> {
		this.instance.setImportAnotherFileVisibility(false);

		return true;
	}
	public setupNavigationValidator() {
		this.instance.registerNavigationValidator((info) => {
			return !this.loading.loading;
		});
	}

	private populateTable() {
		this.table.updateProperties({
			data: [
				[constants.serverNameText, this.model.server.providerName],
				[constants.databaseText, this.model.database],
				[constants.tableNameText, this.model.table],
				[constants.tableSchemaText, this.model.schema],
				[constants.fileImportText, this.model.filePath]],
			columns: ['Object type', 'Name'],
			width: 600,
			height: 200
		});
	}

	private async handleImport(): Promise<boolean> {
		let changeColumnResults = [];
		this.model.proseColumns.forEach((val, i, arr) => {
			let columnChangeParams = {
				index: i,
				newName: val.columnName,
				newDataType: val.dataType,
				newNullable: val.nullable,
				newInPrimaryKey: val.primaryKey
			};
			changeColumnResults.push(this.provider.sendChangeColumnSettingsRequest(columnChangeParams));
		});

		let result: InsertDataResponse;
		let err;
		let includePasswordInConnectionString = (this.model.server.options.connectionId === 'Integrated') ? false : true;

		try {
			result = await this.provider.sendInsertDataRequest({
				connectionString: await azdata.connection.getConnectionString(this.model.server.connectionId, includePasswordInConnectionString),
				//TODO check what SSMS uses as batch size
				batchSize: 500
			});
		} catch (e) {
			err = e.toString();
		}

		let updateText: string;
		if (!result || !result.result.success) {
			updateText = constants.summaryErrorSymbol;
			if (!result) {
				updateText += err;
			} else {
				updateText += result.result.errorMessage;
			}
		} else {
			// TODO: When sql statements are in, implement this.
			//let rows = await this.getCountRowsInserted();
			//if (rows < 0) {
			updateText = constants.updateText;
			//} else {
			//updateText = localize('flatFileImport.success.rows', '✔ You have successfully inserted {0} rows.', rows);
			//}
		}
		this.statusText.updateProperties({
			value: updateText
		});
		return true;
	}

	// private async getCountRowsInserted(): Promise<Number> {
	// 	let connectionUri = await azdata.connection.getUriForConnection(this.model.server.connectionId);
	// 	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(this.model.server.providerName, azdata.DataProviderType.QueryProvider);
	// 	try {
	// 		let query = sqlstring.format('USE ?; SELECT COUNT(*) FROM ?', [this.model.database, this.model.table]);
	// 		let results = await queryProvider.runQueryAndReturn(connectionUri, query);
	// 		let cell = results.rows[0][0];
	// 		if (!cell || cell.isNull) {
	// 			return -1;
	// 		}
	// 		let numericCell = Number(cell.displayValue);
	// 		if (isNaN(numericCell)) {
	// 			return -1;
	// 		}
	// 		return numericCell;
	// 	} catch (e) {
	// 		return -1;
	// 	}
	// }
}
