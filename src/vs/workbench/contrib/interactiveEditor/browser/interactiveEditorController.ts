/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { renderMarkdown } from 'vs/base/browser/markdownRenderer';
import { Barrier, raceCancellationError } from 'vs/base/common/async';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { Emitter, Event } from 'vs/base/common/event';
import { DisposableStore, IDisposable, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { isEqual } from 'vs/base/common/resources';
import { StopWatch } from 'vs/base/common/stopwatch';
import { assertType } from 'vs/base/common/types';
import 'vs/css!./interactiveEditor';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { Position } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { ModelDecorationOptions, createTextBufferFactoryFromSnapshot } from 'vs/editor/common/model/textModel';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { IModelService } from 'vs/editor/common/services/model';
import { InlineCompletionsController } from 'vs/editor/contrib/inlineCompletions/browser/inlineCompletionsController';
import { localize } from 'vs/nls';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { EditResponse, EmptyResponse, ErrorResponse, IInteractiveEditorSessionService, MarkdownResponse, Session, SessionExchange } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { EditModeStrategy, LivePreviewStrategy, LiveStrategy, PreviewStrategy } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorStrategies';
import { InteractiveEditorZoneWidget } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorWidget';
import { CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST, CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK, IInteractiveEditorRequest, IInteractiveEditorResponse, INTERACTIVE_EDITOR_ID, EditMode, InteractiveEditorResponseFeedbackKind, CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE, InteractiveEditorResponseType, CTX_INTERACTIVE_EDITOR_DID_EDIT, CTX_INTERACTIVE_EDITOR_HAS_STASHED_SESSION } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IChatWidgetService } from 'vs/workbench/contrib/chat/browser/chat';
import { IChatService } from 'vs/workbench/contrib/chat/common/chatService';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/services/notebookEditorService';
import { CellUri } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { Lazy } from 'vs/base/common/lazy';

export const enum State {
	CREATE_SESSION = 'CREATE_SESSION',
	INIT_UI = 'INIT_UI',
	WAIT_FOR_INPUT = 'WAIT_FOR_INPUT',
	MAKE_REQUEST = 'MAKE_REQUEST',
	APPLY_RESPONSE = 'APPLY_RESPONSE',
	SHOW_RESPONSE = 'SHOW_RESPONSE',
	PAUSE = 'PAUSE',
	CANCEL = 'CANCEL',
	ACCEPT = 'DONE',
}

const enum Message {
	NONE = 0,
	ACCEPT_SESSION = 1 << 0,
	CANCEL_SESSION = 1 << 1,
	PAUSE_SESSION = 1 << 2,
	CANCEL_REQUEST = 1 << 3,
	CANCEL_INPUT = 1 << 4,
	ACCEPT_INPUT = 1 << 5
}

export interface InteractiveEditorRunOptions {
	initialRange?: IRange;
	message?: string;
	autoSend?: boolean;
	existingSession?: Session;
	isUnstashed?: boolean;
}

export class InteractiveEditorController implements IEditorContribution {

	static get(editor: ICodeEditor) {
		return editor.getContribution<InteractiveEditorController>(INTERACTIVE_EDITOR_ID);
	}

	private static _decoBlock = ModelDecorationOptions.register({
		description: 'interactive-editor',
		showIfCollapsed: false,
		isWholeLine: true,
		className: 'interactive-editor-block-selection',
	});

	private static _promptHistory: string[] = [];
	private _historyOffset: number = -1;

	private readonly _store = new DisposableStore();
	private readonly _zone: Lazy<InteractiveEditorZoneWidget>;
	private readonly _ctxHasActiveRequest: IContextKey<boolean>;
	private readonly _ctxLastResponseType: IContextKey<undefined | InteractiveEditorResponseType>;
	private readonly _ctxDidEdit: IContextKey<boolean>;
	private readonly _ctxLastFeedbackKind: IContextKey<'helpful' | 'unhelpful' | ''>;

	private _messages = this._store.add(new Emitter<Message>());

	private readonly _sessionStore: DisposableStore = new DisposableStore();
	private readonly _stashedSession: MutableDisposable<StashedSession> = this._store.add(new MutableDisposable());
	private _activeSession?: Session;
	private _strategy?: EditModeStrategy;
	private _ignoreModelContentChanged = false;

