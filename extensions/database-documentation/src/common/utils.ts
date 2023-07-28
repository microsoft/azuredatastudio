/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as mssql from 'mssql';
import * as nls from 'vscode-nls';
import { Configuration, OpenAIApi } from "openai";

const localize = nls.loadMessageBundle();
let identificationService: mssql.IIdentificationService;
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

export async function getIdentificationService(): Promise<mssql.IIdentificationService> {
	if (identificationService === null || identificationService === undefined) {
		identificationService = (await vscode.extensions.getExtension(mssql.extension.name).exports as mssql.IExtension).identification;
	}
	return identificationService;
}

export async function generateMarkdown(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile): Promise<string> {
	const databaseName = context.connectionProfile!.databaseName;
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
	const isDatabaseOrSchema = (context.nodeInfo.nodeType === 'Database' || context.nodeInfo.nodeType === 'Schema');

	let tables: [string, string][] = [];
	let views: [string, string][] = [];
	if (isDatabaseOrSchema) {
		let tableQuery = `SELECT TABLE_NAME, TABLE_SCHEMA FROM [${validate(databaseName)}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND NOT TABLE_SCHEMA = 'db_documentation'`;
		let viewQuery = `SELECT TABLE_NAME, TABLE_SCHEMA FROM [${validate(databaseName)}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'VIEW' AND NOT TABLE_SCHEMA = 'db_documentation'`;

		if (context.nodeInfo.nodeType === 'Schema') {
			tableQuery += ` AND TABLE_SCHEMA = '${validate(context.nodeInfo.metadata.name)}'`;
			viewQuery += ` AND TABLE_SCHEMA = '${validate(context.nodeInfo.metadata.name)}'`;
		}

		tables = (await queryProvider.runQueryAndReturn(connectionUri, tableQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);
		views = (await queryProvider.runQueryAndReturn(connectionUri, viewQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);
	}
	else {
		tables = [[context.nodeInfo.metadata.name, context.nodeInfo.metadata.schema]];
	}

	let diagram = '```mermaid\nclassDiagram\n';
	let references = ``;
	let documentation = ``;

	if (isDatabaseOrSchema) {
		const tableNames: string[] = tables.map(([firstElement, _]) => firstElement);
		const viewNames: string[] = views.map(([firstElement, _]) => firstElement);

		documentation += await getObjectOverviewText(context.nodeInfo.metadata.name, tableNames.concat(viewNames), context.nodeInfo.nodeType);
	}

	// Change threshhold
	if (context.nodeInfo.nodeType === 'Database' && (tables.length + views.length) > 100) {
		let databaseSummary = documentation;
		databaseSummary += await getDatabaseSummary(context, connection);

		const objectNamesQuery = `SELECT [ObjectName] FROM [master].[db_documentation].[DatabaseDocumentation]`;
		const objectNamesResult = await queryProvider.runQueryAndReturn(connectionUri, objectNamesQuery);

		let objectNames = new Set([]);
		if (objectNamesResult.rowCount) {
			objectNames = new Set(objectNamesResult.rows.map(row => row[0].displayValue));
		}

		for (let i = 0; i < tables.length; i++) {
			databaseSummary += getLink(context, objectNames, tables[i][0], tables[i][1]);
		}
		for (let i = 0; i < views.length; i++) {
			databaseSummary += getLink(context, objectNames, views[i][0], views[i][1]);
		}

		return databaseSummary;
	}

	// Tables
	for (let i = 0; i < tables.length; i++) {
		const tableAttributes = await tableToText(connection, databaseName, tables[i][0], tables[i][1]);
		const tableResult = getMermaidDiagramForTable(tables[i][0], tables[i][1], tableAttributes);
		diagram += tableResult[0];
		if (isDatabaseOrSchema) {
			references += tableResult[1];
		}
		documentation += await getDocumentationText(tables[i][0], tableAttributes.map(row => [row[0], row[1], row[2]]), tables[i][1], 'Table');
	}
	// Views
	for (let i = 0; i < views.length; i++) {
		const tableAttributes = await tableToText(connection, databaseName, views[i][0], views[i][1]);
		const tableResult = getMermaidDiagramForTable(views[i][0], views[i][1], tableAttributes);
		diagram += tableResult[0];
		if (isDatabaseOrSchema) {
			references += tableResult[1];
		}
		documentation += await getDocumentationText(views[i][0], tableAttributes.map(row => [row[0], row[1], row[2]]), views[i][1], 'View');
	}

	diagram += references;

	return diagram + '```  \n\n' + documentation;
}

function getLink(context: azdata.ObjectExplorerContext, objectNames: Set<string>, table: string, schema: string): string {
	const label = `${context.connectionProfile.databaseName}.${schema}.${table}`;
	if (objectNames.has(label)) {
		return `## ${table}  \nLink to documentation: [${label}](#)  \n\n`;
	}
	return "";
}

async function tableToText(connection: azdata.connection.ConnectionProfile, databaseName: string, tableName: string, schema: string): Promise<[string, string, string, string][]> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);

	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);
	const baseQuery = `SELECT COLUMN_NAME, DATA_TYPE FROM [${validate(databaseName)}].INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${validate(tableName)}' AND TABLE_SCHEMA = '${schema}';`;
	const referenceQuery = `SELECT COLUMN_NAME, CONSTRAINT_NAME, CONSTRAINT_SCHEMA FROM [${validate(databaseName)}].INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = '${validate(tableName)}' AND TABLE_SCHEMA = '${schema}';`;

	const baseResult = await queryProvider.runQueryAndReturn(connectionUri, baseQuery);
	const referenceResult = await queryProvider.runQueryAndReturn(connectionUri, referenceQuery);

	let tableAttributes: [string, string, string, string][] = [];

	for (let i = 0; i < baseResult.rowCount; i++) {
		const row = baseResult.rows[i];
		const matchingRow = referenceResult.rows.find(referenceRow => referenceRow[0].displayValue === row[0].displayValue);
		const str = matchingRow ? matchingRow[1].displayValue : null;
		const refSchema = matchingRow ? matchingRow[2].displayValue : null;

		if (str && str.substring(0, 2) === "PK") {
			row[1].displayValue = "+ " + row[1].displayValue;
			tableAttributes.push([row[0].displayValue, row[1].displayValue, null, null]);
		}
		else if (str && str.substring(0, 2) === "FK") {
			const reference = str.substring(str.lastIndexOf("_") + 1);
			tableAttributes.push([row[0].displayValue, row[1].displayValue, reference, refSchema]);
		}
		else {
			tableAttributes.push([row[0].displayValue, row[1].displayValue, null, null]);
		}
	}

	// Use tableAttributes to locally make mermaid diagram
	return tableAttributes;
}

