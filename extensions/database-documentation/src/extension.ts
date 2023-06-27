/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { convertMarkdownToJSON, generateMarkdown, getContextVariables, saveMarkdown, setContextVariables, setupGeneration } from './common/utils';
import * as nls from 'vscode-nls';

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
            vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation, this may take a while..."));
            md = await generateMarkdown(context, connection);
            vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));
        }

        // Show generated docs
        let document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        await vscode.window.showTextDocument(document);

        setContextVariables(context, connection, version, document);

        // Show markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Register the event listener for the tab switch event
        vscode.window.onDidChangeActiveTextEditor(() => {
            vscode.commands.executeCommand('setContext', 'documentOpen', vscode.window.visibleTextEditors.some((editor) => editor.document === document));
        });

        // Register the event listener for user saving the documentation locally
        vscode.workspace.onDidSaveTextDocument(async () => {
            const choiceMessage = localize('database-documentation.choiceMessage', 'Do you want to save the documentation to the database as well? This will allow others to access it, and allow us to integrate it with IntelliSense and Tooltips');
            const yes = localize('database-documentation.yes', 'Yes');
            const no = localize('database-documentation.no', 'No');
            const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

            if (choice === yes) {
                await vscode.commands.executeCommand('database-documentation.saveDocumentationToDatabase', context, connection, version);
            }
        })

    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.regenerateDocumentation', async () => {
        const contextVariables = getContextVariables();
        const context = contextVariables[0];
        const connection = contextVariables[1];
        const version = contextVariables[2];

        vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation, this may take a while..."));
        const md = await generateMarkdown(context, connection);
        vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Show generated docs
        let document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        await vscode.window.showTextDocument(document);

        setContextVariables(context, connection, version, document);

        // Show markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Register the event listener for the tab switch event
        vscode.window.onDidChangeActiveTextEditor(() => {
            vscode.commands.executeCommand('setContext', 'documentOpen', vscode.window.visibleTextEditors.some((editor) => editor.document === document));
        });

        // Register the event listener for user saving the documentation locally
        vscode.workspace.onDidSaveTextDocument(async () => {
            const choiceMessage = localize('database-documentation.choiceMessage', 'Do you want to save the documentation to the database as well? This will allow others to access it, and allow us to integrate it with IntelliSense and Tooltips');
            const yes = localize('database-documentation.yes', 'Yes');
            const no = localize('database-documentation.no', 'No');
            const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

            if (choice === yes) {
                await vscode.commands.executeCommand('database-documentation.saveDocumentationToDatabase');
            }
        })
    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.saveDocumentationToDatabase', async () => {
        const contextVariables = getContextVariables();
        const context = contextVariables[0];
        const connection = contextVariables[1];
        const version = contextVariables[2];
        const document = contextVariables[3];

        const markdownSave = document.getText();
        const markdownJSON = convertMarkdownToJSON(markdownSave);
        await saveMarkdown(context, connection, version, markdownSave, markdownJSON);

        vscode.window.showInformationMessage(localize('database-documentation.savedMarkdown', "Saved markdown to master database!"));
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
