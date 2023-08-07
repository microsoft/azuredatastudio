/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { convertMarkdownToJSON, generateMarkdown, getContextVariables, getHoverContent, saveMarkdown, setContextVariables, setupGeneration, validate } from './common/utils';
import * as nls from 'vscode-nls';

export async function activate(context: vscode.ExtensionContext) {

    const localize = nls.loadMessageBundle();

    const yes = localize('database-documentation.yes', 'Yes');
    const no = localize('database-documentation.no', 'No');
    const extensionInstalled = (vscode.extensions.all).filter(extension => extension.id === 'bierner.markdown-mermaid').length;

    if (!extensionInstalled) {
        const choiceMessage = localize('database-documentation.choiceMessageInstall', 'Do you want to install a mermaid rendering extension? This will allow you to see the rendered mermaid diagrams within generated documentation.');
        const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

        if (choice === yes) {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(context.asAbsolutePath('markdown-mermaid')));
            vscode.window.showInformationMessage(localize('database-documentation.doneInstallingMermaid', 'Done Installing Mermaid extension!'));
        }
    }

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.viewDocumentation', async (context: azdata.ObjectExplorerContext) => {
        let connectionId = "";
        if (!context.connectionProfile) {
            const connection = (await azdata.connection.getCurrentConnection());
            if (!connection) {
                vscode.window.showInformationMessage(localize('database-documentation.connectionError', 'No active connection found.'));
                throw new Error('No active connection found.');
            }

            connectionId = connection.connectionId;
        }
        else {
            connectionId = context.connectionProfile.id;
        }

        const connectionUri = await azdata.connection.getUriForConnection(connectionId);

        const result = await setupGeneration(context, connectionUri);
        const version = result[0];
        let md = result[1];

        if (!version) {
            vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation, this may take a while..."));
            md = await generateMarkdown(context, connectionUri);
            vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));
        }

        // Show generated docs
        const document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        await vscode.window.showTextDocument(document);

        await setContextVariables(context, connectionUri, version, document);

        // Show markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Register the event listener for the tab switch event
        vscode.window.onDidChangeActiveTextEditor(() => {
            vscode.commands.executeCommand('setContext', 'documentOpen', vscode.window.visibleTextEditors.some((editor) => editor.document === document));
        });

        // Register the event listener for user saving the documentation locally
        vscode.workspace.onDidSaveTextDocument(async (savedDocument: vscode.TextDocument) => {
            if (savedDocument === document) {
                const choiceMessage = localize('database-documentation.choiceMessage', 'Do you want to save the documentation to the database as well? This will allow others to access it, and allow us to integrate it with IntelliSense and Tooltips');
                const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

                if (choice === yes) {
                    await vscode.commands.executeCommand('database-documentation.saveDocumentationToDatabase');
                }
            }
        });

    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.regenerateDocumentation', async () => {
        const contextVariables = getContextVariables();
        const context = contextVariables[0];
        const connectionUri = contextVariables[1];
        const version = contextVariables[2];

        vscode.window.showInformationMessage(localize('database-documentation.startedGen', "Generating Documentation, this may take a while..."));
        const md = await generateMarkdown(context, connectionUri);
        vscode.window.showInformationMessage(localize('database-documentation.finishedGen', "Documentation Generated!"));

        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        // Show generated docs
        const document = await vscode.workspace.openTextDocument({ language: "markdown", content: md });
        await vscode.window.showTextDocument(document);

        setContextVariables(context, connectionUri, version, document);

        // Show markdown preview
        await vscode.commands.executeCommand('markdown.showPreviewToSide');

        // Register the event listener for the tab switch event
        vscode.window.onDidChangeActiveTextEditor(() => {
            vscode.commands.executeCommand('setContext', 'documentOpen', vscode.window.visibleTextEditors.some((editor) => editor.document === document));
        });

        // Register the event listener for user saving the documentation locally
        vscode.workspace.onDidSaveTextDocument(async (savedDocument: vscode.TextDocument) => {
            if (savedDocument === document) {
                const choiceMessage = localize('database-documentation.choiceMessage', 'Do you want to save the documentation to the database as well? This will allow others to access it, and allow us to integrate it with IntelliSense and Tooltips');
                const choice = await vscode.window.showInformationMessage(choiceMessage, yes, no);

                if (choice === yes) {
                    await vscode.commands.executeCommand('database-documentation.saveDocumentationToDatabase');
                }
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.saveDocumentationToDatabase', async () => {
        const contextVariables = getContextVariables();
        const context = contextVariables[0];
        const connectionUri = contextVariables[1];
        const version = contextVariables[2];
        const document = contextVariables[3];

        const markdownSave = document.getText();
        const markdownJSON = convertMarkdownToJSON(context, markdownSave);

        const didSave = await saveMarkdown(context, connectionUri, version, markdownSave, markdownJSON);

        if (didSave) {
            vscode.window.showInformationMessage(localize('database-documentation.savedMarkdown', "Saved documentation to database!"));
        }
        else {
            vscode.window.showInformationMessage(localize('database-documentation.didNotSaveMarkdown', "There was a problem saving documentation to database. Try saving again."));
        }

    }));

    context.subscriptions.push(vscode.commands.registerCommand('database-documentation.setMaxObjects', async () => {
        const configuration = vscode.workspace.getConfiguration('database-documentation');

        let maxObjectsInput = await vscode.window.showInputBox({
            prompt: localize('database-documentation.setMaxObjectsInput', 'What is the max number of objects you would like to individually document?'),
            ignoreFocusOut: true,
        });

        if (maxObjectsInput) {
            let maxObjects = Number(maxObjectsInput);
            if (!isNaN(maxObjects)) {
                try {
                    await configuration.update('maxObjectsForDatabaseDocs', maxObjects, vscode.ConfigurationTarget.Global);
                }
                catch (err) {
                }
            }

        }
    }));


    vscode.languages.registerHoverProvider('sql', {
        async provideHover(document, position) {
            return getHoverContent(document, position);
        }
    });

    vscode.window.onDidChangeTextEditorSelection(async (event: vscode.TextEditorSelectionChangeEvent) => {
        if (event.textEditor.document.languageId !== 'markdown') {
            return;
        }
        const selectedPosition = event.textEditor.selection.start;
        const wordRange = event.textEditor.document.getWordRangeAtPosition(selectedPosition, /(?<=\[).*(?=\])/);
        let word = event.textEditor.document.getText(wordRange);

        if (wordRange.contains(new vscode.Position(0, 0))) {
            return;
        }

        word = word.substring(1, word.length - 1);
        const databaseName = word.substring(0, word.indexOf("."));

        const connectionUri = getContextVariables()[1];

        const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>("MSSQL", azdata.DataProviderType.QueryProvider);
        const objectNameQuery = `
			IF EXISTS (
				SELECT 1
				FROM [${validate(databaseName)}].INFORMATION_SCHEMA.TABLES
				WHERE TABLE_SCHEMA = 'db_documentation'
				AND TABLE_NAME = 'DatabaseDocumentation'
			)
			BEGIN
				SELECT [ObjectName], [Markdown]
				FROM [${validate(databaseName)}].[db_documentation].[DatabaseDocumentation]
				WHERE [ObjectName] = '${validate(word)}'
			END
			ELSE
			BEGIN
				SELECT NULL AS [ObjectName], NULL AS [Markdown]
				WHERE 1 = 0; -- This condition will always be false, resulting in an empty result set
			END;
        `;
        const objectNameResult = await queryProvider.runQueryAndReturn(connectionUri, objectNameQuery);

        if (objectNameResult.rowCount) {
            const newPosition = new vscode.Position(0, 0);
            const newSelection = new vscode.Selection(newPosition, newPosition);
            event.textEditor.selection = newSelection;

            const document = await vscode.workspace.openTextDocument({ language: "markdown", content: objectNameResult.rows[0][1].displayValue });
            await vscode.window.showTextDocument(document);
        }
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}
