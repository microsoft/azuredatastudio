/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
// import * as azdata from 'azdata'
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';
import * as constants from './constants';

// Language localization features
import * as nls from 'vscode-nls';


// The module 'openai' contains the OpenAI API
import { Configuration, OpenAIApi } from "openai";

const localize = nls.loadMessageBundle();

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


export async function generateMarkdown(context: azdata.ObjectExplorerContext): Promise<string> {
	const azdata = getAzdataApi();

	let connection = (await azdata.connection.getCurrentConnection());
	let databaseName = context.connectionProfile.databaseName;

	let tables: string[];
	if (context.nodeInfo.nodeType === 'Table') {
		tables = [context.nodeInfo.metadata.name];
	}
	else {
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
		const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
		let query = `SELECT TABLE_NAME FROM [${databaseName}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;

		if (context.nodeInfo.nodeType === 'Schema') {
			query += ` AND TABLE_SCHEMA = '${context.nodeInfo.metadata.name}'`;
		}

		tables = (await queryProvider.runQueryAndReturn(connectionUri, query)).rows.map(row => row[0].displayValue);
	}

	let diagram = '```mermaid\nclassDiagram\n';
	let references = ``;
	let documentation = ``;
	for (let i = 0; i < tables.length; i++) {
		const tableAttributes = await tableToText(connection, databaseName, tables[i]);
		const tableResult = getMermaidDiagramForTable(tables[i], tableAttributes);
		diagram += tableResult[0] + `\n`;
		if (context.nodeInfo.nodeType !== 'Table') {
			references += tableResult[1];
		}
		documentation += await getDocumentationText(tables[i], tableAttributes);
	}

	diagram += references;

	return diagram + '```  \n\n' + documentation;
}

export async function tableToText(connection: azdata.connection.ConnectionProfile, databaseName: string, tableName: string): Promise<[string, string, string][]> {
	const azdata = getAzdataApi();

	let queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

	let connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
	let baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${databaseName}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`;
	let referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM [${databaseName}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${tableName}'`;

	let result = await queryProvider.runQueryAndReturn(connectionUri, baseQuery);
	let tempResult = await queryProvider.runQueryAndReturn(connectionUri, referenceQuery);

	let tableAttributes: [string, string, string][] = [];

	for (let i = 0; i < result.rowCount; i++) {
		const row = result.rows[i];
		const matchingRow = tempResult.rows.find(tempRow => tempRow[0].displayValue === row[0].displayValue);
		const str = matchingRow ? matchingRow[1].displayValue : null;

		if (str && str.substring(0, 2) === "PK") {
			row[1].displayValue = "+ " + row[1].displayValue;
			tableAttributes.push([row[0].displayValue, row[1].displayValue, null]);
		}
		else if (str && str.substring(0, 2) === "FK") {
			const reference = str.substring(str.lastIndexOf("_") + 1);
			tableAttributes.push([row[0].displayValue, row[1].displayValue, reference]);
		}
		else {
			tableAttributes.push([row[0].displayValue, row[1].displayValue, null]);
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
		if (tableAttributes[i][2] && tableName !== tableAttributes[i][2]) {
			references += `${tableName} --> ${tableAttributes[i][2]}\n`;
		}
	}

	diagram += `\t}\n`;

	return [diagram, references];
}

export async function getDocumentationText(tableName: string, tableAttributes: [string, string, string][]): Promise<string> {
	let key = vscode.workspace.getConfiguration("openAI").get<string>("apiKey");

	vscode.window.showInformationMessage("Starting API query")

	const configuration = new Configuration({
		apiKey: key, // Replace with actual key/ set up some config for it
	});

	vscode.window.showInformationMessage("Setting up config");

	const openai = new OpenAIApi(configuration);

	const columnNames = tableAttributes.map(row => row[0]);

	const overviewPrompt = localize("database-documentation.overviewPrompt",
		`One sentence overview of this table, based on table name. Max 25 words.  \n
	Format your answer so that each line is at most 150 cols long. When you need to use a newline, use two spaces instead.  \n
	Table: ${tableName} Columns: `) + JSON.stringify(columnNames);

	const fieldsPrompt = localize("database-documentation.fieldsPrompt",
		`Give an description for each field below. If the datatype has a preceding +, the field is the primary key.  \n
	Do not include the + in the datatype description. Include two spaces at the end of each description for  \n
	formatting purposes.  \n
	Format your answer exactly like so:  \n
	\t•\t<Field Name>: <Field Description, min 20 words>  \t•\t<Field Name>: <Field Description, min 20 words>
	\nFor the bullet point, use \u2022  \n
	Fields: Name, datatype, Table it references  \n`) + JSON.stringify(tableAttributes);

	const relationshipsPrompt = localize("database-documentation.relationshipPrompt",
		`Given the above ${tableName} table, write a detailed description of the relationship it has with other tables,
	ie. which tables it has relationships with, the relationship type (one-to-one, one-to-many), which fields it references, etc.
	Format your answer so that each line is at most 150 cols long. When you need to use a newline, use two spaces followed by \u000D instead.`)

	try {

		vscode.window.showInformationMessage("Attempting overview");

		const overviewResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': overviewPrompt }],
				temperature: 0
			})

		let overviewResult = overviewResponse.data.choices[0].message.content;

		vscode.window.showInformationMessage("Attempting fields");

		const fieldsResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': fieldsPrompt }],
				temperature: 0
			})

		let fieldsResult = fieldsResponse.data.choices[0].message.content;

		vscode.window.showInformationMessage("Attempting relationship");

		const relationshipsResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': relationshipsPrompt }],
				temperature: 0
			})

		let relationshipsResult = relationshipsResponse.data.choices[0].message.content;

		return localize("database-documentation.generatedDocumentation", `### ${tableName}  \n**Overview**  \n${overviewResult}  \n\n**Fields**  \n${fieldsResult}  \n\n**Relationships**  \n${relationshipsResult}`);;
	}
	catch (error) {
		vscode.window.showInformationMessage("Error:" + error.message);
		return error.message;
	}
}

export function getDatabaseFromNode(node: vscodeMssql.ITreeNodeInfo): vscodeMssql.ITreeNodeInfo {
	while (node.nodeType != 'Database') {
		node = node.parentNode;
	}
	return node;
}

