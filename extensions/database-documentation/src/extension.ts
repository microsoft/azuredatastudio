/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

//import * as azdata from 'azdata';
import type * as azdata from 'azdata';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// The module 'azdata' contains the Azure Data Studio extensibility API
// This is a complementary set of APIs that add SQL / Data-specific functionality to the app
// Import the module and reference it with the alias azdata in your code below
import { generateMarkdown, getAzdataApi, getDatabaseFromNode, getMssqlApi } from './common/utils';

import * as vscodeMssql from 'vscode-mssql';

// Database connection library
import * as mssql from 'mssql';

// The module 'openai' contains the OpenAI API
import { Configuration, OpenAIApi } from "openai";

// Language localization features
import * as nls from 'vscode-nls';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async  function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "database-documentation" is now active!');

    const queryExecutionService = await getMssqlApi();

    void vscode.commands.executeCommand('setContext', 'azdataAvailable', !!getAzdataApi());

    const azdata = getAzdataApi();

    const localize = nls.loadMessageBundle();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.generateDocumentation', async (context: azdata.ObjectExplorerContext) => {
        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation... "));
        let md = await generateMarkdown(context);
        vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));

        // Open the text document
        const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: md })
        const editor = await vscode.window.showTextDocument(document);

        

    }));

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentTableADS', async (context: any) => {
        const azdata = getAzdataApi();

        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage((!!azdata).toString());

        let connection = (await azdata.connection.getCurrentConnection());
        let databaseName: string = context.connectionProfile.databaseName;

        vscode.window.showInformationMessage("Azdata available: " + databaseName);

        /*
        this.utils = new Utils(connection, databaseName, ["EmployeeTerritories", "Region", "Territories"]);
        let text = await this.utils.tableToText(context.nodeInfo.metadata.name);
        vscode.window.showInformationMessage(text);
        */

        let md = "```mermaid\nclassDiagram\n\tclass EmployeeTerritories {\n\t\tint EmployeeID\n\t\tnvarchar TerritoryID\n\t}\n```\n\n### EmployeeTerritories\n**Overview**  \nThe EmployeeTerritories table stores the relationship between employees and territories. It indicates which territories are assigned to each employee.\n\n**Fields**  \n\u2022 EmployeeID:  \nThis field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field\nin the Employees table.  \n\u2022 TerritoryID:   \nThis field is of type nvarchar(20) and represents the unique identifier of a territory. It is a foreign key referencing the TerritoryID\nfield in the Territories table.\n\n**Relationships**  \nThe EmployeeTerritories table has a one-to-many relationship with the Employees table, where each record in the EmployeeTerritories table corresponds\nto one employee. The EmployeeID field in the EmployeeTerritories table references the EmployeeID field in the Employees table.\n\nThe EmployeeTerritories table also has a one-to-many relationship with the Territories table, where each record in the EmployeeTerritories table\ncorresponds to one territory. The TerritoryID field in the EmployeeTerritories table references the TerritoryID field in the Territories table.\n";

        // let document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        // vscode.window.showTextDocument(document);

        const renderpanel = vscode.window.createWebviewPanel(
            'customPage',
            'Documentation',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        // renderpanel.webview.html = getRenderWebviewContent();
        renderpanel.webview.html = getMDHTML();

        vscode.languages.registerHoverProvider('sql', {
            provideHover(document, position) {

                const range = document.getWordRangeAtPosition(position);
                const word = document.getText(range);

                if (word === "EmployeeTerritories") {

                    // Split the text into lines
                    const lineNum = md.split('\n').length;
                    // Determine if scroll bar is needed
                    const scrollNeeded = lineNum > 5;

                    let markdownContent = new vscode.MarkdownString(md);

                    let hover = new vscode.Hover(markdownContent);

                    return hover;
                }
            }
        });

        vscode.window.showInformationMessage("Changes detected in documentation. Pull changes?", "Yes", "No");

        // Query Api
        /*
        const configuration = new Configuration({
            apiKey: "secret", // Replace with actual key
        });
        const openai = new OpenAIApi(configuration);

        try {
            const response = await
                openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    messages: [{ 'role': 'user', 'content': '1st president of US?' }],
                    temperature: 0
                })

            let result = response.data.choices[0].message.content;
            vscode.window.showInformationMessage(result);
        }
        catch (error) {
            vscode.window.showInformationMessage("Error:" + error.message);
        }
        */

    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentDatabaseCode', async (context: vscodeMssql.ITreeNodeInfo) => {

        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage((!!azdata).toString());
        vscode.window.showInformationMessage(context.label.toString());

        let queryText = 'USE _LAPTOP_86OKR60V_04f4ce82983b4108bf7038d923a72a65 SELECT name FROM sys.tables';

        let document = await vscode.workspace.openTextDocument({ language: "sql", content: queryText });

        // vscode.window.showInformationMessage("Attempting to execute query");

        // queryExecutionService.handleSimpleExecuteRequest(queryText, document.uri.toString());

    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentTableCode', (context: vscodeMssql.ITreeNodeInfo) => {
        // The code you place here will be executed every time your command is executed

        vscode.window.showInformationMessage("Table Name: " + context.label.toString());
        vscode.window.showInformationMessage("Database Name: " + getDatabaseFromNode(context).label.toString());

        vscode.window.showInformationMessage((!!azdata).toString());

    }));

}