	constructor(
		private readonly _editor: ICodeEditor,
		@IInstantiationService private readonly _instaService: IInstantiationService,
		@IInteractiveEditorSessionService private readonly _interactiveEditorSessionService: IInteractiveEditorSessionService,
		@IEditorWorkerService private readonly _editorWorkerService: IEditorWorkerService,
		@ILogService private readonly _logService: ILogService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IModelService private readonly _modelService: IModelService,
		@INotebookEditorService private readonly _notebookEditorService: INotebookEditorService,
		@IDialogService private readonly _dialogService: IDialogService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IAccessibilityService private readonly _accessibilityService: IAccessibilityService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
	) {
		this._ctxHasActiveRequest = CTX_INTERACTIVE_EDITOR_HAS_ACTIVE_REQUEST.bindTo(contextKeyService);
		this._ctxDidEdit = CTX_INTERACTIVE_EDITOR_DID_EDIT.bindTo(contextKeyService);
		this._ctxLastResponseType = CTX_INTERACTIVE_EDITOR_LAST_RESPONSE_TYPE.bindTo(contextKeyService);
		this._ctxLastFeedbackKind = CTX_INTERACTIVE_EDITOR_LAST_FEEDBACK.bindTo(contextKeyService);
		this._zone = new Lazy(() => this._store.add(_instaService.createInstance(InteractiveEditorZoneWidget, this._editor)));

		this._store.add(this._editor.onDidChangeModel(async e => {
			if (this._activeSession || !e.newModelUrl) {
				return;
			}

			const existingSession = this._interactiveEditorSessionService.getSession(this._editor, e.newModelUrl);
			if (!existingSession) {
				return;
			}

			this._log('session RESUMING', e);
			await this._nextState(State.CREATE_SESSION, { existingSession });
			this._log('session done or paused');
		}));
		this._log('NEW controller');
	}

	dispose(): void {
		this._stashedSession.clear();
		this._finishExistingSession();
		this._store.dispose();
		this._log('controller disposed');
	}

	private _log(message: string | Error, ...more: any[]): void {
		if (message instanceof Error) {
			this._logService.error(message, ...more);
		} else {
			this._logService.trace(`[IE] (editor:${this._editor.getId()})${message}`, ...more);
		}
	}

	getId(): string {
		return INTERACTIVE_EDITOR_ID;
	}

	private _getMode(): EditMode {
		const editMode = this._configurationService.inspect<EditMode>('interactiveEditor.editMode');
		let editModeValue = editMode.value;
		if (this._accessibilityService.isScreenReaderOptimized() && editModeValue === editMode.defaultValue) {
			// By default, use preview mode for screen reader users
			editModeValue = EditMode.Preview;
		}
		return editModeValue!;
	}

	getWidgetPosition(): Position | undefined {
		return this._zone.value.position;
	}

	async run(options: InteractiveEditorRunOptions | undefined): Promise<void> {
		this._log('session starting');
		await this._finishExistingSession();
		this._stashedSession.clear();

		await this._nextState(State.CREATE_SESSION, options);
		this._log('session done or paused');
	}

	private async _finishExistingSession(): Promise<void> {
		if (this._activeSession) {
			if (this._activeSession.editMode === EditMode.Preview) {
				this._log('finishing existing session, using CANCEL', this._activeSession.editMode);
				await this.cancelSession();
			} else {
				this._log('finishing existing session, using APPLY', this._activeSession.editMode);
				await this.applyChanges();
			}
		}
	}

	// ---- state machine

	protected async _nextState(state: State, options: InteractiveEditorRunOptions | undefined): Promise<void> {
		this._log('setState to ', state);
		const nextState = await this[state](options);
		if (nextState) {
			await this._nextState(nextState, options);
		}
	}

