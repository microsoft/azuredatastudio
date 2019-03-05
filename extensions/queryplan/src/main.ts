/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
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

	azdata.queryeditor.registerQueryInfoListener({
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
				let tab = azdata.window.modelviewdialog.createTab('Query Watcher');
				tab.registerContent(async view => {
					let fileNameTextBox = view.modelBuilder.inputBox().component();
					let xmlTextBox = view.modelBuilder.inputBox().component();

					let formModel = view.modelBuilder.formContainer()
						.withFormItems([{
							component: fileNameTextBox,
							title: 'File name'
						}, {
							component: xmlTextBox,
							title: 'Plan XML'
						}]).withLayout({ width: '100%' }).component();

					await view.initializeModel(formModel);

					fileNameTextBox.value = fileUri;
					xmlTextBox.value = executionPlan;
				});

				azdata.queryeditor.createQueryTab(fileUri, tab);

				// add a second tab to make sure that scenario works
				let tab2 = azdata.window.modelviewdialog.createTab('Query Watcher 2');
				tab2.registerContent(async view => {
					let xmlTextBox = view.modelBuilder.inputBox().component();

					let formModel = view.modelBuilder.formContainer()
						.withFormItems([{
							component: xmlTextBox,
							title: 'Plan XML'
						}]).withLayout({ width: '100%' }).component();

					await view.initializeModel(formModel);

					xmlTextBox.value = executionPlan;
				});

				azdata.queryeditor.createQueryTab(fileUri, tab2);
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
