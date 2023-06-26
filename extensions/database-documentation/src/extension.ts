/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// The module 'azdata' contains the ADS extensibility API
import * as azdata from 'azdata';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// The module 'azdata' contains the Azure Data Studio extensibility API
// This is a complementary set of APIs that add SQL / Data-specific functionality to the app
// Import the module and reference it with the alias azdata in your code below
import { convertMarkdownToJSON, generateMarkdown, saveMarkdown, setupGeneration } from './common/utils';

// The module 'openai' contains the OpenAI API
import { Configuration, OpenAIApi } from "openai";

// Language localization features
import * as nls from 'vscode-nls';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    const localize = nls.loadMessageBundle();

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.viewDocumentation', async (context: azdata.ObjectExplorerContext) => {
        // The code you place here will be executed every time your command is executed
        let connection = (await azdata.connection.getCurrentConnection());

        if (!connection) {
            vscode.window.showInformationMessage(localize('database-documentation.connectionError', 'No active connection found.'));
            throw new Error('No active connection found.');
        }

        let result = await setupGeneration(context, connection);
        const version = result[0];
        let md = result[1];

        if (!version) {
            vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation... "));
            md = await generateMarkdown(context, connection);
            vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));
        }

        // Show generated docs
        let document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        await vscode.window.showTextDocument(document);

        // Show markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide');

        vscode.workspace.onDidSaveTextDocument(async (document) => {

            const choiceMessage = localize('database-documentation.choiceMessage', 'Do you want to save the documentation to the database as well? This will allow others to access it, and allow us to integrate it with IntelliSense and Tooltips');
            const yes = localize('database-documentation.yes', 'Yes');
            const no = localize('database-documentation.no', 'No');
            const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

            if (choice === yes) {
                const markdownSave = document.getText();
                const markdownJSON = convertMarkdownToJSON(markdownSave);
                await saveMarkdown(context, connection, version, markdownSave, markdownJSON);

                vscode.window.showInformationMessage(localize('database-documentation.savedMarkdown', "Saved markdown to master database!"));
            }
        })

    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
