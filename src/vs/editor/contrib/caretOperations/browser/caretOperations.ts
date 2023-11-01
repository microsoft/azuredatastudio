/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, IActionOptions, registerEditorAction, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { ICommand } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { MoveCaretCommand } from 'vs/editor/contrib/caretOperations/browser/moveCaretCommand';
import * as nls from 'vs/nls';

class MoveCaretAction extends EditorAction {

	private readonly left: boolean;

	constructor(left: boolean, opts: IActionOptions) {
		super(opts);

		this.left = left;
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		if (!editor.hasModel()) {
			return;
		}

		const commands: ICommand[] = [];
		const selections = editor.getSelections();

		for (const selection of selections) {
			commands.push(new MoveCaretCommand(selection, this.left));
		}

		editor.pushUndoStop();
		editor.executeCommands(this.id, commands);
		editor.pushUndoStop();
	}
}

class MoveCaretLeftAction extends MoveCaretAction {
	constructor() {
		super(true, {
			id: 'editor.action.moveCarretLeftAction',
			label: nls.localize('caret.moveLeft', "Move Selected Text Left"),
			alias: 'Move Selected Text Left',
			precondition: EditorContextKeys.writable
		});
	}
}

class MoveCaretRightAction extends MoveCaretAction {
	constructor() {
		super(false, {
			id: 'editor.action.moveCarretRightAction',
			label: nls.localize('caret.moveRight', "Move Selected Text Right"),
			alias: 'Move Selected Text Right',
			precondition: EditorContextKeys.writable
		});
	}
}

registerEditorAction(MoveCaretLeftAction);
registerEditorAction(MoveCaretRightAction);