	private async [State.CREATE_SESSION](options: InteractiveEditorRunOptions | undefined): Promise<State.CANCEL | State.INIT_UI> {
		assertType(this._activeSession === undefined);
		assertType(this._editor.hasModel());

		let session: Session | undefined = options?.existingSession;

		if (!session) {
			const createSessionCts = new CancellationTokenSource();
			const msgListener = Event.once(this._messages.event)(m => {
				this._log('state=_createSession) message received', m);
				createSessionCts.cancel();
			});

			session = await this._interactiveEditorSessionService.createSession(
				this._editor,
				{ editMode: this._getMode(), wholeRange: options?.initialRange },
				createSessionCts.token
			);

			createSessionCts.dispose();
			msgListener.dispose();
		}

		delete options?.initialRange;
		delete options?.existingSession;

		if (!session) {
			this._dialogService.info(localize('create.fail', "Failed to start editor chat"), localize('create.fail.detail', "Please consult the error log and try again later."));
			return State.CANCEL;
		}

		switch (session.editMode) {
			case EditMode.Live:
				this._strategy = this._instaService.createInstance(LiveStrategy, session, this._editor, this._zone.value.widget);
				break;
			case EditMode.Preview:
				this._strategy = this._instaService.createInstance(PreviewStrategy, session, this._zone.value.widget);
				break;
			case EditMode.LivePreview:
			default:
				this._strategy = this._instaService.createInstance(LivePreviewStrategy, session, this._editor, this._zone.value.widget);
				break;
		}

		this._activeSession = session;
		return State.INIT_UI;
	}

	private async [State.INIT_UI](options: InteractiveEditorRunOptions | undefined): Promise<State.WAIT_FOR_INPUT | State.SHOW_RESPONSE | State.APPLY_RESPONSE> {
		assertType(this._activeSession);

		// hide/cancel inline completions when invoking IE
		InlineCompletionsController.get(this._editor)?.hide();

		this._cancelNotebookSiblingEditors();

		this._sessionStore.clear();

		const wholeRangeDecoration = this._editor.createDecorationsCollection([{
			range: this._activeSession.wholeRange,
			options: InteractiveEditorController._decoBlock
		}]);
		this._sessionStore.add(toDisposable(() => wholeRangeDecoration.clear()));

		this._zone.value.widget.updateSlashCommands(this._activeSession.session.slashCommands ?? []);
		this._zone.value.widget.placeholder = this._getPlaceholderText();
		this._zone.value.widget.value = this._activeSession.lastInput ?? '';
		this._zone.value.widget.updateInfo(this._activeSession.session.message ?? localize('welcome.1', "AI-generated code may be incorrect"));
		this._zone.value.show(this._activeSession.wholeRange.getEndPosition());

		this._sessionStore.add(this._editor.onDidChangeModel((e) => {
			const msg = this._activeSession?.lastExchange
				? Message.PAUSE_SESSION // pause when switching models/tabs and when having a previous exchange
				: Message.CANCEL_SESSION;
			this._log('model changed, pause or cancel session', msg, e);
			this._messages.fire(msg);
		}));

		this._sessionStore.add(this._editor.onDidChangeModelContent(e => {
			if (this._ignoreModelContentChanged || this._strategy?.hasFocus()) {
				return;
			}

			const wholeRange = this._activeSession!.wholeRange;
			let editIsOutsideOfWholeRange = false;
			for (const { range } of e.changes) {
				editIsOutsideOfWholeRange = !Range.areIntersectingOrTouching(range, wholeRange);
			}

			this._activeSession!.recordExternalEditOccurred(editIsOutsideOfWholeRange);

			if (editIsOutsideOfWholeRange) {
				this._log('text changed outside of whole range, FINISH session');
				this._finishExistingSession();
			}
		}));

		if (!this._activeSession.lastExchange) {
			return State.WAIT_FOR_INPUT;
		} else if (options?.isUnstashed) {
			delete options.isUnstashed;
			return State.APPLY_RESPONSE;
		} else {
			return State.SHOW_RESPONSE;
		}
	}

	private _getPlaceholderText(): string {
		if (!this._activeSession) {
			return '';
		}
		let result = this._activeSession.session.placeholder ?? localize('default.placeholder', "Ask a question");
		if (InteractiveEditorController._promptHistory.length > 0) {
			const kb1 = this._keybindingService.lookupKeybinding('interactiveEditor.previousFromHistory')?.getLabel();
			const kb2 = this._keybindingService.lookupKeybinding('interactiveEditor.nextFromHistory')?.getLabel();

			if (kb1 && kb2) {
				result = localize('default.placeholder.history', "{0} ({1}, {2} for history)", result, kb1, kb2);
			}
		}
		return result;
	}

