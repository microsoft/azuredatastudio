/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from 'vs/base/common/codicons';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction2 } from 'vs/editor/browser/editorExtensions';
import { EmbeddedCodeEditorWidget, EmbeddedDiffEditorWidget } from 'vs/editor/browser/widget/embeddedCodeEditorWidget';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { InteractiveEditorController, InteractiveEditorRunOptions } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorController';
import { CTX_INTERACTIVE_EDITOR_FOCUSED, CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST, CTX_INTERACTIVE_EDITOR_HAS_PROVIDER, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_FIRST, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_LAST, CTX_INTERACTIVE_EDITOR_EMPTY, CTX_INTERACTIVE_EDITOR_OUTER_CURSOR_POSITION, CTX_INTERACTIVE_EDITOR_VISIBLE, MENU_INTERACTIVE_EDITOR_WIDGET, MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD, MENU_INTERACTIVE_EDITOR_WIDGET_STATUS, CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK, CTX_INTERACTIVE_EDITOR_SHOWING_DIFF, CTX_INTERACTIVE_EDITOR_EDIT_MODE, EditMode, CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE, MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE, CTX_INTERACTIVE_EDITOR_MESSAGE_CROP_STATE, CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED, CTX_INTERACTIVE_EDITOR_DID_EDIT, CTX_INTERACTIVE_EDITOR_HAS_STASHED_SESSION, MENU_INTERACTIVE_EDITOR_WIDGET_FEEDBACK, ACTION_ACCEPT_CHANGES } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { localize } from 'vs/nls';
import { IAction2Options, MenuRegistry } from 'vs/platform/actions/common/actions';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { IEditorService, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextResourceEditorInput } from 'vs/workbench/common/editor';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { Range } from 'vs/editor/common/core/range';
import { fromNow } from 'vs/base/common/date';
import { IInteractiveEditorSessionService, Recording } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { runAccessibilityHelpAction } from 'vs/workbench/contrib/chat/browser/actions/chatAccessibilityHelp';
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from 'vs/platform/accessibility/common/accessibility';


export class StartSessionAction extends EditorAction2 {

	constructor() {
		super({
			id: 'interactiveEditor.start',
			title: { value: localize('run', 'Start Code Chat'), original: 'Start Code Chat' },
			category: AbstractInteractiveEditorAction.category,
			f1: true,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_HAS_PROVIDER, EditorContextKeys.writable),
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyI,
				secondary: [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyI)],
			}
		});
	}

	private _isInteractivEditorOptions(options: any): options is InteractiveEditorRunOptions {
		const { initialRange, message, autoSend } = options;
		if (
			typeof message !== 'undefined' && typeof message !== 'string'
			|| typeof autoSend !== 'undefined' && typeof autoSend !== 'boolean'
			|| typeof initialRange !== 'undefined' && !Range.isIRange(initialRange)) {
			return false;
		}
		return true;
	}

	override runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor, ..._args: any[]) {
		let options: InteractiveEditorRunOptions | undefined;
		const arg = _args[0];
		if (arg && this._isInteractivEditorOptions(arg)) {
			options = arg;
		}
		InteractiveEditorController.get(editor)?.run(options);
	}
}

export class UnstashSessionAction extends EditorAction2 {
	constructor() {
		super({
			id: 'interactiveEditor.unstash',
			title: { value: localize('unstash', 'Resume Last Dismissed Code Chat'), original: 'Resume Last Dismissed Code Chat' },
			category: AbstractInteractiveEditorAction.category,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_HAS_STASHED_SESSION, EditorContextKeys.writable),
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyMod.CtrlCmd | KeyCode.KeyZ,
			}
		});
	}

	override runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor, ..._args: any[]) {
		const ctrl = InteractiveEditorController.get(editor);
		if (ctrl) {
			const session = ctrl.unstashLastSession();
			if (session) {
				ctrl.run({
					existingSession: session,
					isUnstashed: true
				});
			}
		}
	}
}

abstract class AbstractInteractiveEditorAction extends EditorAction2 {

	static readonly category = { value: localize('cat', 'Interactive Editor'), original: 'Interactive Editor' };

