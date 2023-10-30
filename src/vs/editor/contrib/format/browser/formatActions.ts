/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isNonEmptyArray } from 'vs/base/common/arrays';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { onUnexpectedError } from 'vs/base/common/errors';
import { KeyChord, KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorAction, EditorContributionInstantiation, registerEditorAction, registerEditorContribution, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { CharacterSet } from 'vs/editor/common/core/characterClassifier';
import { Range } from 'vs/editor/common/core/range';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { alertFormattingEdits, formatDocumentRangesWithSelectedProvider, formatDocumentWithSelectedProvider, FormattingMode, getOnTypeFormattingEdits } from 'vs/editor/contrib/format/browser/format';
import { FormattingEdit } from 'vs/editor/contrib/format/browser/formattingEdit';
import * as nls from 'vs/nls';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { IEditorProgressService, Progress } from 'vs/platform/progress/common/progress';

class FormatOnType implements IEditorContribution {

	public static readonly ID = 'editor.contrib.autoFormat';


	private readonly _disposables = new DisposableStore();
	private readonly _sessionDisposables = new DisposableStore();

	constructor(
		private readonly _editor: ICodeEditor,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IEditorWorkerService private readonly _workerService: IEditorWorkerService
	) {
		this._disposables.add(_languageFeaturesService.onTypeFormattingEditProvider.onDidChange(this._update, this));
		this._disposables.add(_editor.onDidChangeModel(() => this._update()));
		this._disposables.add(_editor.onDidChangeModelLanguage(() => this._update()));
		this._disposables.add(_editor.onDidChangeConfiguration(e => {
			if (e.hasChanged(EditorOption.formatOnType)) {
				this._update();
			}
		}));
		this._update();
	}

	dispose(): void {
		this._disposables.dispose();
		this._sessionDisposables.dispose();
	}

	private _update(): void {

		// clean up
		this._sessionDisposables.clear();

		// we are disabled
		if (!this._editor.getOption(EditorOption.formatOnType)) {
			return;
		}

		// no model
		if (!this._editor.hasModel()) {
			return;
		}

		const model = this._editor.getModel();

		// no support
		const [support] = this._languageFeaturesService.onTypeFormattingEditProvider.ordered(model);
		if (!support || !support.autoFormatTriggerCharacters) {
			return;
		}

		// register typing listeners that will trigger the format
		const triggerChars = new CharacterSet();
		for (const ch of support.autoFormatTriggerCharacters) {
			triggerChars.add(ch.charCodeAt(0));
		}
		this._sessionDisposables.add(this._editor.onDidType((text: string) => {
			const lastCharCode = text.charCodeAt(text.length - 1);
			if (triggerChars.has(lastCharCode)) {
				this._trigger(String.fromCharCode(lastCharCode));
			}
		}));
	}

	private _trigger(ch: string): void {
		if (!this._editor.hasModel()) {
			return;
		}

		if (this._editor.getSelections().length > 1 || !this._editor.getSelection().isEmpty()) {
			return;
		}

		const model = this._editor.getModel();
		const position = this._editor.getPosition();
		const cts = new CancellationTokenSource();

		// install a listener that checks if edits happens before the
		// position on which we format right now. If so, we won't
		// apply the format edits
		const unbind = this._editor.onDidChangeModelContent((e) => {
			if (e.isFlush) {
				// a model.setValue() was called
				// cancel only once
				cts.cancel();
				unbind.dispose();
				return;
			}

			for (let i = 0, len = e.changes.length; i < len; i++) {
				const change = e.changes[i];
				if (change.range.endLineNumber <= position.lineNumber) {
					// cancel only once
					cts.cancel();
					unbind.dispose();
					return;
				}
			}
		});

		getOnTypeFormattingEdits(
			this._workerService,
			this._languageFeaturesService,
			model,
			position,
			ch,
			model.getFormattingOptions(),
			cts.token
		).then(edits => {
			if (cts.token.isCancellationRequested) {
				return;
			}
			if (isNonEmptyArray(edits)) {
				FormattingEdit.execute(this._editor, edits, true);
				alertFormattingEdits(edits);
			}
		}).finally(() => {
			unbind.dispose();
		});
	}
}

class FormatOnPaste implements IEditorContribution {

	public static readonly ID = 'editor.contrib.formatOnPaste';

	private readonly _callOnDispose = new DisposableStore();
	private readonly _callOnModel = new DisposableStore();

	constructor(
		private readonly editor: ICodeEditor,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		this._callOnDispose.add(editor.onDidChangeConfiguration(() => this._update()));
		this._callOnDispose.add(editor.onDidChangeModel(() => this._update()));
		this._callOnDispose.add(editor.onDidChangeModelLanguage(() => this._update()));
		this._callOnDispose.add(_languageFeaturesService.documentRangeFormattingEditProvider.onDidChange(this._update, this));
	}

	dispose(): void {
		this._callOnDispose.dispose();
		this._callOnModel.dispose();
	}

	private _update(): void {

		// clean up
		this._callOnModel.clear();

		// we are disabled
		if (!this.editor.getOption(EditorOption.formatOnPaste)) {
			return;
		}

		// no model
		if (!this.editor.hasModel()) {
			return;
		}

		// no formatter
		if (!this._languageFeaturesService.documentRangeFormattingEditProvider.has(this.editor.getModel())) {
			return;
		}

		this._callOnModel.add(this.editor.onDidPaste(({ range }) => this._trigger(range)));
	}

	private _trigger(range: Range): void {
		if (!this.editor.hasModel()) {
			return;
		}
		if (this.editor.getSelections().length > 1) {
			return;
		}
		this._instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, this.editor, range, FormattingMode.Silent, Progress.None, CancellationToken.None).catch(onUnexpectedError);
	}
}

class FormatDocumentAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.formatDocument',
			label: nls.localize('formatDocument.label', "Format Document"),
			alias: 'Format Document',
			precondition: ContextKeyExpr.and(EditorContextKeys.notInCompositeEditor, EditorContextKeys.writable, EditorContextKeys.hasDocumentFormattingProvider),
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF,
				linux: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyI },
				weight: KeybindingWeight.EditorContrib
			},
			contextMenuOpts: {
				group: '1_modification',
				order: 1.3
			}
		});
	}

	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		if (editor.hasModel()) {
			const instaService = accessor.get(IInstantiationService);
			const progressService = accessor.get(IEditorProgressService);
			await progressService.showWhile(
				instaService.invokeFunction(formatDocumentWithSelectedProvider, editor, FormattingMode.Explicit, Progress.None, CancellationToken.None),
				250
			);
		}
	}
}

class FormatSelectionAction extends EditorAction {

	constructor() {
		super({
			id: 'editor.action.formatSelection',
			label: nls.localize('formatSelection.label', "Format Selection"),
			alias: 'Format Selection',
			precondition: ContextKeyExpr.and(EditorContextKeys.writable, EditorContextKeys.hasDocumentSelectionFormattingProvider),
			kbOpts: {
				kbExpr: EditorContextKeys.editorTextFocus,
				primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyF),
				weight: KeybindingWeight.EditorContrib
			},
			contextMenuOpts: {
				when: EditorContextKeys.hasNonEmptySelection,
				group: '1_modification',
				order: 1.31
			}
		});
	}

	async run(accessor: ServicesAccessor, editor: ICodeEditor): Promise<void> {
		if (!editor.hasModel()) {
			return;
		}
		const instaService = accessor.get(IInstantiationService);
		const model = editor.getModel();

		const ranges = editor.getSelections().map(range => {
			return range.isEmpty()
				? new Range(range.startLineNumber, 1, range.startLineNumber, model.getLineMaxColumn(range.startLineNumber))
				: range;
		});

		const progressService = accessor.get(IEditorProgressService);
		await progressService.showWhile(
			instaService.invokeFunction(formatDocumentRangesWithSelectedProvider, editor, ranges, FormattingMode.Explicit, Progress.None, CancellationToken.None),
			250
		);
	}
}

registerEditorContribution(FormatOnType.ID, FormatOnType, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorContribution(FormatOnPaste.ID, FormatOnPaste, EditorContributionInstantiation.BeforeFirstInteraction);
registerEditorAction(FormatDocumentAction);
registerEditorAction(FormatSelectionAction);

// this is the old format action that does both (format document OR format selection)
// and we keep it here such that existing keybinding configurations etc will still work
CommandsRegistry.registerCommand('editor.action.format', async accessor => {
	const editor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
	if (!editor || !editor.hasModel()) {
		return;
	}
	const commandService = accessor.get(ICommandService);
	if (editor.getSelection().isEmpty()) {
		await commandService.executeCommand('editor.action.formatDocument');
	} else {
		await commandService.executeCommand('editor.action.formatSelection');
	}
});