	private _cancelNotebookSiblingEditors(): void {
		if (!this._editor.hasModel()) {
			return;
		}
		const candidate = CellUri.parse(this._editor.getModel().uri);
		if (!candidate) {
			return;
		}
		for (const editor of this._notebookEditorService.listNotebookEditors()) {
			if (isEqual(editor.textModel?.uri, candidate.notebook)) {
				let found = false;
				const editors: ICodeEditor[] = [];
				for (const [, codeEditor] of editor.codeEditors) {
					editors.push(codeEditor);
					found = codeEditor === this._editor || found;
				}
				if (found) {
					// found the this editor in the outer notebook editor -> make sure to
					// cancel all sibling sessions
					for (const editor of editors) {
						if (editor !== this._editor) {
							InteractiveEditorController.get(editor)?._finishExistingSession();
						}
					}
					break;
				}
			}
		}
	}

	private async [State.WAIT_FOR_INPUT](options: InteractiveEditorRunOptions | undefined): Promise<State.ACCEPT | State.CANCEL | State.PAUSE | State.WAIT_FOR_INPUT | State.MAKE_REQUEST> {
		assertType(this._activeSession);

		this._zone.value.widget.placeholder = this._getPlaceholderText();
		this._zone.value.show(this._activeSession.wholeRange.getEndPosition());

		if (options?.message) {
			this._zone.value.widget.value = options?.message;
			this._zone.value.widget.selectAll();
			delete options?.message;
		}

		let message = Message.NONE;
		if (options?.autoSend) {
			message = Message.ACCEPT_INPUT;
			delete options?.autoSend;

		} else {
			const barrier = new Barrier();
			const msgListener = Event.once(this._messages.event)(m => {
				this._log('state=_waitForInput) message received', m);
				message = m;
				barrier.open();
			});
			await barrier.wait();
			msgListener.dispose();
		}

		this._zone.value.widget.selectAll();

		if (message & (Message.CANCEL_INPUT | Message.CANCEL_SESSION)) {
			return State.CANCEL;
		}

		if (message & Message.ACCEPT_SESSION) {
			return State.ACCEPT;
		}

		if (message & Message.PAUSE_SESSION) {
			return State.PAUSE;
		}

		if (!this._zone.value.widget.value) {
			return State.WAIT_FOR_INPUT;
		}

		const input = this._zone.value.widget.value;

		if (!InteractiveEditorController._promptHistory.includes(input)) {
			InteractiveEditorController._promptHistory.unshift(input);
		}

		const refer = this._activeSession.session.slashCommands?.some(value => value.refer && input!.startsWith(`/${value.command}`));
		if (refer) {
			this._log('[IE] seeing refer command, continuing outside editor', this._activeSession.provider.debugName);
			this._editor.setSelection(this._activeSession.wholeRange);
			this._instaService.invokeFunction(sendRequest, input);

			if (!this._activeSession.lastExchange) {
				// DONE when there wasn't any exchange yet. We used the inline chat only as trampoline
				return State.ACCEPT;
			}
			return State.WAIT_FOR_INPUT;
		}

		this._activeSession.addInput(input);
		return State.MAKE_REQUEST;
	}

