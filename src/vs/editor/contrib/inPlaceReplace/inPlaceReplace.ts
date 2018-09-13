/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vs/nls';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { TPromise } from 'vs/base/common/winjs.base';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { registerEditorAction, ServicesAccessor, EditorAction, registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { IInplaceReplaceSupportResult } from 'vs/editor/common/modes';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorkerService';
import { InPlaceReplaceCommand } from './inPlaceReplaceCommand';
import { EditorState, CodeEditorStateFlag } from 'vs/editor/browser/core/editorState';
import { registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { editorBracketMatchBorder } from 'vs/editor/common/view/editorColorRegistry';
import { ModelDecorationOptions } from 'vs/editor/common/model/textModel';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { CancelablePromise, createCancelablePromise, timeout } from 'vs/base/common/async';
import { onUnexpectedError } from 'vs/base/common/errors';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

class InPlaceReplaceController implements IEditorContribution {

	private static readonly ID = 'editor.contrib.inPlaceReplaceController';

	static get(editor: ICodeEditor): InPlaceReplaceController {
		return editor.getContribution<InPlaceReplaceController>(InPlaceReplaceController.ID);
	}

	private static readonly DECORATION = ModelDecorationOptions.register({
		className: 'valueSetReplacement'
	});

	private readonly editor: ICodeEditor;
	private readonly editorWorkerService: IEditorWorkerService;
	private decorationIds: string[] = [];
	private currentRequest: CancelablePromise<IInplaceReplaceSupportResult>;
	private decorationRemover: CancelablePromise<void>;

	constructor(
		editor: ICodeEditor,
		@IEditorWorkerService editorWorkerService: IEditorWorkerService
	) {
		this.editor = editor;
		this.editorWorkerService = editorWorkerService;
	}

	public dispose(): void {
	}

	public getId(): string {
		return InPlaceReplaceController.ID;
	}

	public run(source: string, up: boolean): Thenable<void> {

		// cancel any pending request
		if (this.currentRequest) {
			this.currentRequest.cancel();
		}

		let selection = this.editor.getSelection();
		const model = this.editor.getModel();
		const modelURI = model.uri;

		if (selection.startLineNumber !== selection.endLineNumber) {
			// Can't accept multiline selection
			return null;
		}

		const state = new EditorState(this.editor, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position);

		if (!this.editorWorkerService.canNavigateValueSet(modelURI)) {
			return undefined;
		}

		this.currentRequest = createCancelablePromise(token => this.editorWorkerService.navigateValueSet(modelURI, selection, up));

		return this.currentRequest.then(result => {

			if (!result || !result.range || !result.value) {
				// No proper result
				return;
			}

			if (!state.validate(this.editor)) {
				// state has changed
				return;
			}

			// Selection
			let editRange = Range.lift(result.range);
			let highlightRange = result.range;
			let diff = result.value.length - (selection.endColumn - selection.startColumn);

			// highlight
			highlightRange = {
				startLineNumber: highlightRange.startLineNumber,
				startColumn: highlightRange.startColumn,
				endLineNumber: highlightRange.endLineNumber,
				endColumn: highlightRange.startColumn + result.value.length
			};
			if (diff > 1) {
				selection = new Selection(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn + diff - 1);
			}

			// Insert new text
			const command = new InPlaceReplaceCommand(editRange, selection, result.value);

			this.editor.pushUndoStop();
			this.editor.executeCommand(source, command);
			this.editor.pushUndoStop();

			// add decoration
			this.decorationIds = this.editor.deltaDecorations(this.decorationIds, [{
				range: highlightRange,
				options: InPlaceReplaceController.DECORATION
			}]);

			// remove decoration after delay
			if (this.decorationRemover) {
				this.decorationRemover.cancel();
			}
			this.decorationRemover = timeout(350);
			this.decorationRemover.then(() => this.decorationIds = this.editor.deltaDecorations(this.decorationIds, [])).catch(onUnexpectedError);

		}).catch(onUnexpectedError);
	}
}

class InPlaceReplaceUp extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.inPlaceReplace.up',
			label: nls.localize('InPlaceReplaceAction.previous.label', "Replace with Previous Value"),
			alias: 'Replace with Previous Value',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.US_COMMA,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void> {
		let controller = InPlaceReplaceController.get(editor);
		if (!controller) {
			return undefined;
		}
		return TPromise.wrap(controller.run(this.id, true));
	}
}

class InPlaceReplaceDown extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.inPlaceReplace.down',
			label: nls.localize('InPlaceReplaceAction.next.label', "Replace with Next Value"),
			alias: 'Replace with Next Value',
			precondition: EditorContextKeys.writable,
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.US_DOT,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void> {
		let controller = InPlaceReplaceController.get(editor);
		if (!controller) {
			return undefined;
		}
		return TPromise.wrap(controller.run(this.id, false));
	}
}

registerEditorContribution(InPlaceReplaceController);
registerEditorAction(InPlaceReplaceUp);
registerEditorAction(InPlaceReplaceDown);

registerThemingParticipant((theme, collector) => {
	let border = theme.getColor(editorBracketMatchBorder);
	if (border) {
		collector.addRule(`.monaco-editor.vs .valueSetReplacement { outline: solid 2px ${border}; }`);
	}
});
