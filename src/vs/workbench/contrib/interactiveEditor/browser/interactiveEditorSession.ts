/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isEqual } from 'vs/base/common/resources';
import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';
import { ResourceEdit, ResourceFileEdit, ResourceTextEdit } from 'vs/editor/browser/services/bulkEditService';
import { TextEdit } from 'vs/editor/common/languages';
import { ITextModel } from 'vs/editor/common/model';
import { EditMode, IInteractiveEditorSessionProvider, IInteractiveEditorSession, IInteractiveEditorBulkEditResponse, IInteractiveEditorEditResponse, IInteractiveEditorMessageResponse, IInteractiveEditorResponse, IInteractiveEditorService } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IRange, Range } from 'vs/editor/common/core/range';
import { IActiveCodeEditor, ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IModelService } from 'vs/editor/common/services/model';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { createTextBufferFactoryFromSnapshot } from 'vs/editor/common/model/textModel';
import { ILogService } from 'vs/platform/log/common/log';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Iterable } from 'vs/base/common/iterator';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { isCancellationError } from 'vs/base/common/errors';
import { LineRangeMapping } from 'vs/editor/common/diff/linesDiffComputer';

export type Recording = {
	when: Date;
	session: IInteractiveEditorSession;
	exchanges: { prompt: string; res: IInteractiveEditorResponse }[];
};

type TelemetryData = {
	extension: string;
	rounds: string;
	undos: string;
	edits: boolean;
	finishedByEdit: boolean;
	startTime: string;
	endTime: string;
	editMode: string;
};

type TelemetryDataClassification = {
	owner: 'jrieken';
	comment: 'Data about an interaction editor session';
	extension: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'The extension providing the data' };
	rounds: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'Number of request that were made' };
	undos: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Requests that have been undone' };
	edits: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Did edits happen while the session was active' };
	finishedByEdit: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; isMeasurement: true; comment: 'Did edits cause the session to terminate' };
	startTime: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'When the session started' };
	endTime: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'When the session ended' };
	editMode: { classification: 'SystemMetaData'; purpose: 'FeatureInsight'; comment: 'What edit mode was choosen: live, livePreview, preview' };
};

export class Session {

	private _lastInput: string | undefined;
	private _lastExpansionState: boolean | undefined;
	private _lastTextModelChanges: LineRangeMapping[] | undefined;
	private _isUnstashed: boolean = false;
	private readonly _exchange: SessionExchange[] = [];
	private readonly _startTime = new Date();
	private readonly _teldata: Partial<TelemetryData>;

	readonly textModelNAltVersion: number;
	private _textModelNSnapshotAltVersion: number | undefined;

	constructor(
		readonly editMode: EditMode,
		readonly editor: ICodeEditor,
		readonly textModel0: ITextModel,
		readonly textModelN: ITextModel,
		readonly provider: IInteractiveEditorSessionProvider,
		readonly session: IInteractiveEditorSession,
		private readonly _wholeRangeMarkerId: string
	) {
		this.textModelNAltVersion = textModelN.getAlternativeVersionId();
		this._teldata = {
			extension: provider.debugName,
			startTime: this._startTime.toISOString(),
			edits: false,
			rounds: '',
			undos: '',
			editMode
		};
	}

	addInput(input: string): void {
		this._lastInput = input;
	}

	get isUnstashed(): boolean {
		return this._isUnstashed;
	}

	markUnstashed() {
		this._isUnstashed = true;
	}

	get lastInput() {
		return this._lastInput;
	}

	get lastExpansionState() {
		return this._lastExpansionState ?? false;
	}

	set lastExpansionState(state: boolean) {
		this._lastExpansionState = state;
	}

	get textModelNSnapshotAltVersion(): number | undefined {
		return this._textModelNSnapshotAltVersion;
	}

	get wholeRange(): Range {
		return this.textModelN.getDecorationRange(this._wholeRangeMarkerId)!;
		// return new Range(1, 1, 1, 1);
	}

	createSnapshot(): void {
		this._textModelNSnapshotAltVersion = this.textModelN.getAlternativeVersionId();
	}

	addExchange(exchange: SessionExchange): void {
		this._isUnstashed = false;
		const newLen = this._exchange.push(exchange);
		this._teldata.rounds += `${newLen}|`;
	}

	get lastExchange(): SessionExchange | undefined {
		return this._exchange[this._exchange.length - 1];
	}

	get lastTextModelChanges() {
		return this._lastTextModelChanges ?? [];
	}

	set lastTextModelChanges(changes: LineRangeMapping[]) {
		this._lastTextModelChanges = changes;
	}

	get hasChangedText(): boolean {
		return !this.textModel0.equalsTextBuffer(this.textModelN.getTextBuffer());
	}