	private async [State.MAKE_REQUEST](): Promise<State.APPLY_RESPONSE | State.PAUSE | State.CANCEL> {
		assertType(this._editor.hasModel());
		assertType(this._activeSession);
		assertType(this._activeSession.lastInput);

		const requestCts = new CancellationTokenSource();

		let message = Message.NONE;
		const msgListener = Event.once(this._messages.event)(m => {
			this._log('state=_makeRequest) message received', m);
			message = m;
			requestCts.cancel();
		});

		const typeListener = this._zone.value.widget.onDidChangeInput(() => {
			requestCts.cancel();
		});

		const sw = StopWatch.create();
		const request: IInteractiveEditorRequest = {
			prompt: this._activeSession.lastInput,
			selection: this._editor.getSelection(),
			wholeRange: this._activeSession.wholeRange,
			attempt: 0,
		};
		const task = this._activeSession.provider.provideResponse(this._activeSession.session, request, requestCts.token);
		this._log('request started', this._activeSession.provider.debugName, this._activeSession.session, request);

		let response: EditResponse | MarkdownResponse | ErrorResponse | EmptyResponse;
		let reply: IInteractiveEditorResponse | null | undefined;
		try {
			this._zone.value.widget.updateProgress(true);
			this._zone.value.widget.updateInfo(!this._activeSession.lastExchange ? localize('thinking', "Thinking\u2026") : '');
			this._ctxHasActiveRequest.set(true);
			reply = await raceCancellationError(Promise.resolve(task), requestCts.token);

			if (reply?.type === 'message') {
				response = new MarkdownResponse(this._activeSession.textModelN.uri, reply);
			} else if (reply) {
				response = new EditResponse(this._activeSession.textModelN.uri, reply);
			} else {
				response = new EmptyResponse();
			}

		} catch (e) {
			response = new ErrorResponse(e);

		} finally {
			this._ctxHasActiveRequest.set(false);
			this._zone.value.widget.updateProgress(false);
			this._zone.value.widget.updateInfo('');
			this._log('request took', sw.elapsed(), this._activeSession.provider.debugName);

		}

		requestCts.dispose();
		msgListener.dispose();
		typeListener.dispose();

		this._activeSession.addExchange(new SessionExchange(request.prompt, response));

		if (message & Message.CANCEL_SESSION) {
			return State.CANCEL;
		} else if (message & Message.PAUSE_SESSION) {
			return State.PAUSE;
		} else {
			return State.APPLY_RESPONSE;
		}
	}

	private async [State.APPLY_RESPONSE](): Promise<State.SHOW_RESPONSE | State.ACCEPT> {
		assertType(this._activeSession);
		assertType(this._strategy);

		const { response } = this._activeSession.lastExchange!;
		if (response instanceof EditResponse) {
			// edit response -> complex...
			this._zone.value.widget.updateMarkdownMessage(undefined);

			const canContinue = this._strategy.checkChanges(response);
			if (!canContinue) {
				return State.ACCEPT;
			}
			const moreMinimalEdits = (await this._editorWorkerService.computeHumanReadableDiff(this._activeSession.textModelN.uri, response.localEdits));
			const editOperations = (moreMinimalEdits ?? response.localEdits).map(edit => EditOperation.replace(Range.lift(edit.range), edit.text));
			this._log('edits from PROVIDER and after making them MORE MINIMAL', this._activeSession.provider.debugName, response.localEdits, moreMinimalEdits);

			const textModelNplus1 = this._modelService.createModel(createTextBufferFactoryFromSnapshot(this._activeSession.textModelN.createSnapshot()), null, undefined, true);
			textModelNplus1.applyEdits(editOperations);
			const diff = await this._editorWorkerService.computeDiff(this._activeSession.textModel0.uri, textModelNplus1.uri, { ignoreTrimWhitespace: false, maxComputationTimeMs: 5000 }, 'advanced');
			this._activeSession.lastTextModelChanges = diff?.changes ?? [];
			textModelNplus1.dispose();

			try {
				this._ignoreModelContentChanged = true;
				await this._strategy.makeChanges(response, editOperations);
				this._ctxDidEdit.set(this._activeSession.hasChangedText);
			} finally {
				this._ignoreModelContentChanged = false;
			}
		}

		return State.SHOW_RESPONSE;
	}

