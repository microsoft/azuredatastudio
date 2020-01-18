/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { EditorAction } from 'vs/editor/browser/editorExtensions';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeyCode } from 'vs/base/common/keyCodes';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { QueryEditorVisible } from 'sql/workbench/contrib/query/common/queryContext';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { IConnectionManagementService, ConnectionType, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';

export class RunQueryEditorAction extends EditorAction {

	constructor() {
		super({
			id: 'workbench.queryEditor.runQuery',
			label: localize('workbench.queryEditor.runQuery', "Run Query"),
			alias: 'Run Query',
			precondition: QueryEditorVisible,
			kbOpts: { primary: KeyCode.F5, weight: KeybindingWeight.EditorContrib },
			contextMenuOpts: { group: '0_query', order: 1 }
		});
	}

	public run(accessor: ServicesAccessor): void | Promise<void> {
		const editorService = accessor.get(IEditorService);
		return (editorService.activeEditor as QueryEditorInput).runQuery();
	}
}

export class RunQuerySelectionEditorAction extends EditorAction {

	constructor() {
		super({
			id: 'workbench.queryEditor.runQuerySelection',
			label: localize('workbench.queryEditor.runQuerySelection', "Run Query Selection"),
			alias: 'Run Query Selection',
			precondition: ContextKeyExpr.and(QueryEditorVisible, EditorContextKeys.hasNonEmptySelection),
			kbOpts: { primary: KeyCode.F5, weight: KeybindingWeight.EditorContrib + 1 },
			contextMenuOpts: { group: '0_query', order: 2 }
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void | Promise<void> {
		const selection = editor.getSelection();
		const editorService = accessor.get(IEditorService);
		if (selection && !selection.isEmpty()) {
			(editorService.activeEditor as QueryEditorInput).runQuery(selection);
		}
	}
}

export class RunQueryStatementEditorActions extends EditorAction {

	constructor() {
		super({
			id: 'workbench.queryEditor.runQueryStatement',
			label: localize('workbench.queryEditor.runQueryStatement', "Run Query Statement"),
			alias: 'Run Query Statement',
			precondition: QueryEditorVisible,
			contextMenuOpts: { group: '0_query', order: 3 }
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void | Promise<void> {
		throw new Error('Method not implemented.');
	}
}

export class ConnectEditorAction extends EditorAction {

	constructor() {
		super({
			id: 'workbench.queryEditor.connect',
			label: localize('workbench.queryEditor.connect', "Connect"),
			alias: 'Connect',
			precondition: QueryEditorVisible,
			contextMenuOpts: { group: '0_query', order: 4 }
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void | Promise<void> {
		const cm = accessor.get(IConnectionManagementService);
		const input = accessor.get(IEditorService).activeEditor;
		let params: INewConnectionParams = {
			input: input as QueryEditorInput,
			connectionType: ConnectionType.editor
		};
		cm.showConnectionDialog(params);
	}
}