	constructor(desc: IAction2Options) {
		super({
			...desc,
			category: AbstractInteractiveEditorAction.category,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_HAS_PROVIDER, desc.precondition)
		});
	}

	override runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor, ..._args: any[]) {
		if (editor instanceof EmbeddedCodeEditorWidget) {
			editor = editor.getParentEditor();
		}
		const ctrl = InteractiveEditorController.get(editor);
		if (!ctrl) {
			for (const diffEditor of accessor.get(ICodeEditorService).listDiffEditors()) {
				if (diffEditor.getOriginalEditor() === editor || diffEditor.getModifiedEditor() === editor) {
					if (diffEditor instanceof EmbeddedDiffEditorWidget) {
						this.runEditorCommand(accessor, diffEditor.getParentEditor(), ..._args);
					}
				}
			}
			return;
		}
		this.runInteractiveEditorCommand(accessor, ctrl, editor, ..._args);
	}

	abstract runInteractiveEditorCommand(accessor: ServicesAccessor, ctrl: InteractiveEditorController, editor: ICodeEditor, ...args: any[]): void;
}


export class MakeRequestAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.accept',
			title: localize('accept', 'Make Request'),
			icon: Codicon.send,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_EMPTY.negate()),
			keybinding: {
				when: CTX_INTERACTIVE_EDITOR_FOCUSED,
				weight: KeybindingWeight.EditorCore + 7,
				primary: KeyCode.Enter
			},
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET,
				group: 'main',
				order: 1,
				when: CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST.isEqualTo(false)
			}
		});
	}

	runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.accept();
	}
}

export class StopRequestAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.stop',
			title: localize('stop', 'Stop Request'),
			icon: Codicon.debugStop,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_EMPTY.negate(), CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST),
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET,
				group: 'main',
				order: 1,
				when: CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST
			},
			keybinding: {
				weight: KeybindingWeight.EditorContrib,
				primary: KeyCode.Escape
			}
		});
	}

	runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.cancelCurrentRequest();
	}
}

export class ArrowOutUpAction extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.arrowOutUp',
			title: localize('arrowUp', 'Cursor Up'),
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_FOCUSED, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_FIRST, EditorContextKeys.isEmbeddedDiffEditor.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
			keybinding: {
				weight: KeybindingWeight.EditorCore,
				primary: KeyCode.UpArrow
			}
		});
	}

	runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.arrowOut(true);
	}
}

export class ArrowOutDownAction extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.arrowOutDown',
			title: localize('arrowDown', 'Cursor Down'),
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_FOCUSED, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_LAST, EditorContextKeys.isEmbeddedDiffEditor.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
			keybinding: {
				weight: KeybindingWeight.EditorCore,
				primary: KeyCode.DownArrow
			}
		});
	}

	runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.arrowOut(false);
	}
}

export class FocusInteractiveEditor extends EditorAction2 {

	constructor() {
		super({
			id: 'interactiveEditor.focus',
			title: { value: localize('focus', 'Focus Input'), original: 'Focus Input' },
			f1: true,
			category: AbstractInteractiveEditorAction.category,
			precondition: ContextKeyExpr.and(EditorContextKeys.editorTextFocus, CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_FOCUSED.negate(), CONTEXT_ACCESSIBILITY_MODE_ENABLED.negate()),
			keybinding: [{
				weight: KeybindingWeight.EditorCore + 10, // win against core_command
				when: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_OUTER_CURSOR_POSITION.isEqualTo('above'), EditorContextKeys.isEmbeddedDiffEditor.negate()),
				primary: KeyCode.DownArrow,
			}, {
				weight: KeybindingWeight.EditorCore + 10, // win against core_command
				when: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_OUTER_CURSOR_POSITION.isEqualTo('below'), EditorContextKeys.isEmbeddedDiffEditor.negate()),
				primary: KeyCode.UpArrow,
			}]
		});
	}

	override runEditorCommand(_accessor: ServicesAccessor, editor: ICodeEditor, ..._args: any[]) {
		InteractiveEditorController.get(editor)?.focus();
	}
}

export class PreviousFromHistory extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.previousFromHistory',
			title: localize('previousFromHistory', 'Previous From History'),
			precondition: CTX_INTERACTIVE_EDITOR_FOCUSED,
			keybinding: {
				weight: KeybindingWeight.EditorCore + 10, // win against core_command
				primary: KeyMod.CtrlCmd | KeyCode.UpArrow,
			}
		});
	}

	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.populateHistory(true);
	}
}

export class NextFromHistory extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.nextFromHistory',
			title: localize('nextFromHistory', 'Next From History'),
			precondition: CTX_INTERACTIVE_EDITOR_FOCUSED,
			keybinding: {
				weight: KeybindingWeight.EditorCore + 10, // win against core_command
				primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
			}
		});
	}

	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.populateHistory(false);
	}
}

