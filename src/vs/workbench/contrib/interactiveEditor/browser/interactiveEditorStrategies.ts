/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ModifierKeyEmitter } from 'vs/base/browser/dom';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import 'vs/css!./interactiveEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { IBulkEditService } from 'vs/editor/browser/services/bulkEditService';
import { StableEditorScrollState } from 'vs/editor/browser/stableEditorScroll';
import { EditOperation, ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { IEditorDecorationsCollection } from 'vs/editor/common/editorCommon';
import { ICursorStateComputer, IModelDecorationOptions, IModelDeltaDecoration, IValidEditOperation } from 'vs/editor/common/model';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { localize } from 'vs/nls';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { InteractiveEditorFileCreatePreviewWidget, InteractiveEditorLivePreviewWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorLivePreviewWidget';
import { EditResponse, Session } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { InteractiveEditorWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorWidget';
import { CTX_INTERACTIVE_EDITOR_SHOWING_DIFF, CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IEditorService, SIDE_GROUP } from 'vs/workbench/services/editor/common/editorService';

export abstract class EditModeStrategy {

	abstract dispose(): void;

	abstract checkChanges(response: EditResponse): boolean;

	abstract apply(): Promise<void>;

	abstract cancel(): Promise<void>;

	abstract makeChanges(response: EditResponse, edits: ISingleEditOperation[]): Promise<void>;

	abstract renderChanges(response: EditResponse): Promise<void>;

	abstract toggleDiff(): void;

	abstract hasFocus(): boolean;
}

export class PreviewStrategy extends EditModeStrategy {

	private readonly _ctxDocumentChanged: IContextKey<boolean>;
	private readonly _listener: IDisposable;

	constructor(
		private readonly _session: Session,
		private readonly _widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IBulkEditService private readonly _bulkEditService: IBulkEditService,
		@IInstantiationService private readonly _instaService: IInstantiationService,
	) {
		super();

		this._ctxDocumentChanged = CTX_INTERACTIVE_EDITOR_DOCUMENT_CHANGED.bindTo(contextKeyService);
		this._listener = Event.debounce(_session.textModelN.onDidChangeContent.bind(_session.textModelN), () => { }, 350)(_ => {
			this._ctxDocumentChanged.set(!_session.textModelN.equalsTextBuffer(_session.textModel0.getTextBuffer()));
		});
	}

	override dispose(): void {
		this._listener.dispose();
		this._ctxDocumentChanged.reset();
	}

	checkChanges(response: EditResponse): boolean {
		if (!response.workspaceEdits || response.singleCreateFileEdit) {
			// preview stategy can handle simple workspace edit (single file create)
			return true;
		}
		this._bulkEditService.apply(response.workspaceEdits, { showPreview: true });
		return false;
	}

	async apply() {

		if (!(this._session.lastExchange?.response instanceof EditResponse)) {
			return;
		}
		const editResponse = this._session.lastExchange?.response;
		if (editResponse.workspaceEdits) {
			await this._bulkEditService.apply(editResponse.workspaceEdits);
			this._instaService.invokeFunction(showSingleCreateFile, editResponse);


		} else if (!editResponse.workspaceEditsIncludeLocalEdits) {

			const { textModelN: modelN } = this._session;

			if (modelN.equalsTextBuffer(this._session.textModel0.getTextBuffer())) {
				modelN.pushStackElement();
				const edits = editResponse.localEdits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
				modelN.pushEditOperations(null, edits, () => null);
				modelN.pushStackElement();
			}
		}
	}

	async cancel(): Promise<void> {
		// nothing to do
	}

	override async makeChanges(_response: EditResponse, _edits: ISingleEditOperation[]): Promise<void> {
		// nothing to do
	}

	override async renderChanges(response: EditResponse): Promise<void> {
		if (response.localEdits.length > 0) {
			const edits = response.localEdits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
			this._widget.showEditsPreview(this._session.textModel0, edits, this._session.lastTextModelChanges);
		} else {
			this._widget.hideEditsPreview();
		}

		if (response.singleCreateFileEdit) {
			this._widget.showCreatePreview(response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._widget.hideCreatePreview();
		}
	}

	toggleDiff(): void {
		// nothing to do
	}

	hasFocus(): boolean {
		return this._widget.hasFocus();
	}
}

class InlineDiffDecorations {

	private readonly _collection: IEditorDecorationsCollection;

	private _data: { tracking: IModelDeltaDecoration; decorating: IModelDecorationOptions }[] = [];
	private _visible: boolean = false;

	constructor(editor: ICodeEditor, visible: boolean = false) {
		this._collection = editor.createDecorationsCollection();
		this._visible = visible;
	}

	get visible() {
		return this._visible;
	}

	set visible(value: boolean) {
		this._visible = value;
		this.update();
	}

	clear() {
		this._collection.clear();
		this._data.length = 0;
	}

	collectEditOperation(op: IValidEditOperation) {
		this._data.push(InlineDiffDecorations._asDecorationData(op));
	}

	update() {
		this._collection.set(this._data.map(d => {
			const res = { ...d.tracking };
			if (this._visible) {
				res.options = { ...res.options, ...d.decorating };
			}
			return res;
		}));
	}

	private static _asDecorationData(edit: IValidEditOperation): { tracking: IModelDeltaDecoration; decorating: IModelDecorationOptions } {
		let content = edit.text;
		if (content.length > 12) {
			content = content.substring(0, 12) + '…';
		}
		const tracking: IModelDeltaDecoration = {
			range: edit.range,
			options: {
				description: 'interactive-editor-inline-diff',
			}
		};

		const decorating: IModelDecorationOptions = {
			description: 'interactive-editor-inline-diff',
			className: !edit.range.isEmpty() ? 'interactive-editor-lines-inserted-range' : undefined,
			showIfCollapsed: true,
			before: {
				content,
				inlineClassName: 'interactive-editor-lines-deleted-range-inline',
				attachedData: edit,
			}
		};

		return { tracking, decorating };
	}
}

export class LiveStrategy extends EditModeStrategy {

	private static _inlineDiffStorageKey: string = 'interactiveEditor.storage.inlineDiff';
	protected _diffEnabled: boolean = false;

	private readonly _inlineDiffDecorations: InlineDiffDecorations;
	private readonly _ctxShowingDiff: IContextKey<boolean>;
	private readonly _diffToggleListener: IDisposable;
	private _lastResponse?: EditResponse;
	private _editCount: number = 0;

	constructor(
		protected readonly _session: Session,
		protected readonly _editor: ICodeEditor,
		protected readonly _widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService protected _storageService: IStorageService,
		@IBulkEditService protected readonly _bulkEditService: IBulkEditService,
		@IEditorWorkerService protected readonly _editorWorkerService: IEditorWorkerService,
		@IInstantiationService private readonly _instaService: IInstantiationService,
	) {
		super();
		this._diffEnabled = _storageService.getBoolean(LiveStrategy._inlineDiffStorageKey, StorageScope.PROFILE, true);

		this._inlineDiffDecorations = new InlineDiffDecorations(this._editor, this._diffEnabled);
		this._ctxShowingDiff = CTX_INTERACTIVE_EDITOR_SHOWING_DIFF.bindTo(contextKeyService);
		this._ctxShowingDiff.set(this._diffEnabled);
		this._inlineDiffDecorations.visible = this._diffEnabled;
		const modKeys = ModifierKeyEmitter.getInstance();
		let lastIsAlt: boolean | undefined;
		this._diffToggleListener = modKeys.event(() => {
			const isAlt = modKeys.keyStatus.altKey && (!modKeys.keyStatus.ctrlKey && !modKeys.keyStatus.metaKey && !modKeys.keyStatus.shiftKey);
			if (lastIsAlt !== isAlt) {
				// this.toggleDiff();
				lastIsAlt = isAlt;
			}
		});
	}

	override dispose(): void {
		this._diffToggleListener.dispose();
		this._inlineDiffDecorations.clear();
		this._ctxShowingDiff.reset();
	}

	toggleDiff(): void {
		this._diffEnabled = !this._diffEnabled;
		this._ctxShowingDiff.set(this._diffEnabled);
		this._storageService.store(LiveStrategy._inlineDiffStorageKey, this._diffEnabled, StorageScope.PROFILE, StorageTarget.USER);
		this._doToggleDiff();
	}

	protected _doToggleDiff(): void {
		this._inlineDiffDecorations.visible = this._diffEnabled;
	}

	checkChanges(response: EditResponse): boolean {
		this._lastResponse = response;
		if (response.singleCreateFileEdit) {
			// preview stategy can handle simple workspace edit (single file create)
			return true;
		}
		if (response.workspaceEdits) {
			this._bulkEditService.apply(response.workspaceEdits, { showPreview: true });
			return false;
		}
		return true;
	}

	async apply() {
		if (this._editCount > 0) {
			this._editor.pushUndoStop();
		}
		if (this._lastResponse?.workspaceEdits) {
			await this._bulkEditService.apply(this._lastResponse.workspaceEdits);
			this._instaService.invokeFunction(showSingleCreateFile, this._lastResponse);
		}
	}

	async cancel() {
		const { textModelN: modelN, textModelNAltVersion, textModelNSnapshotAltVersion } = this._session;
		if (modelN.isDisposed()) {
			return;
		}
		const targetAltVersion = textModelNSnapshotAltVersion ?? textModelNAltVersion;
		while (targetAltVersion < modelN.getAlternativeVersionId() && modelN.canUndo()) {
			modelN.undo();
		}
	}

	override async makeChanges(_response: EditResponse, edits: ISingleEditOperation[], ignoreInlineDiff?: boolean): Promise<void> {
		const cursorStateComputerAndInlineDiffCollection: ICursorStateComputer = (undoEdits) => {
			let last: Position | null = null;
			for (const edit of undoEdits) {
				last = !last || last.isBefore(edit.range.getEndPosition()) ? edit.range.getEndPosition() : last;
				this._inlineDiffDecorations.collectEditOperation(edit);
			}
			return last && [Selection.fromPositions(last)];
		};

		// push undo stop before first edit
		if (++this._editCount === 1) {
			this._editor.pushUndoStop();
		}
		this._editor.executeEdits('interactive-editor-live', edits, ignoreInlineDiff ? undefined : cursorStateComputerAndInlineDiffCollection);
	}

	override async renderChanges(response: EditResponse) {

		this._inlineDiffDecorations.update();
		this._updateSummaryMessage();

		if (response.singleCreateFileEdit) {
			this._widget.showCreatePreview(response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._widget.hideCreatePreview();
		}
	}

	protected _updateSummaryMessage() {
		let linesChanged = 0;
		for (const change of this._session.lastTextModelChanges) {
			linesChanged += change.changedLineCount;
		}
		let message: string;
		if (linesChanged === 0) {
			message = localize('lines.0', "Nothing changed");
		} else if (linesChanged === 1) {
			message = localize('lines.1', "Changed 1 line");
		} else {
			message = localize('lines.N', "Changed {0} lines", linesChanged);
		}
		this._widget.updateStatus(message);
	}

	hasFocus(): boolean {
		return this._widget.hasFocus();
	}
}

export class LivePreviewStrategy extends LiveStrategy {

	private readonly _diffZone: InteractiveEditorLivePreviewWidget;
	private readonly _previewZone: InteractiveEditorFileCreatePreviewWidget;

	constructor(
		session: Session,
		editor: ICodeEditor,
		widget: InteractiveEditorWidget,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IStorageService storageService: IStorageService,
		@IBulkEditService bulkEditService: IBulkEditService,
		@IEditorWorkerService editorWorkerService: IEditorWorkerService,
		@IInstantiationService instaService: IInstantiationService,
	) {
		super(session, editor, widget, contextKeyService, storageService, bulkEditService, editorWorkerService, instaService);

		this._diffZone = instaService.createInstance(InteractiveEditorLivePreviewWidget, editor, session);
		this._previewZone = instaService.createInstance(InteractiveEditorFileCreatePreviewWidget, editor);
	}

	override dispose(): void {
		this._diffZone.hide();
		this._diffZone.dispose();
		this._previewZone.hide();
		this._previewZone.dispose();
		super.dispose();
	}

	override async makeChanges(_response: EditResponse, edits: ISingleEditOperation[]): Promise<void> {
		super.makeChanges(_response, edits, true);
	}

	override async renderChanges(response: EditResponse) {

		this._updateSummaryMessage();
		if (this._diffEnabled) {
			this._diffZone.show();
		}

		if (response.singleCreateFileEdit) {
			this._previewZone.showCreation(this._session.wholeRange, response.singleCreateFileEdit.uri, await Promise.all(response.singleCreateFileEdit.edits));
		} else {
			this._previewZone.hide();
		}
	}

	protected override _doToggleDiff(): void {
		const scrollState = StableEditorScrollState.capture(this._editor);
		if (this._diffEnabled) {
			this._diffZone.show();
		} else {
			this._diffZone.hide();
		}
		scrollState.restore(this._editor);
	}

	override hasFocus(): boolean {
		return super.hasFocus() || this._diffZone.hasFocus() || this._previewZone.hasFocus();
	}
}

function showSingleCreateFile(accessor: ServicesAccessor, edit: EditResponse) {
	const editorService = accessor.get(IEditorService);
	if (edit.singleCreateFileEdit) {
		editorService.openEditor({ resource: edit.singleCreateFileEdit.uri }, SIDE_GROUP);
	}
}