	private async [State.SHOW_RESPONSE](): Promise<State.WAIT_FOR_INPUT | State.ACCEPT> {
		assertType(this._activeSession);
		assertType(this._strategy);

		const { response } = this._activeSession.lastExchange!;

		this._ctxLastResponseType.set(response instanceof EditResponse || response instanceof MarkdownResponse
			? response.raw.type
			: undefined);

		if (response instanceof EmptyResponse) {
			// show status message
			this._zone.value.widget.updateStatus(localize('empty', "No results, please refine your input and try again"), { classes: ['warn'] });
			return State.WAIT_FOR_INPUT;

		} else if (response instanceof ErrorResponse) {
			// show error
			if (!response.isCancellation) {
				this._zone.value.widget.updateStatus(response.message, { classes: ['error'] });
			}

		} else if (response instanceof MarkdownResponse) {
			// clear status, show MD message
			const renderedMarkdown = renderMarkdown(response.raw.message, { inline: true });
			this._zone.value.widget.updateStatus('');
			this._zone.value.widget.updateMarkdownMessage(renderedMarkdown.element);
			this._zone.value.widget.updateToolbar(true);
			this._zone.value.widget.updateMarkdownMessageExpansionState(this._activeSession.lastExpansionState);

		} else if (response instanceof EditResponse) {
			// edit response -> complex...
			this._zone.value.widget.updateMarkdownMessage(undefined);
			this._zone.value.widget.updateToolbar(true);

			const canContinue = this._strategy.checkChanges(response);
			if (!canContinue) {
				return State.ACCEPT;
			}

			try {
				this._ignoreModelContentChanged = true;
				await this._strategy.renderChanges(response);
				this._ctxDidEdit.set(this._activeSession.hasChangedText);
			} finally {
				this._ignoreModelContentChanged = false;
			}
		}

		return State.WAIT_FOR_INPUT;
	}

	private async [State.PAUSE]() {
		assertType(this._activeSession);

		this._ctxDidEdit.reset();
		this._ctxLastResponseType.reset();
		this._ctxLastFeedbackKind.reset();

		this._zone.value.hide();

		// Return focus to the editor only if the current focus is within the editor widget
		if (this._editor.hasWidgetFocus()) {
			this._editor.focus();
		}

		this._sessionStore.clear();

		this._strategy?.dispose();
		this._strategy = undefined;
		this._activeSession = undefined;
	}

	private async [State.ACCEPT]() {
		assertType(this._activeSession);
		this._interactiveEditorSessionService.releaseSession(this._activeSession);
		this[State.PAUSE]();
	}

	private async [State.CANCEL]() {
		assertType(this._activeSession);
		const mySession = this._activeSession;

		this[State.PAUSE]();

		this._stashedSession.clear();
		if (!mySession.isUnstashed && mySession.lastExchange) {
			// only stash sessions that had edits
			this._stashedSession.value = this._instaService.createInstance(StashedSession, this._editor, mySession);
		} else {
			this._interactiveEditorSessionService.releaseSession(mySession);
		}
	}

	// ---- controller API

	accept(): void {
		this._messages.fire(Message.ACCEPT_INPUT);
	}

	cancelCurrentRequest(): void {
		this._messages.fire(Message.CANCEL_INPUT | Message.CANCEL_REQUEST);
	}

	arrowOut(up: boolean): void {
		if (this._zone.value.position && this._editor.hasModel()) {
			const { column } = this._editor.getPosition();
			const { lineNumber } = this._zone.value.position;
			const newLine = up ? lineNumber : lineNumber + 1;
			this._editor.setPosition({ lineNumber: newLine, column });
			this._editor.focus();
		}
	}

	toggleDiff(): void {
		this._strategy?.toggleDiff();
	}

	focus(): void {
		this._zone.value.widget.focus();
	}

	populateHistory(up: boolean) {
		const len = InteractiveEditorController._promptHistory.length;
		if (len === 0) {
			return;
		}
		const pos = (len + this._historyOffset + (up ? 1 : -1)) % len;
		const entry = InteractiveEditorController._promptHistory[pos];

		this._zone.value.widget.value = entry;
		this._zone.value.widget.selectAll();
		this._historyOffset = pos;
	}

	viewInChat() {
		if (this._activeSession?.lastExchange?.response instanceof MarkdownResponse) {
			this._instaService.invokeFunction(showMessageResponse, this._activeSession.lastExchange.prompt, this._activeSession.lastExchange.response.raw.message.value);
		}
	}

	updateExpansionState(expand: boolean) {
		if (this._activeSession) {
			this._zone.value.widget.updateMarkdownMessageExpansionState(expand);
			this._activeSession.lastExpansionState = expand;
		}
	}