MenuRegistry.appendMenuItem(MENU_INTERACTIVE_EDITOR_WIDGET_STATUS, {
	submenu: MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD,
	title: localize('discardMenu', "Discard..."),
	icon: Codicon.discard,
	group: '0_main',
	order: 2,
	when: CTX_INTERACTIVE_EDITOR_EDIT_MODE.notEqualsTo(EditMode.Preview),
	rememberDefaultAction: true
});


export class DiscardAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.discard',
			title: localize('discard', 'Discard'),
			icon: Codicon.discard,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			keybinding: {
				weight: KeybindingWeight.EditorContrib,
				primary: KeyCode.Escape
			},
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD,
				group: '0_main',
				order: 0
			}
		});
	}

	async runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): Promise<void> {
		await ctrl.cancelSession();
	}
}

export class DiscardToClipboardAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.discardToClipboard',
			title: localize('undo.clipboard', 'Discard to Clipboard'),
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_DID_EDIT),
			// keybinding: {
			// 	weight: KeybindingWeight.EditorContrib + 10,
			// 	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ,
			// 	mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyZ },
			// },
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD,
				group: '0_main',
				order: 1
			}
		});
	}

	override async runInteractiveEditorCommand(accessor: ServicesAccessor, ctrl: InteractiveEditorController): Promise<void> {
		const clipboardService = accessor.get(IClipboardService);
		const changedText = await ctrl.cancelSession();
		if (changedText !== undefined) {
			clipboardService.writeText(changedText);
		}
	}
}

export class DiscardUndoToNewFileAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.discardToFile',
			title: localize('undo.newfile', 'Discard to New File'),
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_DID_EDIT),
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD,
				group: '0_main',
				order: 2
			}
		});
	}

	override async runInteractiveEditorCommand(accessor: ServicesAccessor, ctrl: InteractiveEditorController, editor: ICodeEditor, ..._args: any[]): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const changedText = await ctrl.cancelSession();
		if (changedText !== undefined) {
			const input: IUntitledTextResourceEditorInput = { forceUntitled: true, resource: undefined, contents: changedText, languageId: editor.getModel()?.getLanguageId() };
			editorService.openEditor(input, SIDE_GROUP);
		}
	}
}

export class FeebackHelpfulCommand extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.feedbackHelpful',
			title: localize('feedback.helpful', 'Helpful'),
			icon: Codicon.thumbsup,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			toggled: CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK.isEqualTo('helpful'),
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_FEEDBACK,
				when: CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.notEqualsTo(undefined),
				group: '2_feedback',
				order: 1
			}
		});
	}

	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController): void {
		ctrl.feedbackLast(true);
	}
}

export class FeebackUnhelpfulCommand extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.feedbackunhelpful',
			title: localize('feedback.unhelpful', 'Unhelpful'),
			icon: Codicon.thumbsdown,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			toggled: CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK.isEqualTo('unhelpful'),
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_FEEDBACK,
				when: CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.notEqualsTo(undefined),
				group: '2_feedback',
				order: 2
			}
		});
	}

	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController): void {
		ctrl.feedbackLast(false);
	}
}

export class ToggleInlineDiff extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.toggleDiff',
			title: localize('toggleDiff', 'Toggle Diff'),
			icon: Codicon.diff,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_DID_EDIT),
			toggled: { condition: CTX_INTERACTIVE_EDITOR_SHOWING_DIFF, title: localize('toggleDiff2', "Show Inline Diff") },
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_DISCARD,
				when: CTX_INTERACTIVE_EDITOR_EDIT_MODE.notEqualsTo(EditMode.Preview),
				group: '1_config',
				order: 9
			}
		});
	}

	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController): void {
		ctrl.toggleDiff();
	}
}

export class ApplyPreviewEdits extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: ACTION_ACCEPT_CHANGES,
			title: localize('apply1', 'Accept Changes'),
			shortTitle: localize('apply2', 'Accept'),
			icon: Codicon.check,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, ContextKeyExpr.or(CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED.toNegated(), CTX_INTERACTIVE_EDITOR_EDIT_MODE.notEqualsTo(EditMode.Preview))),
			keybinding: [{
				weight: KeybindingWeight.EditorContrib + 10,
				primary: KeyMod.CtrlCmd | KeyCode.Enter,
			}],
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_STATUS,
				group: '0_main',
				order: 0
			}
		});
	}

	override async runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController): Promise<void> {
		await ctrl.applyChanges();
	}
}