function getMDHTML(): string {
    // Generate the HTML content with the theme information
    const htmlContent = `
    <style>
    #a {
        font-family: Arial, sans-serif;
    }
    </style>

    <img src=https://i.postimg.cc/Z5XwwcMg/dia.png alt="mermaid diagram">

    <h3>EmployeeTerritories</h3>
    <p><strong>Overview</strong></p>
    <p>The EmployeeTerritories table stores the relationship between employees and territories. It indicates which territories are assigned to each employee.</p>

    <p><strong>Fields</strong></p>
    <ul>
    <li>EmployeeID: <br>This field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field in the Employees table.</li>
    <li>TerritoryID: <br>This field is of type nvarchar(20) and represents the unique identifier of a territory. It is a foreign key referencing the TerritoryID field in the Territories table.</li>
    </ul>

    <p><strong>Relationships</strong></p>
    <p>This field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field in the Employees table. The EmployeeTerritories table has a one-to-many relationship with the Employees table, where each record in the EmployeeTerritories table corresponds to one employee. The EmployeeID field in the EmployeeTerritories table references the EmployeeID field in the Employees table.</p>

    <p>The EmployeeTerritories table also has a one-to-many relationship with the Territories table, where each record in the EmployeeTerritories table corresponds to one territory. The TerritoryID field in the EmployeeTerritories table references the TerritoryID field in the Territories table.</p>
    `;
    return htmlContent;
}

function getRenderWebviewContent(): string {

    // Generate the HTML content with the theme information
    const htmlContent = `
    <style>
    #a {
        font-family: Arial, sans-serif;
    }
    </style>

    <img src=https://i.postimg.cc/Z5XwwcMg/dia.png alt="mermaid diagram">

    <h3>EmployeeTerritories</h3>
    <p><strong>Overview</strong></p>
    <textarea id="a" name="a" rows="2" cols="100">The EmployeeTerritories table stores the relationship between employees and territories. It indicates which territories are assigned to each employee.</textarea>

    <p><strong>Fields</strong></p>
    <ul>
    <li>EmployeeID: <br><textarea id="a" name="a" rows="2" cols="75">This field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field
    in the Employees table.</textarea></li>
    <li>TerritoryID: <br><textarea id="a" name="a" rows="2" cols="75">This field is of type nvarchar(20) and represents the unique identifier of a territory. It is a foreign key referencing the TerritoryID
    field in the Territories table.</textarea></li>
    </ul>

    <p><strong>Relationships</strong></p>
    <textarea id="a" name="a" rows="7" cols="100">This field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field
    in the Employees table. The EmployeeTerritories table has a one-to-many relationship with the Employees table, where each record in the EmployeeTerritories table corresponds
    to one employee. The EmployeeID field in the EmployeeTerritories table references the EmployeeID field in the Employees table.

    The EmployeeTerritories table also has a one-to-many relationship with the Territories table, where each record in the EmployeeTerritories table
    corresponds to one territory. The TerritoryID field in the EmployeeTerritories table references the TerritoryID field in the Territories table.</textarea>
    `;

    return htmlContent;
}

// this method is called when your extension is deactivated
export function deactivate() {
}