	asChangedText(): string | undefined {
		if (!this._lastTextModelChanges || this._lastTextModelChanges.length === 0) {
			return undefined;
		}

		let startLine = Number.MAX_VALUE;
		let endLine = Number.MIN_VALUE;
		for (const change of this._lastTextModelChanges) {
			startLine = Math.min(startLine, change.modifiedRange.startLineNumber);
			endLine = Math.max(endLine, change.modifiedRange.endLineNumberExclusive);
		}

		return this.textModelN.getValueInRange(new Range(startLine, 1, endLine, Number.MAX_VALUE));
	}

	recordExternalEditOccurred(didFinish: boolean) {
		this._teldata.edits = true;
		this._teldata.finishedByEdit = didFinish;
	}

	asTelemetryData(): TelemetryData {
		return <TelemetryData>{
			...this._teldata,
			endTime: new Date().toISOString(),
		};
	}

	asRecording(): Recording {
		const result: Recording = {
			session: this.session,
			when: this._startTime,
			exchanges: []
		};
		for (const exchange of this._exchange) {
			const response = exchange.response;
			if (response instanceof MarkdownResponse || response instanceof EditResponse) {
				result.exchanges.push({ prompt: exchange.prompt, res: response.raw });
			}
		}
		return result;
	}
}


export class SessionExchange {
	constructor(
		readonly prompt: string,
		readonly response: MarkdownResponse | EditResponse | EmptyResponse | ErrorResponse
	) { }
}

export class EmptyResponse {

}

export class ErrorResponse {

	readonly message: string;
	readonly isCancellation: boolean;

	constructor(
		readonly error: any
	) {
		this.message = toErrorMessage(error, false);
		this.isCancellation = isCancellationError(error);
	}
}

export class MarkdownResponse {
	constructor(
		readonly localUri: URI,
		readonly raw: IInteractiveEditorMessageResponse
	) { }
}

export class EditResponse {

	readonly localEdits: TextEdit[] = [];
	readonly singleCreateFileEdit: { uri: URI; edits: Promise<TextEdit>[] } | undefined;
	readonly workspaceEdits: ResourceEdit[] | undefined;
	readonly workspaceEditsIncludeLocalEdits: boolean = false;

	constructor(localUri: URI, readonly raw: IInteractiveEditorBulkEditResponse | IInteractiveEditorEditResponse) {
		if (raw.type === 'editorEdit') {
			//
			this.localEdits = raw.edits;
			this.singleCreateFileEdit = undefined;
			this.workspaceEdits = undefined;

		} else {
			//
			const edits = ResourceEdit.convert(raw.edits);
			this.workspaceEdits = edits;

			let isComplexEdit = false;

			for (const edit of edits) {
				if (edit instanceof ResourceFileEdit) {
					if (!isComplexEdit && edit.newResource && !edit.oldResource) {
						// file create
						if (this.singleCreateFileEdit) {
							isComplexEdit = true;
							this.singleCreateFileEdit = undefined;
						} else {
							this.singleCreateFileEdit = { uri: edit.newResource, edits: [] };
							if (edit.options.contents) {
								this.singleCreateFileEdit.edits.push(edit.options.contents.then(x => ({ range: new Range(1, 1, 1, 1), text: x.toString() })));
							}
						}
					}
				} else if (edit instanceof ResourceTextEdit) {
					//
					if (isEqual(edit.resource, localUri)) {
						this.localEdits.push(edit.textEdit);
						this.workspaceEditsIncludeLocalEdits = true;

					} else if (isEqual(this.singleCreateFileEdit?.uri, edit.resource)) {
						this.singleCreateFileEdit!.edits.push(Promise.resolve(edit.textEdit));
					} else {
						isComplexEdit = true;
					}
				}
			}

			if (isComplexEdit) {
				this.singleCreateFileEdit = undefined;
			}
		}
	}
}

export interface ISessionKeyComputer {
	getComparisonKey(editor: ICodeEditor, uri: URI): string;
}

export const IInteractiveEditorSessionService = createDecorator<IInteractiveEditorSessionService>('IInteractiveEditorSessionService');

export interface IInteractiveEditorSessionService {
	_serviceBrand: undefined;

	createSession(editor: IActiveCodeEditor, options: { editMode: EditMode; wholeRange?: IRange }, token: CancellationToken): Promise<Session | undefined>;

	getSession(editor: ICodeEditor, uri: URI): Session | undefined;

	releaseSession(session: Session): void;

	registerSessionKeyComputer(scheme: string, value: ISessionKeyComputer): IDisposable;

	//

	recordings(): readonly Recording[];
}