	feedbackLast(helpful: boolean) {
		if (this._activeSession?.lastExchange?.response instanceof EditResponse || this._activeSession?.lastExchange?.response instanceof MarkdownResponse) {
			const kind = helpful ? InteractiveEditorResponseFeedbackKind.Helpful : InteractiveEditorResponseFeedbackKind.Unhelpful;
			this._activeSession.provider.handleInteractiveEditorResponseFeedback?.(this._activeSession.session, this._activeSession.lastExchange.response.raw, kind);
			this._ctxLastFeedbackKind.set(helpful ? 'helpful' : 'unhelpful');
			this._zone.value.widget.updateStatus('Thank you for your feedback!', { resetAfter: 1250 });
		}
	}

	createSnapshot(): void {
		if (this._activeSession && !this._activeSession.textModel0.equalsTextBuffer(this._activeSession.textModelN.getTextBuffer())) {
			this._activeSession.createSnapshot();
		}
	}

	async applyChanges(): Promise<void> {
		if (this._strategy) {
			const strategy = this._strategy;
			this._strategy = undefined;
			try {
				await strategy?.apply();
			} catch (err) {
				this._dialogService.error(localize('err.apply', "Failed to apply changes.", toErrorMessage(err)));
				this._log('FAILED to apply changes');
				this._log(err);
			}
			strategy?.dispose();
			this._messages.fire(Message.ACCEPT_SESSION);
		}
	}

	async cancelSession() {
		if (!this._strategy || !this._activeSession) {
			return undefined;
		}

		const changedText = this._activeSession.asChangedText();
		const strategy = this._strategy;
		this._strategy = undefined;
		try {
			await strategy?.cancel();
		} catch (err) {
			this._dialogService.error(localize('err.discard', "Failed to discard changes.", toErrorMessage(err)));
			this._log('FAILED to discard changes');
			this._log(err);
		}
		strategy?.dispose();
		this._messages.fire(Message.CANCEL_SESSION);
		return changedText;
	}

	unstashLastSession(): Session | undefined {
		return this._stashedSession.value?.unstash();
	}
}


class StashedSession {

	private readonly _listener: IDisposable;
	private readonly _ctxHasStashedSession: IContextKey<boolean>;
	private _session: Session | undefined;

	constructor(
		editor: ICodeEditor,
		session: Session,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInteractiveEditorSessionService private readonly _sessionService: IInteractiveEditorSessionService,
		@ILogService private readonly _logService: ILogService,
	) {
		this._ctxHasStashedSession = CTX_INTERACTIVE_EDITOR_HAS_STASHED_SESSION.bindTo(contextKeyService);

		// keep session for a little bit, only release when user continues to work (type, move cursor, etc.)
		this._session = session;
		this._ctxHasStashedSession.set(true);
		this._listener = Event.once(Event.any(editor.onDidChangeCursorSelection, editor.onDidChangeModelContent, editor.onDidChangeModel))(() => {
			this._session = undefined;
			this._sessionService.releaseSession(session);
			this._ctxHasStashedSession.reset();
		});
	}

	dispose() {
		this._listener.dispose();
		this._ctxHasStashedSession.reset();
		if (this._session) {
			this._sessionService.releaseSession(this._session);
		}
	}

	unstash(): Session | undefined {
		if (!this._session) {
			return undefined;
		}
		this._listener.dispose();
		const result = this._session;
		result.markUnstashed();
		this._session = undefined;
		this._logService.debug('[IE] Unstashed session');
		return result;
	}

}

async function showMessageResponse(accessor: ServicesAccessor, query: string, response: string) {
	const chatService = accessor.get(IChatService);
	const providerId = chatService.getProviderInfos()[0]?.id;

	const chatWidgetService = accessor.get(IChatWidgetService);
	const widget = await chatWidgetService.revealViewForProvider(providerId);
	if (widget && widget.viewModel) {
		chatService.addCompleteRequest(widget.viewModel.sessionId, query, { message: response });
		widget.focusLastMessage();
	}
}

async function sendRequest(accessor: ServicesAccessor, query: string) {
	const chatService = accessor.get(IChatService);
	const widgetService = accessor.get(IChatWidgetService);

	const providerId = chatService.getProviderInfos()[0]?.id;
	const widget = await widgetService.revealViewForProvider(providerId);
	if (!widget) {
		return;
	}

	widget.acceptInput(query);
}
