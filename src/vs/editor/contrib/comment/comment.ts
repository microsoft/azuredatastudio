/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, IActionOptions, registerEditorAction, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { Range } from 'vs/editor/common/core/range';
import { ICommand } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { BlockCommentCommand } from 'vs/editor/contrib/comment/blockCommentCommand';
import { LineCommentCommand, Type } from 'vs/editor/contrib/comment/lineCommentCommand';
import * as nls from 'vs/nls';
// import { MenuId } from 'vs/platform/actions/common/actions'; {{SQL CARBON EDIT}}
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

abstract class CommentLineAction extends EditorAction {

	private readonly _type: Type;

	constructor(type: Type, opts: IActionOptions) {
		super(opts);
		this._type = type;
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		if (!editor.hasModel()) {
			return;
		}

		const model = editor.getModel();
		const commands: ICommand[] = [];
		const modelOptions = model.getOptions();
		const commentsOptions = editor.getOption(EditorOption.comments);

		const selections = editor.getSelections().map((selection, index) => ({ selection, index, ignoreFirstLine: false }));
		selections.sort((a, b) => Range.compareRangesUsingStarts(a.selection, b.selection));

		// Remove selections that would result in copying the same line
		let prev = selections[0];
		for (let i = 1; i < selections.length; i++) {
			const curr = selections[i];
			if (prev.selection.endLineNumber === curr.selection.startLineNumber) {
				// these two selections would copy the same line
				if (prev.index < curr.index) {
					// prev wins
					curr.ignoreFirstLine = true;
				} else {
					// curr wins
					prev.ignoreFirstLine = true;
					prev = curr;
				}
			}
		}


		for (const selection of selections) {
			commands.push(new LineCommentCommand(
				selection.selection,
				modelOptions.tabSize,
				this._type,
				commentsOptions.insertSpace,
				commentsOptions.ignoreEmptyLines,
				selection.ignoreFirstLine
			));
		}

		editor.pushUndoStop();
		editor.executeCommands(this.id, commands);
		editor.pushUndoStop();
	}

}

class ToggleCommentLineAction extends CommentLineAction {
	constructor() {
		super(Type.Toggle, {
			id: 'editor.action.commentLine',
			label: nls.localize('comment.line', "Toggle Line Comment"),
			alias: 'Toggle Line Comment',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyCode.Slash,
				weight: KeybindingWeight.EditorContrib
			},
			/*menuOpts: { {{SQL CARBON EDIT}} - Remove from menu
				menuId: MenuId.MenubarEditMenu,
				group: '5_insert',
				title: nls.localize({ key: 'miToggleLineComment', comment: ['&& denotes a mnemonic'] }, "&&Toggle Line Comment"),
				order: 1
			}*/
		});
	}
}

class AddLineCommentAction extends CommentLineAction {
	constructor() {
		super(Type.ForceAdd, {
			id: 'editor.action.addCommentLine',
			label: nls.localize('comment.line.add', "Add Line Comment"),
			alias: 'Add Line Comment',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyC),
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
}

class RemoveLineCommentAction extends CommentLineAction {
	constructor() {
		super(Type.ForceRemove, {
			id: 'editor.action.removeCommentLine',
			label: nls.localize('comment.line.remove', "Remove Line Comment"),
			alias: 'Remove Line Comment',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyU),
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
}

class BlockCommentAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.blockComment',
			label: nls.localize('comment.block', "Toggle Block Comment"),
			alias: 'Toggle Block Comment',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyA,
				linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyA },
				weight: KeybindingWeight.EditorContrib
			},
			/*menuOpts: { {{SQL CARBON EDIT}} - Remove from menu
				menuId: MenuId.MenubarEditMenu,
				group: '5_insert',
				title: nls.localize({ key: 'miToggleBlockComment', comment: ['&& denotes a mnemonic'] }, "Toggle &&Block Comment"),
				order: 2
			}*/
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): void {
		if (!editor.hasModel()) {
			return;
		}

		const commentsOptions = editor.getOption(EditorOption.comments);
		const commands: ICommand[] = [];
		const selections = editor.getSelections();
		for (const selection of selections) {
			commands.push(new BlockCommentCommand(selection, commentsOptions.insertSpace));
		}

		editor.pushUndoStop();
		editor.executeCommands(this.id, commands);
		editor.pushUndoStop();
	}
}

registerEditorAction(ToggleCommentLineAction);
registerEditorAction(AddLineCommentAction);
registerEditorAction(RemoveLineCommentAction);
registerEditorAction(BlockCommentAction);