type SessionData = {
	session: Session;
	store: IDisposable;
};

export class InteractiveEditorSessionService implements IInteractiveEditorSessionService {

	declare _serviceBrand: undefined;

	private readonly _sessions = new Map<string, SessionData>();
	private readonly _keyComputers = new Map<string, ISessionKeyComputer>();
	private _recordings: Recording[] = [];

	constructor(
		@IInteractiveEditorService private readonly _interactiveEditorService: IInteractiveEditorService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@IModelService private readonly _modelService: IModelService,
		@ITextModelService private readonly _textModelService: ITextModelService,
		@ILogService private readonly _logService: ILogService,
	) { }


	async createSession(editor: IActiveCodeEditor, options: { editMode: EditMode; wholeRange?: Range }, token: CancellationToken): Promise<Session | undefined> {

		const provider = Iterable.first(this._interactiveEditorService.getAllProvider());
		if (!provider) {
			this._logService.trace('[IE] NO provider found');
			return undefined;
		}

		const textModel = editor.getModel();
		const selection = editor.getSelection();
		let raw: IInteractiveEditorSession | undefined | null;
		try {
			raw = await provider.prepareInteractiveEditorSession(textModel, selection, token);
		} catch (error) {
			this._logService.error('[IE] FAILED to prepare session', provider.debugName);
			this._logService.error(error);
			return undefined;
		}
		if (!raw) {
			this._logService.trace('[IE] NO session', provider.debugName);
			return undefined;
		}
		this._logService.trace('[IE] NEW session', provider.debugName);

		this._logService.trace(`[IE] creating NEW session for ${editor.getId()},  ${provider.debugName}`);
		const store = new DisposableStore();

		// create: keep a reference to prevent disposal of the "actual" model
		const refTextModelN = await this._textModelService.createModelReference(textModel.uri);
		store.add(refTextModelN);

		// create: keep a snapshot of the "actual" model
		const textModel0 = this._modelService.createModel(
			createTextBufferFactoryFromSnapshot(textModel.createSnapshot()),
			{ languageId: textModel.getLanguageId(), onDidChange: Event.None },
			undefined, true
		);
		store.add(textModel0);

		let wholeRange = options.wholeRange;
		if (!wholeRange) {
			wholeRange = raw.wholeRange ? Range.lift(raw.wholeRange) : editor.getSelection();
		}
		if (Range.isEmpty(wholeRange)) {
			wholeRange = new Range(wholeRange.startLineNumber, 1, wholeRange.endLineNumber, textModel.getLineMaxColumn(wholeRange.endLineNumber));
		}

		// install a marker for the decoration range
		const [wholeRangeDecorationId] = textModel.deltaDecorations([], [{ range: wholeRange, options: { description: 'interactiveEditor/session/wholeRange' } }]);
		store.add(toDisposable(() => {
			if (!textModel.isDisposed()) {
				textModel.deltaDecorations([wholeRangeDecorationId], []);
			}
		}));

		const session = new Session(options.editMode, editor, textModel0, textModel, provider, raw, wholeRangeDecorationId);

		// store: key -> session
		const key = this._key(editor, textModel.uri);
		if (this._sessions.has(key)) {
			store.dispose();
			throw new Error(`Session already stored for ${key}`);
		}
		this._sessions.set(key, { session, store });
		return session;
	}

	releaseSession(session: Session): void {

		const { editor } = session;

		// cleanup
		for (const [key, value] of this._sessions) {
			if (value.session === session) {
				value.store.dispose();
				this._sessions.delete(key);
				this._logService.trace(`[IE] did RELEASED session for ${editor.getId()}, ${session.provider.debugName}`);
				break;
			}
		}

		// keep recording
		const newLen = this._recordings.unshift(session.asRecording());
		if (newLen > 5) {
			this._recordings.pop();
		}

		// send telemetry
		this._telemetryService.publicLog2<TelemetryData, TelemetryDataClassification>('interactiveEditor/session', session.asTelemetryData());
	}

	getSession(editor: ICodeEditor, uri: URI): Session | undefined {
		const key = this._key(editor, uri);
		return this._sessions.get(key)?.session;
	}

	private _key(editor: ICodeEditor, uri: URI): string {
		const item = this._keyComputers.get(uri.scheme);
		return item
			? item.getComparisonKey(editor, uri)
			: `${editor.getId()}@${uri.toString()}`;

	}

	registerSessionKeyComputer(scheme: string, value: ISessionKeyComputer): IDisposable {
		this._keyComputers.set(scheme, value);
		return toDisposable(() => this._keyComputers.delete(scheme));
	}

	// --- debug

	recordings(): readonly Recording[] {
		return this._recordings;
	}

}
