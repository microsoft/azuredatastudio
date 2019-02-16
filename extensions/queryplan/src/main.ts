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
				let tab = sqlops.window.modelviewdialog.createTab('Query Watcher');
				tab.registerContent(async view => {
					let nameTextBox = view.modelBuilder.inputBox().component();
					let ownerTextBox = view.modelBuilder.inputBox().component();

					let formModel = view.modelBuilder.formContainer()
						.withFormItems([{
							component: nameTextBox,
							title: 'Name'
						}, {
							component: ownerTextBox,
							title: 'Owner'
						}]).withLayout({ width: '100%' }).component();

					await view.initializeModel(formModel);
				});

				sqlops.queryeditor.createQueryTab(fileUri, tab);
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
