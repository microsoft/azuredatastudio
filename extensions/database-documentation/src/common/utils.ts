/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata'
import * as vscode from 'vscode';
import * as fs from 'fs';
// Language localization features
import * as nls from 'vscode-nls';
// The module 'openai' contains the OpenAI API
import { Configuration, OpenAIApi } from "openai";

const localize = nls.loadMessageBundle();

export async function generateMarkdown(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile): Promise<string> {
	const databaseName = context.connectionProfile.databaseName;

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
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
	const baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${databaseName}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'`;
	const referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM [${databaseName}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${tableName}'`;

	const baseResult = await queryProvider.runQueryAndReturn(connectionUri, baseQuery);
	const referenceResult = await queryProvider.runQueryAndReturn(connectionUri, referenceQuery);

	let tableAttributes: [string, string, string][] = [];

	for (let i = 0; i < baseResult.rowCount; i++) {
		const row = baseResult.rows[i];
		const matchingRow = referenceResult.rows.find(referenceRow => referenceRow[0].displayValue === row[0].displayValue);
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
	let key = await getOpenApiKey();

	const configuration = new Configuration({
		apiKey: key, // Replace with actual key/ set up some config for it
	});

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
	 - <Field Name>: <Field Description, min 20 words>   - <Field Name>: <Field Description, min 20 words>
	\nFields: Name, datatype, Table it references  \n`) + JSON.stringify(tableAttributes);

	const relationshipsPrompt = localize("database-documentation.relationshipPrompt",
		`Given the above ${tableName} table, write a detailed description of the relationship it has with other tables,
	ie. which tables it has relationships with, the relationship type (one-to-one, one-to-many), which fields it references, etc.
	Format your answer so that each line is at most 150 cols long. When you need to use a newline, use two spaces followed by \u000D instead.`)

	try {

		const overviewResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': overviewPrompt }],
				temperature: 0
			})

		const overviewResult = overviewResponse.data.choices[0].message.content;

		const fieldsResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': fieldsPrompt }],
				temperature: 0
			})

		const fieldsResult = fieldsResponse.data.choices[0].message.content;

		const relationshipsResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': relationshipsPrompt }],
				temperature: 0
			})

		const relationshipsResult = relationshipsResponse.data.choices[0].message.content;

		return localize("database-documentation.generatedDocumentation", `### ${tableName}  \n**Overview**  \n${overviewResult}  \n\n**Fields**  \n${fieldsResult}  \n\n**Relationships**  \n${relationshipsResult}`);;
	}
	catch (error) {
		vscode.window.showInformationMessage("Error:" + error.message);
		return error.message;
	}
}

export async function setupGeneration(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile): Promise<[number, string]> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	// Try to get schema
	const schemaExists = await queryProvider.runQueryAndReturn(connectionUri,
		`SELECT schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'db_documentation';`);

	// If schema does not exist, create the schema
	if (!schemaExists.rowCount) {
		await queryProvider.runQueryString(connectionUri, `CREATE SCHEMA db_documentation`);
	}

	const tableExists = await queryProvider.runQueryAndReturn(connectionUri,
		`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DatabaseDocumentation'`);

	// If table does not exist, create it
	if (!tableExists.rowCount) {
		// Create table
		const createTableQuery = `
		CREATE TABLE [db_documentation].[DatabaseDocumentation] (\n
		\t[ObjectName]    NVARCHAR(50) NOT NULL,\n
		\t[Version]   INT NOT NULL,\n
		\t[Markdown]   NVARCHAR(MAX) NOT NULL,\n
		\t[JSONMarkdown]  NVARCHAR(MAX) NOT NULL,\n
		);
		`
		await queryProvider.runQueryString(connectionUri, createTableQuery);
	}

	// Same deal; if an entry with the ObjectName already exists, get it's version and markdown to show,
	// otherwise, put it into the table for future use
	const objectExists = await queryProvider.runQueryAndReturn(connectionUri,
		`SELECT [Version],[Markdown] FROM [master].[db_documentation].[DatabaseDocumentation] WHERE [ObjectName] = '${context.nodeInfo.metadata.name}'`);

	if (objectExists.rowCount) {
		return [parseInt(objectExists.rows[0][0].displayValue), objectExists.rows[0][1].displayValue];
	}
	// Otherwise, insert new entry into table
	else {
		const insertQuery = `
		INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
		VALUES ('${context.nodeInfo.metadata.name}', ${0}, '', '');\n
		`
		// Insert data into table
		await queryProvider.runQueryString(connectionUri, insertQuery);

		return [0, ""];
	}
}

export async function saveMarkdown(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile, version: number, markdown: string, markdownJSON: string): Promise<void> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	// Set updated version of object
	const newVersion = version + 1;

	vscode.window.showInformationMessage("Updated Version: " + newVersion.toString())

	const updateQuery = `
	UPDATE [db_documentation].[DatabaseDocumentation]
	SET [Version] = ${newVersion}, [Markdown] = '${markdown}', [JSONMarkdown] = '${markdownJSON}' WHERE [ObjectName] = '${context.nodeInfo.metadata.name}';
	`
	// Update data in table
	await queryProvider.runQueryString(connectionUri, updateQuery);
}

export async function getOpenApiKey(): Promise<string> {
	const configuration = vscode.workspace.getConfiguration('openAI');
	let apiKey = await configuration.get<string>('apiKey');

	if (!apiKey || apiKey == '') {
		apiKey = await vscode.window.showInputBox({
			prompt: 'Please enter your OpenAI API key',
			ignoreFocusOut: true,
		});

		if (apiKey) {
			try {
				await configuration.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
			}
			catch (err) {
			}
		}
	}

	apiKey = await vscode.workspace.getConfiguration("openAI").get<string>("apiKey");

	return apiKey;
}

// TO DO, throw errors if not formatted correctly
export function convertMarkdownToJSON(markdown: string): string {
	const lines = markdown.split('\n');
	const json: any = {};

	let regex = /```mermaid[\s\S]*?```/g;
	let match = markdown.match(regex);
	if (!match) {
		throw new Error("Mermaid code isn't formatted correctly");
	}
	const mermaid = match[0];

	json['Mermaid'] = mermaid;
	json['Text'] = {};

	let currentKey = '';

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith('### ')) {
			currentKey = line.substring(4).trim();
			json['Text'][currentKey] = {
				Overview: '',
				Fields: {},
				Relationships: ''
			};
		}
		else if (line.startsWith('**Overview**')) {
			let overview = '';
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j];
				if (nextLine.startsWith('**Fields**')) {
					break;
				}
				i++;
				overview += nextLine.trim();
			}
			// Get all lines until line **Fields**
			json['Text'][currentKey].Overview = overview;
		}
		else if (line.startsWith('- ')) {
			const fieldName = line.substring(2, line.indexOf(':'));
			const fieldValue = line.substring(line.indexOf(':') + 1).trim();
			json['Text'][currentKey].Fields[fieldName] = fieldValue;
		}
		else if (line.startsWith('**Relationships**')) {
			// Get all lines until either EOF or line that starts with ###
			let relationships = '';
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j];
				if (nextLine.startsWith('### ') || j === lines.length) {
					break;
				}
				i++;
				relationships += nextLine.trim();
			}
			json['Text'][currentKey].Relationships = relationships;
		}
	}

	return JSON.stringify(json);
}