function getMermaidDiagramForTable(tableName: string, schema: string, tableAttributes: [string, string, string, string][]): [string, string] {
	let diagram = `\tclass ${schema}_${tableName} {\n`;
	let references = ``;

	for (let i = 0; i < tableAttributes.length; i++) {
		diagram += `\t\t${tableAttributes[i][1]} ${tableAttributes[i][0]}\n`
		if (tableAttributes[i][2] && tableName !== tableAttributes[i][2]) {
			references += `${schema}_${tableName} --> ${tableAttributes[i][3]}_${tableAttributes[i][2]}\n`;
		}
	}

	diagram += `\t}\n\n`;

	return [diagram, references];
}

async function getObjectOverviewText(objectName: string, objectsList: string[], type: string): Promise<string> {
	let key = await getOpenApiKey();

	const configuration = new Configuration({
		apiKey: key, // Replace with actual key/ set up some config for it
	});

	const openai = new OpenAIApi(configuration);
	const prompt = localize("database-documentation.objectOverviewPrompt",
		` Give a brief, couple sentence overview of this ${type}, which stores these tables and views: ${JSON.stringify(objectsList)}. Do not just list the different tables and views, provide an overview of the ${type}`)

	const promptResponse = await
		openai.createChatCompletion({
			model: "gpt-3.5-turbo",
			messages: [{ 'role': 'user', 'content': prompt }],
			temperature: 0
		})

	return `## ${objectName}  \n` + promptResponse.data.choices[0].message.content + `  \n\n`;
}

