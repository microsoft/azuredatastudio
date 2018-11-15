/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { EditorAction, IActionOptions, registerEditorAction } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { TPromise } from 'vs/base/common/winjs.base';
import { Registry } from 'vs/platform/registry/common/platform';

export interface IQueryActionOptions extends IActionOptions {
	class: string;
}

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryEditorAction extends EditorAction {

	public class: string;

	constructor(opts: IQueryActionOptions) {
		super(opts);
		this.class = opts.class;
	}

	/**
	 * This method is executed when the button is clicked.
	 */
	public abstract run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void>;
}


// Editor extension points
const Extensions = {
	EditorCommonContributions: 'editor.query.contributions'
};

class QueryEditorContributionRegistry {

	public static readonly INSTANCE = new QueryEditorContributionRegistry();

	// private queryEditorContributions: IEditorContributionCtor[];
	private queryEditorActions: QueryEditorAction[];
	// private queryDditorCommands: { [commandId: string]: EditorCommand; };

	constructor() {
		// this.queryEditorContributions = [];
		this.queryEditorActions = [];
		// this.queryEditorCommands = Object.create(null);
	}

	// public registerQueryEditorContribution(ctor: IEditorContributionCtor): void {
	// 	this.queryEditorContributions.push(ctor);
	// }

	public registerQueryEditorAction(action: QueryEditorAction) {
		action.register();
		this.queryEditorActions.push(action);
	}

	// public getQueryEditorContributions(): IEditorContributionCtor[] {
	// 	return this.queryEditorContributions.slice(0);
	// }

	public getQueryEditorActions(): QueryEditorAction[] {
		return this.queryEditorActions.slice(0);
	}

	// public registerEditorCommand(editorCommand: EditorCommand) {
	// 	editorCommand.register();
	// 	this.queryEditorCommands[editorCommand.id] = editorCommand;
	// }

	// public getEditorCommand(commandId: string): EditorCommand {
	// 	return (this.editorCommands[commandId] || null);
	// }

}
Registry.add(Extensions.EditorCommonContributions, QueryEditorContributionRegistry.INSTANCE);

export namespace QueryEditorExtensionsRegistry {

	// export function getEditorCommand(commandId: string): EditorCommand {
	// 	return QueryEditorContributionRegistry.INSTANCE.getEditorCommand(commandId);
	// }

	export function getEditorActions(): QueryEditorAction[] {
		return QueryEditorContributionRegistry.INSTANCE.getQueryEditorActions();
	}

	// export function getEditorContributions(): IEditorContributionCtor[] {
	// 	return QueryEditorContributionRegistry.INSTANCE.getEditorContributions();
	// }
}

export function registerQueryEditorAction(ctor: { new(): QueryEditorAction; }): void {
	QueryEditorContributionRegistry.INSTANCE.registerQueryEditorAction(new ctor());
	registerEditorAction(ctor);
}
