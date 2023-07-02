/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata'
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { Configuration, OpenAIApi } from "openai";

const localize = nls.loadMessageBundle();
let connection: azdata.connection.ConnectionProfile;
let context: azdata.ObjectExplorerContext;
let version: number;
let document: vscode.TextDocument;

export async function setContextVariables(extensionContext: azdata.ObjectExplorerContext, extensionConnection: azdata.connection.ConnectionProfile, docsVersion: number, extensionDocument: vscode.TextDocument) {
	context = extensionContext;
	connection = extensionConnection;
	version = docsVersion;
	document = extensionDocument;
}

export function getContextVariables(): [azdata.ObjectExplorerContext, azdata.connection.ConnectionProfile, number, vscode.TextDocument] {
	return [context, connection, version, document];
}


export async function generateMarkdown(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile): Promise<string> {
	const databaseName = context.connectionProfile!.databaseName;

	let tables: string[] = [];
	let views: string[] = [];
	if (context.nodeInfo.nodeType === 'Table') {
		tables = [context.nodeInfo.metadata.name];
	}
	else if (context.nodeInfo.nodeType === 'View') {
		views = [context.nodeInfo.metadata.name]
	}
	else {
		const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
		const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

		let tableQuery = `SELECT TABLE_NAME FROM [${validate(databaseName)}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
		let viewQuery = `SELECT TABLE_NAME FROM [${validate(databaseName)}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'VIEW'`;

		if (context.nodeInfo.nodeType === 'Schema') {
			tableQuery += ` AND TABLE_SCHEMA = '${validate(context.nodeInfo.metadata.name)}'`;
			viewQuery += ` AND TABLE_SCHEMA = '${validate(context.nodeInfo.metadata.name)}'`;
		}

		tables = (await queryProvider.runQueryAndReturn(connectionUri, tableQuery)).rows.map(row => row[0].displayValue);
		views = (await queryProvider.runQueryAndReturn(connectionUri, viewQuery)).rows.map(row => row[0].displayValue);
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
		vscode.window.showInformationMessage("Getting documentation for " + tables[i]);
		documentation += await getDocumentationText(tables[i], tableAttributes, 'Table');
	}
	for (let i = 0; i < views.length; i++) {
		const tableAttributes = await tableToText(connection, databaseName, views[i]);
		const tableResult = getMermaidDiagramForTable(views[i], tableAttributes);
		diagram += tableResult[0] + `\n`;
		if (context.nodeInfo.nodeType !== 'View') {
			references += tableResult[1];
		}
		vscode.window.showInformationMessage("Getting documentation for " + views[i]);
		documentation += await getDocumentationText(views[i], tableAttributes, 'View');
	}

	diagram += references;

	return diagram + '```  \n\n' + documentation;
}

async function tableToText(connection: azdata.connection.ConnectionProfile, databaseName: string, tableName: string): Promise<[string, string, string][]> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
	const baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${validate(databaseName)}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${validate(tableName)}'`;
	const referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME FROM [${validate(databaseName)}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${validate(tableName)}'`;

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

function getMermaidDiagramForTable(tableName: string, tableAttributes: [string, string, string][]): [string, string] {
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

async function getDocumentationText(tableName: string, tableAttributes: [string, string, string][], type: string): Promise<string> {
	let key = await getOpenApiKey();

	const configuration = new Configuration({
		apiKey: key, // Replace with actual key/ set up some config for it
	});

	const openai = new OpenAIApi(configuration);

	const columnNames = tableAttributes.map(row => row[0]);

	const prompt = localize("database-documentation.prompt",
		`One sentence overview of this ${type}, based on ${type} name. Max 25 words.\n
		When you need to use a newline, use two spaces instead.\n
		${type}: ${tableName} Columns: ${JSON.stringify(columnNames)}\n
		\n
		Give an description for each field below. If the datatype has a preceding +, the field is the primary key.\n
		Do not include the + in the datatype description. Include two spaces at the end of each description for formatting purposes.\n
		Format your answer exactly like so:\n
		- <Field Name>: <Field Description, min 20 words>  \n
		- <Field Name>: <Field Description, min 20 words>  \n
		\n
		Fields: Name, datatype, Table it references
		${JSON.stringify(tableAttributes)}\n
		\n
		Given the above ${tableName} ${type}, write a detailed description of the relationship it has with other tables/views,\n
		ie. which tables/views it has relationships with, the relationship type (one-to-one, one-to-many), which fields it references, etc.\n
		If there are no relationships existing, as indicated by nulls, do not mention the nulls. Just say there are no existing relationships.\n
		When you need to use a newline, use two spaces followed by \\n instead.\n
		\n
		Overall your resulting answer should be formatted like so. Give the answer in formatted markdown:
		\n
		**Overview**  \n<One sentence overview of the table>  \n
		\n
		**Fields**  \n- <Field Name>: <Field Description, min 20 words>  \n
		- <Field Name>: <Field Description, min 20 words>  \n
		\n
		**Relationships**  \n<Relationships Description>`);

	try {
		vscode.window.showInformationMessage("Awaiting API response...");
		const promptResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': prompt }],
				temperature: 0
			})
		vscode.window.showInformationMessage("Got API response!");
		return `### ${tableName}  \n` + promptResponse.data.choices[0].message.content + '  \n\n';
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
		`SELECT [Version],[Markdown] FROM [master].[db_documentation].[DatabaseDocumentation] WHERE [ObjectName] = '${validate(context.nodeInfo.metadata.name)}'`);

	if (objectExists.rowCount) {
		return [parseInt(objectExists.rows[0][0].displayValue), objectExists.rows[0][1].displayValue];
	}
	// Otherwise, insert new entry into table
	else {
		const insertQuery = `
		INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
		VALUES ('${validate(context.nodeInfo.metadata.name)}', ${0}, '', '');\n
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

	// New version, markdown, and markdown JSON are all generated by this extension
	const updateQuery = `
	UPDATE [db_documentation].[DatabaseDocumentation]
	SET [Version] = ${newVersion}, [Markdown] = '${validate(markdown)}', [JSONMarkdown] = '${validate(markdownJSON)}' WHERE [ObjectName] = '${validate(context.nodeInfo.metadata.name)}';
	`

	// Update data in table
	await queryProvider.runQueryString(connectionUri, updateQuery);

	const nodeType = context.nodeInfo.nodeType;

	if (nodeType === 'Database' || nodeType === 'Schema') {
		const objectNamesQuery = `SELECT [ObjectName] FROM [master].[db_documentation].[DatabaseDocumentation]`;

		let objectNamesResult = await queryProvider.runQueryAndReturn(connectionUri, objectNamesQuery);

		let objectNames = new Set([]);
		if (objectNamesResult.rowCount) {
			objectNames = new Set(objectNamesResult.rows.map(row => row[0].displayValue));
		}

		const json = JSON.parse(markdownJSON);

		const mermaid = json['Mermaid'];
		const text = json['Text'];

		const keys = Object.keys(text);

		let insertQuery = '';
		for (let i = 0; i < keys.length; i++) {
			const tableName = keys[i]
			if (!objectNames.has(tableName)) {
				const regex = new RegExp(`\\tclass ${tableName}[\\s\\S]*?\\t}\\n`, 'g');
				const matches = mermaid.match(regex);

				const tableMermaid = '```mermaid\nclassDiagram\n' + matches[0] + '```  \n\n';

				const fields = text[tableName]['Fields'];
				let fieldsText = '';
				for (const fieldName in fields) {
					fieldsText += `- ${fieldName}: ${fields[fieldName]}  \n`;
				}

				const tableText = `### ${tableName}  \n**Overview**  \n${text[tableName]['Overview']}  \n\n**Fields**  \n${fieldsText}  \n**Relationships**  \n${text[tableName]['Relationships']}`;
				const tableMarkdown = tableMermaid + tableText;

				const tableJson: any = {
					"Mermaid": tableMermaid,
					"Text": {}
				};
				tableJson['Text'][tableName] = text[tableName];
				const tableMarkdownJSON = JSON.stringify(tableJson);

				insertQuery += `
				INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
				VALUES ('${validate(keys[i])}', ${1}, '${validate(tableMarkdown)}', '${validate(tableMarkdownJSON)}');\n
				`
			}
		}

		// Insert data into table
		await queryProvider.runQueryString(connectionUri, insertQuery);
	}
}

