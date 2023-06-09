/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

export class Utils {
	private databaseName: string;
	private tables: string[];
	private connection: azdata.connection.ConnectionProfile;
	private queryProvider: azdata.QueryProvider;

	constructor(connection: azdata.connection.ConnectionProfile, databaseName: string, tables: string[]) {
		this.connection = connection;
		this.databaseName = databaseName;
		this.tables = tables;

		this.queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	}

	public async generateMarkdown(): Promise<string> {

		let diagram = `classDiagram\n`
		let references = ``;
		for (let i = 0; i < this.tables.length; i++) {
			const tableAttributes = await this.tableToText(this.tables[i]);
			const result = this.getMermaidDiagramForTable(this.tables[i], tableAttributes);
			diagram += result[0] + `\n`;
			references += result[1];
		}

		diagram += references;

		let document = await vscode.workspace.openTextDocument({ language: "markdown", content: diagram });
		vscode.window.showTextDocument(document);

		return "";
	}

	private async tableToText(tableName: string): Promise<[string, string, string][]> {

		let connectionUri = await azdata.connection.getUriForConnection(this.connection.connectionId);

		let baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${this.databaseName}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`;
		let referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM [${this.databaseName}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME LIKE 'FK%'`;

		let result = await this.queryProvider.runQueryAndReturn(connectionUri, baseQuery);
		if (result.columnInfo[0].columnName === 'ErrorMessage') {
			throw new Error(result.rows[0][0].displayValue);
		}

		let tempResult = await this.queryProvider.runQueryAndReturn(connectionUri, referenceQuery);
		if (tempResult.columnInfo[0].columnName === 'ErrorMessage') {
			throw new Error(tempResult.rows[0][0].displayValue);
		}

		let tableAttributes: [string, string, string][] = [];

		for (let i = 0; i < result.rowCount; i++) {
			if (tempResult.rowCount !== 0) {
				for (let j = 0; j < tempResult.rowCount; j++) {
					if (result.rows[i][0].displayValue === tempResult.rows[j][0].displayValue) {
						const str = tempResult.rows[j][1].displayValue;
						const reference = str.substring(str.lastIndexOf("_") + 1);
						tableAttributes.push([result.rows[i][0].displayValue, result.rows[i][1].displayValue, reference]);
						break;
					}
					if (j === tempResult.rowCount - 1) {
						tableAttributes.push([result.rows[i][0].displayValue, result.rows[i][1].displayValue, null]);
					}
				}
			}
			else {
				tableAttributes.push([result.rows[i][0].displayValue, result.rows[i][1].displayValue, null]);
			}
		}

		// Use tableAttributes to locally make mermaid diagram
		return tableAttributes;
	}


	private getMermaidDiagramForTable(tableName: string, tableAttributes: [string, string, string][]): [string, string] {
		let diagram = `\tclass ${tableName} {\n`;
		let references = ``;

		for (let i = 0; i < tableAttributes.length; i++) {
			diagram += `\t\t${tableAttributes[i][1]} ${tableAttributes[i][0]}\n`
			if (tableAttributes[i][2] && tableName !== tableAttributes[i][2] && this.tables.includes(tableAttributes[i][2])) {
				references += `${tableName} --> ${tableAttributes[i][2]}\n`;
			}
		}

		diagram += `\t}\n`;

		// Save diagram to documentation table
		let save = `classDiagram\n` + diagram;

		return [diagram, references];
	}

}
