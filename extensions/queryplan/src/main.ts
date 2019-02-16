/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

let toggleOn: boolean = false;
let statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
statusView.text = 'Query Plan watcher on';
let windowCount = 0;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.registerCommand('queryplan.ToggleProcessPlan', () => {
		toggleOn = !toggleOn;
		if (toggleOn) {
			statusView.show();
		} else {
			statusView.hide();
		}
	});

	sqlops.queryeditor.registerQueryInfoListener({
		providerId: 'MSSQL',
		onExecutionStart: (fileUri: string): void => {
			if (toggleOn) {
			}
		},
		onExecutionComplete: (fileUri: string): void => {
			if (toggleOn) {
			}
		},
		onExecutionPlanAvailable: (fileUri: string, executionPlan: string): void => {
			if (toggleOn) {
				let panel = vscode.window.createWebviewPanel(fileUri + (windowCount++), 'Show Plan ' + windowCount, vscode.ViewColumn.One, {
					retainContextWhenHidden: false,
					enableScripts: false
				});

				let html = '<html><body>' +  escape(executionPlan).substring(0, 200)  + '</body></html>';
				panel.webview.html = html;
				panel.reveal(vscode.ViewColumn.One);

				// WIP --- not desired interface...
				sqlops.queryeditor.createWebviewPanel(fileUri);
			}
		}
	});
}

// this method is called when your extension is deactivated
export function deactivate(): void {
}

export function escape(html: string): string {
	return html.replace(/[<|>|&|"]/g, function (match) {
		switch (match) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '"': return '&quot;';
			case '\'': return '&#39';
			default: return match;
		}
	});
}
