/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as xml from 'tsxml';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider({ language: 'xml' }, {
		provideDocumentFormattingEdits: document => format(document)
	}));
}

function format(document: vscode.TextDocument): vscode.ProviderResult<vscode.TextEdit[]> {
	const range = new vscode.Range(0, 0, document.lineCount, document.lineAt(document.lineCount - 1).range.end.character);
	return xml.Compiler.formatXmlString(document.getText()).then(formatted => [new vscode.TextEdit(range, formatted)], () => [new vscode.TextEdit(range, document.getText())]);
}
