/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import type * as azdata from 'azdata';
import * as azdata from 'azdata'
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as constants from './constants';

// Try to load the azdata API - but gracefully handle the failure in case we're running
// in a context where the API doesn't exist (such as VS Code)
let azdataApi: typeof azdata | undefined = undefined;
try {
	azdataApi = require('azdata');
	if (!azdataApi?.version) {
		// webpacking makes the require return an empty object instead of throwing an error so make sure we clear the var
		azdataApi = undefined;
	}
} catch {
	// no-op
}

/**
 * Gets the azdata API if it's available in the context this extension is running in.
 * @returns The azdata API if it's available
 */
export function getAzdataApi(): typeof azdata | undefined {
	return azdataApi;
}

export async function getMssqlApi(): Promise<mssql.IExtension> {
	const ext = vscode.extensions.getExtension(mssql.extension.name) as vscode.Extension<mssql.IExtension>;
	console.log((!!ext).toString());
	return ext.activate();
}

export async function generateMarkdown(connection: azdata.connection.ConnectionProfile, databaseName: string): Promise<string> {
	//const azdata = getAzdataApi();

	this.queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

	const connectionUri = await this.azdata.connection.getUriForConnection(this.connection.connectionId);
	// const query = `SELECT TABLE_NAME FROM [${this.databaseName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
	const query = ''
	const tables = (await this.queryProvider.runQueryAndReturn(connectionUri, query)).rows.map(row => [row[0].displayValue]);

	let diagram = `classDiagram\n`
	let references = ``;
	for (let i = 0; i < tables.length; i++) {
		const tableAttributes = await this.tableToText(connection, databaseName, tables[i]);
		const result = this.getMermaidDiagramForTable(tables[i], tableAttributes);
		diagram += result[0] + `\n`;
		references += result[1];
	}

	diagram += references;

	let document = await vscode.workspace.openTextDocument({ language: "markdown", content: diagram });
	vscode.window.showTextDocument(document);

	return "";
}

export async function tableToText(connection: azdata.connection.ConnectionProfile, databaseName: string, tableName: string): Promise<[string, string, string][]> {
	const azdata = getAzdataApi();

	let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	let baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${databaseName}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`;
	let referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM [${databaseName}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${tableName}' AND CONSTRAINT_NAME LIKE 'FK%'`;

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

export function getMermaidDiagramForTable(tableName: string, tableAttributes: [string, string, string][]): [string, string] {
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

export function getDatabaseFromNode(node: vscodeMssql.ITreeNodeInfo): vscodeMssql.ITreeNodeInfo {
	while (node.nodeType != 'Database'){
		node = node.parentNode;
	}
	return node;
}

