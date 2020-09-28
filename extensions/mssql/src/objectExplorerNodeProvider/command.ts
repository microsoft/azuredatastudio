/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from './treeNodes';
import { QuestionTypes, IPrompter, IQuestion } from '../prompts/question';
import * as utils from '../utils';
import * as constants from '../constants';
import { AppContext } from '../appContext';

interface ICommandContextParsingOptions {
	editor: boolean;
	uri: boolean;
}

interface ICommandBaseContext {
	command: string;
	editor?: vscode.TextEditor;
	uri?: vscode.Uri;
}

export interface ICommandUnknownContext extends ICommandBaseContext {
	type: 'unknown';
}

interface ICommandUriContext extends ICommandBaseContext {
	type: 'uri';
}

export interface ICommandViewContext extends ICommandBaseContext {
	type: 'view';
	node: TreeNode;
}

export interface ICommandObjectExplorerContext extends ICommandBaseContext {
	type: 'objectexplorer';
	explorerContext: azdata.ObjectExplorerContext;
}

type CommandContext = ICommandObjectExplorerContext | ICommandViewContext | ICommandUriContext | ICommandUnknownContext;

function isTextEditor(editor: any): editor is vscode.TextEditor {
	if (editor === undefined) { return false; }

	return editor.id !== undefined && ((editor as vscode.TextEditor).edit !== undefined || (editor as vscode.TextEditor).document !== undefined);
}

export abstract class Command extends vscode.Disposable {


	protected readonly contextParsingOptions: ICommandContextParsingOptions = { editor: false, uri: false };

	private disposable: vscode.Disposable;

	constructor(command: string | string[], protected appContext: AppContext) {
		super(() => this.dispose());

		if (typeof command === 'string') {
			this.disposable = vscode.commands.registerCommand(command, (...args: any[]) => this._execute(command, ...args), this);

			return;
		}

		const subscriptions = command.map(cmd => vscode.commands.registerCommand(cmd, (...args: any[]) => this._execute(cmd, ...args), this));
		this.disposable = vscode.Disposable.from(...subscriptions);
	}

	dispose(): void {
		if (this.disposable) {
			this.disposable.dispose();
		}
	}

	protected async preExecute(...args: any[]): Promise<any> {
		return this.execute(...args);
	}

	abstract execute(...args: any[]): any;

	protected _execute(command: string, ...args: any[]): any {
		// TODO consider using Telemetry.trackEvent(command);

		const [context, rest] = Command.parseContext(command, this.contextParsingOptions, ...args);
		return this.preExecute(context, ...rest);
	}

	private static parseContext(command: string, options: ICommandContextParsingOptions, ...args: any[]): [CommandContext, any[]] {
		let editor: vscode.TextEditor | undefined = undefined;

		let firstArg = args[0];
		if (options.editor && (firstArg === undefined || isTextEditor(firstArg))) {
			editor = firstArg;
			args = args.slice(1);
			firstArg = args[0];
		}

		if (options.uri && (firstArg === undefined || firstArg instanceof vscode.Uri)) {
			const [uri, ...rest] = args as [vscode.Uri, any];
			return [{ command: command, type: 'uri', editor: editor, uri: uri }, rest];
		}

		if (firstArg instanceof TreeNode) {
			const [node, ...rest] = args as [TreeNode, any];
			return [{ command: command, type: constants.ViewType, node: node }, rest];
		}

		if (firstArg && utils.isObjectExplorerContext(firstArg)) {
			const [explorerContext, ...rest] = args as [azdata.ObjectExplorerContext, any];
			return [{ command: command, type: constants.ObjectExplorerService, explorerContext: explorerContext }, rest];
		}

		return [{ command: command, type: 'unknown', editor: editor }, args];
	}
}

export abstract class ProgressCommand extends Command {
	static progressId = 0;
	constructor(command: string, protected prompter: IPrompter, appContext: AppContext) {
		super(command, appContext);
	}

	protected async executeWithProgress(
		execution: (cancelToken: vscode.CancellationTokenSource) => Promise<void>,
		label: string,
		isCancelable: boolean = false,
		onCanceled?: () => void
	): Promise<void> {
		let disposables: vscode.Disposable[] = [];
		const tokenSource = new vscode.CancellationTokenSource();
		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		disposables.push(vscode.Disposable.from(statusBarItem));
		statusBarItem.text = localize('progress', "$(sync~spin) {0}...", label);
		if (isCancelable) {
			const cancelCommandId = `cancelProgress${ProgressCommand.progressId++}`;
			disposables.push(vscode.commands.registerCommand(cancelCommandId, async () => {
				if (await this.confirmCancel()) {
					tokenSource.cancel();
				}
			}));
			statusBarItem.tooltip = localize('cancelTooltip', "Cancel");
			statusBarItem.command = cancelCommandId;
		}
		statusBarItem.show();

		try {
			await execution(tokenSource);
		} catch (error) {
			if (isCancelable && onCanceled && tokenSource.token.isCancellationRequested) {
				// The error can be assumed to be due to cancelation occurring. Do the callback
				onCanceled();
			} else {
				throw error;
			}
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	private async confirmCancel(): Promise<boolean> {
		return await this.prompter.promptSingle<boolean>(<IQuestion>{
			type: QuestionTypes.confirm,
			message: localize('cancel', "Cancel operation?"),
			default: true
		});
	}
}

export function registerSearchServerCommand(appContext: AppContext): void {
	vscode.commands.registerCommand('mssql.searchServers', () => {
		vscode.window.showInputBox({
			placeHolder: localize('mssql.searchServers', "Search Server Names")
		}).then((stringSearch) => {
			if (stringSearch) {
				vscode.commands.executeCommand('registeredServers.searchServer', (stringSearch));
			}
		});
	});
	vscode.commands.registerCommand('mssql.clearSearchServerResult', () => {
		vscode.commands.executeCommand('registeredServers.clearSearchServerResult');
	});
}
