/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// The module 'azdata' contains the Azure Data Studio extensibility API
// This is a complementary set of APIs that add SQL / Data-specific functionality to the app
// Import the module and reference it with the alias azdata in your code below

import * as azdata from 'azdata';

// Database connection library
import * as mssql from 'mssql';

// The module 'openai' contains the OpenAI API
import { Configuration, OpenAIApi } from "openai";

import { ChooseTablesDialog } from './chooseTablesDialog';

import { Utils } from './utils';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "database-documentation" is now active!');


    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentDatabaseADS', async (context: azdata.ObjectExplorerContext) => {
        let connection = (await azdata.connection.getCurrentConnection());
        let databaseName: string = context.nodeInfo.metadata.name;

        // The code you place here will be executed every time your command is executed
        // Choose tables
        this.chooseTablesDialog = new ChooseTablesDialog(connection, databaseName);
        await this.chooseTablesDialog.openDialog();

        this.chooseTablesDialog.onSuccess(async (chosenTables) => {
            vscode.window.showInformationMessage(JSON.stringify(chosenTables));

            this.utils = new Utils(connection, databaseName, chosenTables);
            await this.utils.generateMarkdown();
        })

        // Make markdown content from tables
        /*
        this.utils = new Utils(connection, databaseName, ["EmployeeTerritories", "Region", "Territories"]);
        await this.utils.generateMarkdown();
        */

    }));

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentTableADS', async (context: azdata.ObjectExplorerContext) => {
        // The code you place here will be executed every time your command is executed

        vscode.window.showInformationMessage("hi!");

        let connection = (await azdata.connection.getCurrentConnection());
        let databaseName: string = context.connectionProfile.databaseName;

        this.utils = new Utils(connection, databaseName, ["EmployeeTerritories", "Region", "Territories"]);
        let text = await this.utils.tableToText(context.nodeInfo.metadata.name);
        vscode.window.showInformationMessage(text);

        let md = "```mermaid\nclassDiagram\n\tclass EmployeeTerritories {\n\t\tint EmployeeID\n\t\tnvarchar TerritoryID\n\t}\n```\n\n### EmployeeTerritories\n**Overview**  \nThe EmployeeTerritories table stores the relationship between employees and territories. It indicates which territories are assigned to each employee.\n\n**Fields**  \n\u2022 EmployeeID: This field is of type integer and represents the unique identifier of an employee. It is a foreign key referencing the EmployeeID field\nin the Employees table.  \n\u2022 TerritoryID: This field is of type nvarchar(20) and represents the unique identifier of a territory. It is a foreign key referencing the TerritoryID\nfield in the Territories table.\n\n**Relationships**  \nThe EmployeeTerritories table has a one-to-many relationship with the Employees table, where each record in the EmployeeTerritories table corresponds\nto one employee. The EmployeeID field in the EmployeeTerritories table references the EmployeeID field in the Employees table.\n\nThe EmployeeTerritories table also has a one-to-many relationship with the Territories table, where each record in the EmployeeTerritories table\ncorresponds to one territory. The TerritoryID field in the EmployeeTerritories table references the TerritoryID field in the Territories table.\n";

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

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentDatabaseCode', () => {
        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage("hello!");
    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.documentTableCode', () => {
        // The code you place here will be executed every time your command is executed
        vscode.window.showInformationMessage("hi!");

    }));

}

// this method is called when your extension is deactivated
export function deactivate() {
}