async function getDatabaseSummary(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile): Promise<string> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	const numConnectionsQuery = `SELECT s.session_id FROM sys.dm_exec_connections c JOIN sys.dm_exec_sessions s ON c.session_id = s.session_id WHERE s.database_id = DB_ID();`;
	const numConnections = (await queryProvider.runQueryAndReturn(connectionUri, numConnectionsQuery)).rows.length.toString();

	const storageBreakdownQuery = `USE ${validate(context.nodeInfo.metadata.name)}; SELECT size * 8.0 / 1024 AS 'Size_MB', type_desc AS 'File_Type' FROM sys.master_files WHERE database_id = DB_ID();`;
	const storageBreakdownResult = (await queryProvider.runQueryAndReturn(connectionUri, storageBreakdownQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);
	const totalSize = storageBreakdownResult.reduce(function (sum, row) { return sum + parseFloat(row[0]) }, 0);
	let storageSummary = ``;
	for (let i = 0; i < storageBreakdownResult.length; i++) {
		const mem = parseFloat(storageBreakdownResult[i][0]);
		const type = storageBreakdownResult[i][1];

		if (type == 'ROWS') {
			storageSummary += `\tData file size: ${mem.toString()} MB  \n`;
		}
		if (type == 'LOG') {
			storageSummary += `\tTransaction Log file size: ${mem.toString()} MB  \n`;
		}
	}

	const tablesQuery = `SELECT [name], [object_id] FROM sys.tables WHERE SCHEMA_NAME(schema_id) = 'dbo';`;
	const tablesResult = (await queryProvider.runQueryAndReturn(connectionUri, tablesQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);

	const viewsQuery = `SELECT [name], [object_id] FROM sys.views WHERE SCHEMA_NAME(schema_id) = 'dbo';`;
	const viewsResult = (await queryProvider.runQueryAndReturn(connectionUri, viewsQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);

	const sprocQuery = `SELECT [name], [object_id] FROM sys.procedures WHERE SCHEMA_NAME(schema_id) = 'dbo';`;
	const sprocResult = (await queryProvider.runQueryAndReturn(connectionUri, sprocQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue]);

	const statsQuery = `USE ${validate(context.nodeInfo.metadata.name)}; SELECT OBJECT_NAME(object_id) AS 'Object_Name', SUM(user_seeks) AS 'User_Seeks', SUM(user_scans) AS 'User_Scans', SUM(user_lookups) AS 'User_Lookups', SUM(user_updates) AS 'User_Updates' FROM sys.dm_db_index_usage_stats GROUP BY object_id HAVING OBJECT_NAME(object_id) IS NOT NULL;`;
	const statsResult = (await queryProvider.runQueryAndReturn(connectionUri, statsQuery)).rows.map(row => [row[0].displayValue, row[1].displayValue, row[2].displayValue, row[3].displayValue, row[4].displayValue]);
	let statsTable = `|Object Name|Seeks|Scans|Lookups|Updates|  \n|-|-|-|-|-|  \n`;
	for (let i = 0; i < statsResult.length; i++) {
		statsTable += `|${statsResult[i][0]}|${statsResult[i][1]}|${statsResult[i][2]}|${statsResult[i][3]}|${statsResult[i][4]}|  \n`;
	}

	return localize(`database-documentation.databaseSummary`,
		`**Number of Connections to Database**  \n${numConnections}  \n\n**Database Memory Usage**  \nTotal Size:${totalSize} MB  \n${storageSummary}\n**Database Objects Overview**  \n\tTotal Tables: ${tablesResult.length.toString()}  \n\tTotal Views: ${viewsResult.length.toString()}  \n\tTotal Stored Procedures: ${sprocResult.length.toString()}  \n\n**Database Object Stats**  \n${validate(statsTable)}  \n\n`);
}

async function getDocumentationText(tableName: string, tableAttributes: [string, string, string][], schema: string, type: string): Promise<string> {
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
		**Schema**  \n${schema}  \n
		**Fields**  \n- <Field Name>: <Field Description, min 20 words>  \n
		- <Field Name>: <Field Description, min 20 words>  \n
		\n
		**Relationships**  \n<Relationships Description>`);

	try {
		const promptResponse = await
			openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: [{ 'role': 'user', 'content': prompt }],
				temperature: 0
			})

		return `### ${tableName}  \n` + promptResponse.data.choices[0].message.content + '  \n\n';
	}
	catch (error) {
		const status = error.message.slice(-3);
		if (status === "401") {
			return localize("database-documentation.401", "OpenAI request failed because of invalid authentication. Ensure your API Key is current and correct.");
		}
		else if (status === "429") {
			return localize("database-documentation.429", "OpenAI request failed because of rate limiting. Make sure your plan allows at least 15 request per minute.");
		}
		else if (status === "500") {
			return localize("database-documentation.500", "OpenAI request failed due to a server error on their side. Try again some other time.");
		}
		else if (status === "503") {
			return localize("database-documentation.503", "OpenAI request failed because their servers are overloaded. Try again some other time.");
		}
		return localize("database-documentation.miscAPIError", JSON.stringify(error.message));
	}
}

function getLabel(context: azdata.ObjectExplorerContext): string {
	if (context.nodeInfo.nodeType === 'Database') {
		return context.nodeInfo.metadata.name;
	}
	else if (context.nodeInfo.nodeType === 'Schema') {
		return context.nodeInfo.label;
	}
	else {
		return `${context.connectionProfile.databaseName}.${context.nodeInfo.label}`;
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
		\t[ObjectName]    NVARCHAR(MAX) NOT NULL,\n
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
		`SELECT [Version],[Markdown] FROM [master].[db_documentation].[DatabaseDocumentation] WHERE [ObjectName] = '${validate(getLabel(context))}'`);

	if (objectExists.rowCount) {
		return [parseInt(objectExists.rows[0][0].displayValue), objectExists.rows[0][1].displayValue];
	}
	// Otherwise, insert new entry into table
	else {
		const insertQuery = `
		INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
		VALUES ('${validate(getLabel(context))}', ${0}, '', '');\n
		`
		// Insert data into table
		await queryProvider.runQueryString(connectionUri, insertQuery);

		return [0, ""];
	}
}

export async function saveMarkdown(context: azdata.ObjectExplorerContext, connection: azdata.connection.ConnectionProfile, version: number, markdown: string, markdownJSON: string): Promise<boolean> {
	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	// Set updated version of object
	const newVersion = version + 1;

	// New version, markdown, and markdown JSON are all generated by this extension
	let insertQuery = `
	UPDATE [db_documentation].[DatabaseDocumentation]
	SET [Version] = ${newVersion}, [Markdown] = '${validate(markdown)}', [JSONMarkdown] = '${validate(markdownJSON)}' WHERE [ObjectName] = '${validate(getLabel(context))}';
	`

	const nodeType = context.nodeInfo.nodeType;
	const json = JSON.parse(markdownJSON);
	const text = json['Text'];
	const mermaid = json['Mermaid'];

	// If documentation contains multiple other objects, extract them and save them into the database
	if ((nodeType === 'Database' || nodeType === 'Schema') && mermaid !== '') {
		const objectNamesQuery = `SELECT [ObjectName] FROM [master].[db_documentation].[DatabaseDocumentation]`;
		const objectNamesResult = await queryProvider.runQueryAndReturn(connectionUri, objectNamesQuery);

		let objectNames = new Set([]);
		if (objectNamesResult.rowCount) {
			objectNames = new Set(objectNamesResult.rows.map(row => row[0].displayValue));
		}

		const keys = Object.keys(text);

		for (let i = 0; i < keys.length; i++) {
			const tableName = keys[i];

			if (!objectNames.has(tableName)) {

				const tableMermaid = '```mermaid\nclassDiagram\n' + mermaid[tableName] + '```  \n\n';

				const fields = text[tableName]['Fields'];
				let fieldsText = ''
				for (const fieldName in fields) {
					const currentFieldText = `- ${fieldName}: ${fields[fieldName]}  \n`;
					fieldsText += currentFieldText;
					const fieldLabel = `${tableName}.${fieldName}`;

					const fieldJson = {
						[fieldName]: fields[fieldName]
					};

					insertQuery += `
					INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
					VALUES ('${fieldLabel}', ${1}, '${validate(currentFieldText)}', '${validate(JSON.stringify(fieldJson))}');\n
					`;
				}

				const tableText = `### ${tableName.substring(tableName.lastIndexOf(".") + 1)}  \n**Overview**  \n${text[tableName]['Overview']}  \n\n**Schema**  \n${text[tableName]['Schema']}  \n\n**Fields**  \n${fieldsText}  \n**Relationships**  \n${text[tableName]['Relationships']}`;
				const tableMarkdown = tableMermaid + tableText;

				const tableJson: any = {
					"Mermaid": tableMermaid,
					"Text": {}
				};
				tableJson['Text'][tableName] = text[tableName];
				const tableMarkdownJSON = JSON.stringify(tableJson);

				insertQuery += `
				INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
				VALUES ('${validate(tableName)}', ${1}, '${validate(tableMarkdown)}', '${validate(tableMarkdownJSON)}');\n
				`
			}
		}
	}
	else if (mermaid !== '') {
		const fields = text[getLabel(context)]['Fields'];
		for (const fieldName in fields) {
			const currentFieldText = `- ${fieldName}: ${fields[fieldName]}  \n`;
			const fieldLabel = `${getLabel(context)}.${fieldName}`;

			const fieldJson = {
				[fieldName]: fields[fieldName]
			};

			insertQuery += `
			INSERT INTO [db_documentation].[DatabaseDocumentation] ([ObjectName], [Version], [Markdown], [JSONMarkdown])\n
			VALUES ('${fieldLabel}', ${1}, '${validate(currentFieldText)}', '${validate(JSON.stringify(fieldJson))}');\n
			`;
		}
	}

	// Insert data into table
	await queryProvider.runQueryString(connectionUri, insertQuery);

	return true;
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

export function convertMarkdownToJSON(context: azdata.ObjectExplorerContext, markdown: string): string {
	const databaseName = context.connectionProfile.databaseName;

	const lines = markdown.split('\n');
	const json: any = {};
	json['Mermaid'] = {};
	json['Text'] = {};

	let regex = /```mermaid[\s\S]*?```/g;
	let match = markdown.match(regex);
	if (!match) {
		json['Mermaid'] = '';
		json['Text'] = markdown;
		return JSON.stringify(json);
	}
	const mermaid = match[0];

	let classRegex = new RegExp(`\\tclass[\\s\\S]*?\\t}\\n\\n`, 'g');
	const classMatches = mermaid.match(classRegex);

	if (!classMatches) {
		throw new Error("Class Matches: Mermaid code isn't formatted correctly");
	}

	const expectedValue = mermaid.match(/class /g)!.length;

	// Format Check count variables
	let objectNameCount = 0;
	let overviewCount = 0;
	let schemaCount = 0;
	let fieldsCount = 0;
	let relationshipsCount = 0;

	let currentJson: any = {}
	let currentName = '';
	let currentLabel = '';
	let currentMermaid = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith('### ')) {
			currentName = line.substring(4).trim();
			currentJson['Name'] = currentName;

			objectNameCount++;
		}
		else if (line.startsWith('**Overview**')) {
			let overview = '';
			for (let j = i + 1; j < lines.length; j++) {
				const nextLine = lines[j];
				if (nextLine.startsWith('**Schema**')) {
					break;
				}
				i++;
				overview += nextLine;
			}
			// Get all lines until line **Schema**
			currentJson['Overview'] = overview;

			overviewCount++;
		}
		else if (line.startsWith('**Schema**')) {
			let schema = '';
			if (i + 1 < lines.length) {
				const nextLine = lines[i + 1];
				schema = nextLine.trim();
			}
			currentJson['Schema'] = schema.trim();

			currentLabel = databaseName + "." + schema.trim() + "." + currentName

			schemaCount++;
		}
		else if (line.startsWith('**Fields**')) {
			fieldsCount++;
		}
		else if (line.startsWith('- ')) {
			const fieldName = line.substring(2, line.indexOf(':'));
			const fieldValue = line.substring(line.indexOf(':') + 1).trim();
			if (!currentJson['Fields']) {
				currentJson['Fields'] = {}; // Initialize Fields as an empty object
			}
			currentJson['Fields'][fieldName] = fieldValue;
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
			currentJson['Relationships'] = relationships;
			relationshipsCount++;

			json['Text'][currentLabel] = currentJson;

			if (currentMermaid >= classMatches.length) {
				throw new Error("Not enough: Mermaid code isn't formatted correctly");
			}
			json['Mermaid'][currentLabel] = classMatches[currentMermaid];
			currentMermaid++;

			currentLabel = '';
			currentJson = {};
		}
	}

	if (objectNameCount !== expectedValue || schemaCount !== expectedValue || fieldsCount !== expectedValue || overviewCount !== expectedValue || relationshipsCount !== expectedValue) {
		throw new Error(`
			Documentation is not formatted correctly.\n
			Expected ${expectedValue} of headers.\n
			Instead there are:\n
			- ${objectNameCount} objects stored, ie. ### <Object Name>\n
			- ${schemaCount} objects stored, ie. **Schema**\n
			- ${overviewCount} overview headers stored, ie. **Overview**\n
			- ${fieldsCount} field headers stored, ie. **Fields**\n
			- ${relationshipsCount} relationship headers stored, ie. **Relationships**\n
			\n
			Make sure the format of your documentation follows:\n
			### <Object Name>\n
			**Overview**\n
			<Overview Text>\n
			**Schema**\n
			<Schema Name>\n
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

	// Remove potentially harmful SQL keywords
	const sanitizedKeywords = sanitizedSemicolons.replace(/\b(xp_)\w+\b/g, '');

	return sanitizedKeywords;
}

export async function getHoverContent(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover> {
	const connection = (await azdata.connection.getCurrentConnection());

	if (!connection) {
		return null;
	}

	const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
	const connectionUri = await azdata.connection.getUriForConnection(connection.connectionId);

	const objectNamesQuery = `SELECT [ObjectName], [Markdown] FROM [master].[db_documentation].[DatabaseDocumentation]`;
	const objectNamesResult = await queryProvider.runQueryAndReturn(connectionUri, objectNamesQuery);

	if (objectNamesResult.rowCount) {
		const objectNames = new Set(objectNamesResult.rows.map(row => row[0].displayValue));
		const range = document.getWordRangeAtPosition(position);
		const word = document.getText(range);

		const identificationService: mssql.IIdentificationService = await getIdentificationService();
		const objectName: string = await identificationService.identify(document.uri.toString(), position, word);

		if (objectNames.has(objectName)) {
			const matchingRow = objectNamesResult.rows.find(row => row[0].displayValue === objectName);
			const regex = /(?<=```  \n\n)[\s\S]*/g;

			let match = matchingRow[1].displayValue.match(regex);
			if (match) {
				return new vscode.Hover(new vscode.MarkdownString(match[0]));
			}

			return new vscode.Hover(new vscode.MarkdownString(matchingRow[1].displayValue));
		}
		return null;
	}
	else {
		return null;
	}
}