async function getOpenApiKey(): Promise<string> {
	const configuration = vscode.workspace.getConfiguration('openAI');
	let apiKey = await configuration.get<string>('apiKey');

	if (!apiKey || apiKey == '') {
		apiKey = await vscode.window.showInputBox({
			prompt: localize('database-documentation.apiKeyPrompt', 'Please enter your OpenAI API key'),
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

// TODO: Take in a numbe of objects to compare to
export function convertMarkdownToJSON(markdown: string): string {
	const lines = markdown.split('\n');
	const json: any = {};

	let regex = /```mermaid[\s\S]*?```/g
	let match = markdown.match(regex);
	if (!match) {
		throw new Error("Mermaid code isn't formatted correctly");
	}
	const mermaid = match[0];

	const expectedValue = mermaid.match(/class /g).length;

	json['Mermaid'] = mermaid;
	json['Text'] = {};

	let currentKey = '';

	let objectNameCount = 0;
	let overviewCount = 0;
	let fieldsCount = 0;
	let relationshipsCount = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.startsWith('### ')) {
			currentKey = line.substring(4).trim();
			json['Text'][currentKey] = {
				Overview: '',
				Fields: {},
				Relationships: ''
			};
			objectNameCount++;
		}
		else if (line.startsWith('**Overview**')) {
			let overview = '';
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j];
				if (nextLine.startsWith('**Fields**')) {
					fieldsCount++;
					break;
				}
				i++;
				overview += nextLine;
			}
			// Get all lines until line **Fields**
			json['Text'][currentKey].Overview = overview;
			overviewCount++;
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
				relationships += nextLine;
			}
			json['Text'][currentKey].Relationships = relationships;
			relationshipsCount++;
		}
	}

	console.log(objectNameCount + fieldsCount + overviewCount + relationshipsCount + expectedValue);

	if (objectNameCount !== expectedValue || fieldsCount !== expectedValue || overviewCount !== expectedValue || relationshipsCount !== expectedValue) {
		throw new Error(`
			Documentation is not formatted correctly.\n
			Expected ${expectedValue} of headers.\n
			Instead there are:\n
			- ${objectNameCount} objects stored, ie. ### <Object Name>\n
			- ${overviewCount} overview headers stored, ie. **Overview**\n
			- ${fieldsCount} field headers stored, ie. **Fields**\n
			- ${relationshipsCount} relationship headers stored, ie. **Relationships**\n
			\n
			Make sure the format of your documentation follows:\n
			### <Object Name>\n
			**Overview**\n
			<Overview Text>\n
			**Fields**\n
			- <Field Name>: Field Description\n
			**Relationships**\n
			<Object Relationships Description>
		`);
	}

	return JSON.stringify(json);
}

function validate(input: string): string {
	// Escape single quotes by doubling them
	const escapedQuotes = input.replace(/'/g, "''");

	// Escape brackets by doubling them
	const escapedBrackets = escapedQuotes.replace(/\[/g, '[[').replace(/\]/g, ']]');

	// Remove semicolons
	const sanitizedSemicolons = escapedBrackets.replace(/;/g, '');

	// Remove SQL comments
	const sanitizedComments = sanitizedSemicolons.replace(/--/g, '').replace(/\/\*/g, '').replace(/\*\//g, '');

	// Remove potentially harmful SQL keywords
	const sanitizedKeywords = sanitizedComments.replace(/\b(xp_)\w+\b/g, '');

	return sanitizedKeywords;
}