export class CancelSessionAction extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.cancel',
			title: localize('cancel', 'Cancel'),
			icon: Codicon.clearAll,
			precondition: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_VISIBLE, CTX_INTERACTIVE_EDITOR_EDIT_MODE.isEqualTo(EditMode.Preview)),
			keybinding: {
				weight: KeybindingWeight.EditorContrib - 1,
				primary: KeyCode.Escape
			},
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_STATUS,
				when: CTX_INTERACTIVE_EDITOR_EDIT_MODE.isEqualTo(EditMode.Preview),
				group: '0_main',
				order: 1
			}
		});
	}

	async runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): Promise<void> {
		await ctrl.cancelSession();
	}
}

export class CopyRecordings extends AbstractInteractiveEditorAction {

	constructor() {
		super({
			id: 'interactiveEditor.copyRecordings',
			f1: true,
			title: {
				value: localize('copyRecordings', '(Developer) Write Exchange to Clipboard'),
				original: '(Developer) Write Exchange to Clipboard'
			}
		});
	}

	override async runInteractiveEditorCommand(accessor: ServicesAccessor): Promise<void> {

		const clipboardService = accessor.get(IClipboardService);
		const quickPickService = accessor.get(IQuickInputService);
		const ieSessionService = accessor.get(IInteractiveEditorSessionService);

		const recordings = ieSessionService.recordings().filter(r => r.exchanges.length > 0);
		if (recordings.length === 0) {
			return;
		}

		const picks: (IQuickPickItem & { rec: Recording })[] = recordings.map(rec => {
			return {
				rec,
				label: localize('label', "'{0}' and {1} follow ups ({2})", rec.exchanges[0].prompt, rec.exchanges.length - 1, fromNow(rec.when, true)),
				tooltip: rec.exchanges.map(ex => ex.prompt).join('\n'),
			};
		});

		const pick = await quickPickService.pick(picks, { canPickMany: false });
		if (pick) {
			clipboardService.writeText(JSON.stringify(pick.rec, undefined, 2));
		}
	}
}

export class ViewInChatAction extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.viewInChat',
			title: localize('viewInChat', 'View in Chat'),
			icon: Codicon.commentDiscussion,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE,
				when: CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.isEqualTo('message'),
				group: '1_viewInChat',
				order: 1
			}
		});
	}
	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.viewInChat();
	}
}

export class ExpandMessageAction extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.expandMessageAction',
			title: localize('expandMessage', 'Expand Message'),
			icon: Codicon.chevronDown,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE,
				when: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.isEqualTo('message'), CTX_INTERACTIVE_EDITOR_MESSAGE_CROP_STATE.isEqualTo('cropped')),
				group: '2_expandOrContract',
				order: 1
			}
		});
	}
	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.updateExpansionState(true);
	}
}

export class ContractMessageAction extends AbstractInteractiveEditorAction {
	constructor() {
		super({
			id: 'interactiveEditor.contractMessageAction',
			title: localize('contractMessage', 'Contract Message'),
			icon: Codicon.chevronUp,
			precondition: CTX_INTERACTIVE_EDITOR_VISIBLE,
			menu: {
				id: MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE,
				when: ContextKeyExpr.and(CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.isEqualTo('message'), CTX_INTERACTIVE_EDITOR_MESSAGE_CROP_STATE.isEqualTo('expanded')),
				group: '2_expandOrContract',
				order: 1
			}
		});
	}
	override runInteractiveEditorCommand(_accessor: ServicesAccessor, ctrl: InteractiveEditorController, _editor: ICodeEditor, ..._args: any[]): void {
		ctrl.updateExpansionState(false);
	}
}

export class AccessibilityHelpEditorAction extends EditorAction2 {
	constructor() {
		super({
			id: 'interactiveEditor.accessibilityHelp',
			title: localize('actions.interactiveSession.accessibiltyHelpEditor', "Interactive Session Editor Accessibility Help"),
			category: AbstractInteractiveEditorAction.category,
			keybinding: {
				when: CTX_INTERACTIVE_EDITOR_FOCUSED,
				primary: KeyMod.Alt | KeyCode.F1,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}
	async runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		runAccessibilityHelpAction(accessor, editor, 'editor');
	}
}
