/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { decodeBase64, encodeBase64, VSBuffer } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IDiffResult } from 'vs/base/common/diff/diff';
import { Event } from 'vs/base/common/event';
import * as glob from 'vs/base/common/glob';
import { Iterable } from 'vs/base/common/iterator';
import { Mimes } from 'vs/base/common/mime';
import { Schemas } from 'vs/base/common/network';
import { basename } from 'vs/base/common/path';
import { isWindows } from 'vs/base/common/platform';
import { ISplice } from 'vs/base/common/sequence';
import { URI, UriComponents } from 'vs/base/common/uri';
import { ILineChange } from 'vs/editor/common/diff/diffComputer';
import * as editorCommon from 'vs/editor/common/editorCommon';
import { Command } from 'vs/editor/common/languages';
import { IReadonlyTextBuffer } from 'vs/editor/common/model';
import { IAccessibilityInformation } from 'vs/platform/accessibility/common/accessibility';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { ThemeColor } from 'vs/platform/theme/common/themeService';
import { UndoRedoGroup } from 'vs/platform/undoRedo/common/undoRedo';
import { IRevertOptions, ISaveOptions, IUntypedEditorInput } from 'vs/workbench/common/editor';
import { NotebookTextModel } from 'vs/workbench/contrib/notebook/common/model/notebookTextModel';
import { ICellRange } from 'vs/workbench/contrib/notebook/common/notebookRange';
import { IWorkingCopyBackupMeta, IWorkingCopySaveEvent } from 'vs/workbench/services/workingCopy/common/workingCopy';

export const NOTEBOOK_EDITOR_ID = 'workbench.editor.notebook';
export const NOTEBOOK_DIFF_EDITOR_ID = 'workbench.editor.notebookTextDiffEditor';


export enum CellKind {
	Markup = 1,
	Code = 2
}

export const NOTEBOOK_DISPLAY_ORDER: readonly string[] = [
	'application/json',
	'application/javascript',
	'text/html',
	'image/svg+xml',
	Mimes.latex,
	Mimes.markdown,
	'image/png',
	'image/jpeg',
	Mimes.text
];

export const ACCESSIBLE_NOTEBOOK_DISPLAY_ORDER: readonly string[] = [
	Mimes.latex,
	Mimes.markdown,
	'application/json',
	Mimes.text,
	'text/html',
	'image/svg+xml',
	'image/png',
	'image/jpeg',
];

/**
 * A mapping of extension IDs who contain renderers, to notebook ids who they
 * should be treated as the same in the renderer selection logic. This is used
 * to prefer the 1st party Jupyter renderers even though they're in a separate
 * extension, for instance. See #136247.
 */
export const RENDERER_EQUIVALENT_EXTENSIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
	['ms-toolsai.jupyter', new Set(['jupyter-notebook', 'interactive'])],
	['ms-toolsai.jupyter-renderers', new Set(['jupyter-notebook', 'interactive'])],
]);

export const RENDERER_NOT_AVAILABLE = '_notAvailable';

export type NotebookRendererEntrypoint = string | { extends: string; path: string };

export enum NotebookRunState {
	Running = 1,
	Idle = 2
}

export type NotebookDocumentMetadata = Record<string, unknown>;

export enum NotebookCellExecutionState {
	Unconfirmed = 1,
	Pending = 2,
	Executing = 3
}

export interface INotebookCellPreviousExecutionResult {
	executionOrder?: number;
	success?: boolean;
	duration?: number;
}

export interface NotebookCellMetadata {
	/**
	 * custom metadata
	 */
	[key: string]: unknown;
}

export interface NotebookCellInternalMetadata {
	executionOrder?: number;
	lastRunSuccess?: boolean;
	runStartTime?: number;
	runStartTimeAdjustment?: number;
	runEndTime?: number;
}

export interface NotebookCellCollapseState {
	inputCollapsed?: boolean;
	outputCollapsed?: boolean;
}

export interface NotebookCellDefaultCollapseConfig {
	codeCell?: NotebookCellCollapseState;
	markupCell?: NotebookCellCollapseState;
}

export type InteractiveWindowCollapseCodeCells = 'always' | 'never' | 'fromEditor';

export type TransientCellMetadata = { [K in keyof NotebookCellMetadata]?: boolean };
export type TransientDocumentMetadata = { [K in keyof NotebookDocumentMetadata]?: boolean };

export interface TransientOptions {
	transientOutputs: boolean;
	transientCellMetadata: TransientCellMetadata;
	transientDocumentMetadata: TransientDocumentMetadata;
}

/** Note: enum values are used for sorting */
export const enum NotebookRendererMatch {
	/** Renderer has a hard dependency on an available kernel */
	WithHardKernelDependency = 0,
	/** Renderer works better with an available kernel */
	WithOptionalKernelDependency = 1,
	/** Renderer is kernel-agnostic */
	Pure = 2,
	/** Renderer is for a different mimeType or has a hard dependency which is unsatisfied */
	Never = 3,
}

/**
 * Renderer messaging requirement. While this allows for 'optional' messaging,
 * VS Code effectively treats it the same as true right now. "Partial
 * activation" of extensions is a very tricky problem, which could allow
 * solving this. But for now, optional is mostly only honored for aznb.
 */
export const enum RendererMessagingSpec {
	Always = 'always',
	Never = 'never',
	Optional = 'optional',
}

export interface INotebookRendererInfo {
	id: string;
	displayName: string;
	extends?: string;
	entrypoint: URI;
	preloads: ReadonlyArray<URI>;
	extensionLocation: URI;
	extensionId: ExtensionIdentifier;
	messaging: RendererMessagingSpec;

	readonly mimeTypes: readonly string[];

	readonly dependencies: readonly string[];

	readonly isBuiltin: boolean;

	matchesWithoutKernel(mimeType: string): NotebookRendererMatch;
	matches(mimeType: string, kernelProvides: ReadonlyArray<string>): NotebookRendererMatch;
}


export interface IOrderedMimeType {
	mimeType: string;
	rendererId: string;
	isTrusted: boolean;
}

export interface IOutputItemDto {
	readonly mime: string;
	readonly data: VSBuffer;
}

export interface IOutputDto {
	outputs: IOutputItemDto[];
	outputId: string;
	metadata?: Record<string, any>;
}

export interface ICellOutput {
	outputs: IOutputItemDto[];
	metadata?: Record<string, any>;
	outputId: string;
	onDidChangeData: Event<void>;
	replaceData(items: IOutputItemDto[]): void;
	appendData(items: IOutputItemDto[]): void;
}

export interface CellInternalMetadataChangedEvent {
	readonly lastRunSuccessChanged?: boolean;
}

export interface ICell {
	readonly uri: URI;
	handle: number;
	language: string;
	cellKind: CellKind;
	outputs: ICellOutput[];
	metadata: NotebookCellMetadata;
	internalMetadata: NotebookCellInternalMetadata;
	getHashValue(): number;
	textBuffer: IReadonlyTextBuffer;
	onDidChangeOutputs?: Event<NotebookCellOutputsSplice>;
	onDidChangeOutputItems?: Event<void>;
	onDidChangeLanguage: Event<string>;
	onDidChangeMetadata: Event<void>;
	onDidChangeInternalMetadata: Event<CellInternalMetadataChangedEvent>;
}

export interface INotebookTextModel {
	readonly viewType: string;
	metadata: NotebookDocumentMetadata;
	readonly transientOptions: TransientOptions;
	readonly uri: URI;
	readonly versionId: number;
	readonly length: number;
	readonly cells: readonly ICell[];
	reset(cells: ICellDto2[], metadata: NotebookDocumentMetadata, transientOptions: TransientOptions): void;
	applyEdits(rawEdits: ICellEditOperation[], synchronous: boolean, beginSelectionState: ISelectionState | undefined, endSelectionsComputer: () => ISelectionState | undefined, undoRedoGroup: UndoRedoGroup | undefined, computeUndoRedo?: boolean): boolean;
	onDidChangeContent: Event<NotebookTextModelChangedEvent>;
	onWillDispose: Event<void>;
}

export type NotebookCellTextModelSplice<T> = [
	start: number,
	deleteCount: number,
	newItems: T[]
];

export type NotebookCellOutputsSplice = {
	start: number /* start */;
	deleteCount: number /* delete count */;
	newOutputs: ICellOutput[];
};

export interface IMainCellDto {
	handle: number;
	uri: UriComponents;
	source: string[];
	eol: string;
	language: string;
	cellKind: CellKind;
	outputs: IOutputDto[];
	metadata?: NotebookCellMetadata;
	internalMetadata?: NotebookCellInternalMetadata;
}

export enum NotebookCellsChangeType {
	ModelChange = 1,
	Move = 2,
	ChangeCellLanguage = 5,
	Initialize = 6,
	ChangeCellMetadata = 7,
	Output = 8,
	OutputItem = 9,
	ChangeCellContent = 10,
	ChangeDocumentMetadata = 11,
	ChangeCellInternalMetadata = 12,
	ChangeCellMime = 13,
	Unknown = 100
}

export interface NotebookCellsInitializeEvent<T> {
	readonly kind: NotebookCellsChangeType.Initialize;
	readonly changes: NotebookCellTextModelSplice<T>[];
}

export interface NotebookCellContentChangeEvent {
	readonly kind: NotebookCellsChangeType.ChangeCellContent;
	readonly index: number;
}

export interface NotebookCellsModelChangedEvent<T> {
	readonly kind: NotebookCellsChangeType.ModelChange;
	readonly changes: NotebookCellTextModelSplice<T>[];
}

export interface NotebookCellsModelMoveEvent<T> {
	readonly kind: NotebookCellsChangeType.Move;
	readonly index: number;
	readonly length: number;
	readonly newIdx: number;
	readonly cells: T[];
}

export interface NotebookOutputChangedEvent {
	readonly kind: NotebookCellsChangeType.Output;
	readonly index: number;
	readonly outputs: IOutputDto[];
	readonly append: boolean;
}

export interface NotebookOutputItemChangedEvent {
	readonly kind: NotebookCellsChangeType.OutputItem;
	readonly index: number;
	readonly outputId: string;
	readonly outputItems: IOutputItemDto[];
	readonly append: boolean;
}

export interface NotebookCellsChangeLanguageEvent {
	readonly kind: NotebookCellsChangeType.ChangeCellLanguage;
	readonly index: number;
	readonly language: string;
}

export interface NotebookCellsChangeMimeEvent {
	readonly kind: NotebookCellsChangeType.ChangeCellMime;
	readonly index: number;
	readonly mime: string | undefined;
}

export interface NotebookCellsChangeMetadataEvent {
	readonly kind: NotebookCellsChangeType.ChangeCellMetadata;
	readonly index: number;
	readonly metadata: NotebookCellMetadata;
}

export interface NotebookCellsChangeInternalMetadataEvent {
	readonly kind: NotebookCellsChangeType.ChangeCellInternalMetadata;
	readonly index: number;
	readonly internalMetadata: NotebookCellInternalMetadata;
}

export interface NotebookDocumentChangeMetadataEvent {
	readonly kind: NotebookCellsChangeType.ChangeDocumentMetadata;
	readonly metadata: NotebookDocumentMetadata;
}

export interface NotebookDocumentUnknownChangeEvent {
	readonly kind: NotebookCellsChangeType.Unknown;
}

export type NotebookRawContentEventDto = NotebookCellsInitializeEvent<IMainCellDto> | NotebookDocumentChangeMetadataEvent | NotebookCellContentChangeEvent | NotebookCellsModelChangedEvent<IMainCellDto> | NotebookCellsModelMoveEvent<IMainCellDto> | NotebookOutputChangedEvent | NotebookOutputItemChangedEvent | NotebookCellsChangeLanguageEvent | NotebookCellsChangeMimeEvent | NotebookCellsChangeMetadataEvent | NotebookCellsChangeInternalMetadataEvent | NotebookDocumentUnknownChangeEvent;

export type NotebookCellsChangedEventDto = {
	readonly rawEvents: NotebookRawContentEventDto[];
	readonly versionId: number;
};

export type NotebookRawContentEvent = (NotebookCellsInitializeEvent<ICell> | NotebookDocumentChangeMetadataEvent | NotebookCellContentChangeEvent | NotebookCellsModelChangedEvent<ICell> | NotebookCellsModelMoveEvent<ICell> | NotebookOutputChangedEvent | NotebookOutputItemChangedEvent | NotebookCellsChangeLanguageEvent | NotebookCellsChangeMimeEvent | NotebookCellsChangeMetadataEvent | NotebookCellsChangeInternalMetadataEvent | NotebookDocumentUnknownChangeEvent) & { transient: boolean };

export enum SelectionStateType {
	Handle = 0,
	Index = 1
}

export interface ISelectionHandleState {
	kind: SelectionStateType.Handle;
	primary: number | null;
	selections: number[];
}

export interface ISelectionIndexState {
	kind: SelectionStateType.Index;
	focus: ICellRange;
	selections: ICellRange[];
}

export type ISelectionState = ISelectionHandleState | ISelectionIndexState;

export type NotebookTextModelChangedEvent = {
	readonly rawEvents: NotebookRawContentEvent[];
	readonly versionId: number;
	readonly synchronous: boolean | undefined;
	readonly endSelectionState: ISelectionState | undefined;
};

export type NotebookTextModelWillAddRemoveEvent = {
	readonly rawEvent: NotebookCellsModelChangedEvent<ICell>;
};

export const enum CellEditType {
	Replace = 1,
	Output = 2,
	Metadata = 3,
	CellLanguage = 4,
	DocumentMetadata = 5,
	Move = 6,
	OutputItems = 7,
	PartialMetadata = 8,
	PartialInternalMetadata = 9,
}

export interface ICellDto2 {
	source: string;
	language: string;
	mime: string | undefined;
	cellKind: CellKind;
	outputs: IOutputDto[];
	metadata?: NotebookCellMetadata;
	internalMetadata?: NotebookCellInternalMetadata;
	collapseState?: NotebookCellCollapseState;
}

export interface ICellReplaceEdit {
	editType: CellEditType.Replace;
	index: number;
	count: number;
	cells: ICellDto2[];
}

export interface ICellOutputEdit {
	editType: CellEditType.Output;
	index: number;
	outputs: IOutputDto[];
	append?: boolean;
}

export interface ICellOutputEditByHandle {
	editType: CellEditType.Output;
	handle: number;
	outputs: IOutputDto[];
	append?: boolean;
}

export interface ICellOutputItemEdit {
	editType: CellEditType.OutputItems;
	outputId: string;
	items: IOutputItemDto[];
	append?: boolean;
}

export interface ICellMetadataEdit {
	editType: CellEditType.Metadata;
	index: number;
	metadata: NotebookCellMetadata;
}

// These types are nullable because we need to use 'null' on the EH side so it is JSON-stringified
export type NullablePartialNotebookCellMetadata = {
	[Key in keyof Partial<NotebookCellMetadata>]: NotebookCellMetadata[Key] | null
};

export interface ICellPartialMetadataEdit {
	editType: CellEditType.PartialMetadata;
	index: number;
	metadata: NullablePartialNotebookCellMetadata;
}

export interface ICellPartialMetadataEditByHandle {
	editType: CellEditType.PartialMetadata;
	handle: number;
	metadata: NullablePartialNotebookCellMetadata;
}

export type NullablePartialNotebookCellInternalMetadata = {
	[Key in keyof Partial<NotebookCellInternalMetadata>]: NotebookCellInternalMetadata[Key] | null
};
export interface ICellPartialInternalMetadataEdit {
	editType: CellEditType.PartialInternalMetadata;
	index: number;
	internalMetadata: NullablePartialNotebookCellInternalMetadata;
}

export interface ICellPartialInternalMetadataEditByHandle {
	editType: CellEditType.PartialInternalMetadata;
	handle: number;
	internalMetadata: NullablePartialNotebookCellInternalMetadata;
}

export interface ICellLanguageEdit {
	editType: CellEditType.CellLanguage;
	index: number;
	language: string;
}

export interface IDocumentMetadataEdit {
	editType: CellEditType.DocumentMetadata;
	metadata: NotebookDocumentMetadata;
}

export interface ICellMoveEdit {
	editType: CellEditType.Move;
	index: number;
	length: number;
	newIdx: number;
}

export type IImmediateCellEditOperation = ICellOutputEditByHandle | ICellPartialMetadataEditByHandle | ICellOutputItemEdit | ICellPartialInternalMetadataEdit | ICellPartialInternalMetadataEditByHandle | ICellPartialMetadataEdit;
export type ICellEditOperation = IImmediateCellEditOperation | ICellReplaceEdit | ICellOutputEdit | ICellMetadataEdit | ICellPartialMetadataEdit | ICellPartialInternalMetadataEdit | IDocumentMetadataEdit | ICellMoveEdit | ICellOutputItemEdit | ICellLanguageEdit;

export interface NotebookData {
	readonly cells: ICellDto2[];
	readonly metadata: NotebookDocumentMetadata;
}


export interface INotebookContributionData {
	extension?: ExtensionIdentifier;
	providerDisplayName: string;
	displayName: string;
	filenamePattern: (string | glob.IRelativePattern | INotebookExclusiveDocumentFilter)[];
	exclusive: boolean;
}


export namespace CellUri {

	export const scheme = Schemas.vscodeNotebookCell;


	const _lengths = ['W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f'];
	const _padRegexp = new RegExp(`^[${_lengths.join('')}]+`);
	const _radix = 7;

	export function generate(notebook: URI, handle: number): URI {

		const s = handle.toString(_radix);
		const p = s.length < _lengths.length ? _lengths[s.length - 1] : 'z';

		const fragment = `${p}${s}s${encodeBase64(VSBuffer.fromString(notebook.scheme), true, true)}`;
		return notebook.with({ scheme, fragment });
	}

	export function parse(cell: URI): { notebook: URI; handle: number } | undefined {
		if (cell.scheme !== scheme) {
			return undefined;
		}

		const idx = cell.fragment.indexOf('s');
		if (idx < 0) {
			return undefined;
		}

		const handle = parseInt(cell.fragment.substring(0, idx).replace(_padRegexp, ''), _radix);
		const _scheme = decodeBase64(cell.fragment.substring(idx + 1)).toString();

		if (isNaN(handle)) {
			return undefined;
		}
		return {
			handle,
			notebook: cell.with({ scheme: _scheme, fragment: null })
		};
	}


	const _regex = /^(\d{8,})(\w[\w\d+.-]*)$/;

	export function generateCellOutputUri(notebook: URI, outputId?: string) {
		return notebook.with({
			scheme: Schemas.vscodeNotebookCellOutput,
			fragment: `op${outputId ?? ''},${notebook.scheme !== Schemas.file ? notebook.scheme : ''}`
		});
	}

	export function parseCellOutputUri(uri: URI): { notebook: URI; outputId?: string } | undefined {
		if (uri.scheme !== Schemas.vscodeNotebookCellOutput) {
			return undefined;
		}

		const match = /^op([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\,(.*)$/i.exec(uri.fragment);
		if (!match) {
			return undefined;
		}

		const outputId = (match[1] && match[1] !== '') ? match[1] : undefined;
		const scheme = match[2];
		return {
			outputId,
			notebook: uri.with({
				scheme: scheme || Schemas.file,
				fragment: null
			})
		};
	}

	export function generateCellUri(notebook: URI, handle: number, scheme: string): URI {
		return notebook.with({
			scheme: scheme,
			fragment: `ch${handle.toString().padStart(7, '0')}${notebook.scheme !== Schemas.file ? notebook.scheme : ''}`
		});
	}

	export function parseCellUri(metadata: URI, scheme: string) {
		if (metadata.scheme !== scheme) {
			return undefined;
		}
		const match = _regex.exec(metadata.fragment);
		if (!match) {
			return undefined;
		}
		const handle = Number(match[1]);
		return {
			handle,
			notebook: metadata.with({
				scheme: metadata.fragment.substring(match[0].length) || Schemas.file,
				fragment: null
			})
		};
	}
}

const normalizeSlashes = (str: string) => isWindows ? str.replace(/\//g, '\\') : str;

interface IMimeTypeWithMatcher {
	pattern: string;
	matches: glob.ParsedPattern;
}

export class MimeTypeDisplayOrder {
	private readonly order: IMimeTypeWithMatcher[];

	constructor(
		initialValue: readonly string[] = [],
		private readonly defaultOrder = NOTEBOOK_DISPLAY_ORDER,
	) {
		this.order = [...new Set(initialValue)].map(pattern => ({
			pattern,
			matches: glob.parse(normalizeSlashes(pattern))
		}));
	}

	/**
	 * Returns a sorted array of the input mimetypes.
	 */
	public sort(mimetypes: Iterable<string>): string[] {
		const remaining = new Map(Iterable.map(mimetypes, m => [m, normalizeSlashes(m)]));
		let sorted: string[] = [];

		for (const { matches } of this.order) {
			for (const [original, normalized] of remaining) {
				if (matches(normalized)) {
					sorted.push(original);
					remaining.delete(original);
					break;
				}
			}
		}

		if (remaining.size) {
			sorted = sorted.concat([...remaining.keys()].sort(
				(a, b) => this.defaultOrder.indexOf(a) - this.defaultOrder.indexOf(b),
			));
		}

		return sorted;
	}

	/**
	 * Records that the user selected the given mimetype over the other
	 * possible mimetypes, prioritizing it for future reference.
	 */
	public prioritize(chosenMimetype: string, otherMimetypes: readonly string[]) {
		const chosenIndex = this.findIndex(chosenMimetype);
		if (chosenIndex === -1) {
			// always first, nothing more to do
			this.order.unshift({ pattern: chosenMimetype, matches: glob.parse(normalizeSlashes(chosenMimetype)) });
			return;
		}

		// Get the other mimetypes that are before the chosenMimetype. Then, move
		// them after it, retaining order.
		const uniqueIndicies = new Set(otherMimetypes.map(m => this.findIndex(m, chosenIndex)));
		uniqueIndicies.delete(-1);
		const otherIndices = Array.from(uniqueIndicies).sort();
		this.order.splice(chosenIndex + 1, 0, ...otherIndices.map(i => this.order[i]));

		for (let oi = otherIndices.length - 1; oi >= 0; oi--) {
			this.order.splice(otherIndices[oi], 1);
		}
	}

	/**
	 * Gets an array of in-order mimetype preferences.
	 */
	public toArray() {
		return this.order.map(o => o.pattern);
	}

	private findIndex(mimeType: string, maxIndex = this.order.length) {
		const normalized = normalizeSlashes(mimeType);
		for (let i = 0; i < maxIndex; i++) {
			if (this.order[i].matches(normalized)) {
				return i;
			}
		}

		return -1;
	}
}

interface IMutableSplice<T> extends ISplice<T> {
	deleteCount: number;
}

export function diff<T>(before: T[], after: T[], contains: (a: T) => boolean, equal: (a: T, b: T) => boolean = (a: T, b: T) => a === b): ISplice<T>[] {
	const result: IMutableSplice<T>[] = [];

	function pushSplice(start: number, deleteCount: number, toInsert: T[]): void {
		if (deleteCount === 0 && toInsert.length === 0) {
			return;
		}

		const latest = result[result.length - 1];

		if (latest && latest.start + latest.deleteCount === start) {
			latest.deleteCount += deleteCount;
			latest.toInsert.push(...toInsert);
		} else {
			result.push({ start, deleteCount, toInsert });
		}
	}

	let beforeIdx = 0;
	let afterIdx = 0;

	while (true) {
		if (beforeIdx === before.length) {
			pushSplice(beforeIdx, 0, after.slice(afterIdx));
			break;
		}

		if (afterIdx === after.length) {
			pushSplice(beforeIdx, before.length - beforeIdx, []);
			break;
		}

		const beforeElement = before[beforeIdx];
		const afterElement = after[afterIdx];

		if (equal(beforeElement, afterElement)) {
			// equal
			beforeIdx += 1;
			afterIdx += 1;
			continue;
		}

		if (contains(afterElement)) {
			// `afterElement` exists before, which means some elements before `afterElement` are deleted
			pushSplice(beforeIdx, 1, []);
			beforeIdx += 1;
		} else {
			// `afterElement` added
			pushSplice(beforeIdx, 0, [afterElement]);
			afterIdx += 1;
		}
	}

	return result;
}

export interface ICellEditorViewState {
	selections: editorCommon.ICursorState[];
}

export const NOTEBOOK_EDITOR_CURSOR_BOUNDARY = new RawContextKey<'none' | 'top' | 'bottom' | 'both'>('notebookEditorCursorAtBoundary', 'none');


export interface INotebookLoadOptions {
	/**
	 * Go to disk bypassing any cache of the model if any.
	 */
	forceReadFromFile?: boolean;
}

export interface IResolvedNotebookEditorModel extends INotebookEditorModel {
	notebook: NotebookTextModel;
}

export interface INotebookEditorModel extends IEditorModel {
	readonly onDidChangeDirty: Event<void>;
	readonly onDidSave: Event<IWorkingCopySaveEvent>;
	readonly onDidChangeOrphaned: Event<void>;
	readonly onDidChangeReadonly: Event<void>;
	readonly resource: URI;
	readonly viewType: string;
	readonly notebook: INotebookTextModel | undefined;
	isResolved(): this is IResolvedNotebookEditorModel;
	isDirty(): boolean;
	isReadonly(): boolean;
	isOrphaned(): boolean;
	hasAssociatedFilePath(): boolean;
	load(options?: INotebookLoadOptions): Promise<IResolvedNotebookEditorModel>;
	save(options?: ISaveOptions): Promise<boolean>;
	saveAs(target: URI): Promise<IUntypedEditorInput | undefined>;
	revert(options?: IRevertOptions): Promise<void>;
}

export interface INotebookDiffEditorModel extends IEditorModel {
	original: IResolvedNotebookEditorModel;
	modified: IResolvedNotebookEditorModel;
}

export interface NotebookDocumentBackupData extends IWorkingCopyBackupMeta {
	readonly viewType: string;
	readonly backupId?: string;
	readonly mtime?: number;
}

export enum NotebookEditorPriority {
	default = 'default',
	option = 'option',
}

export interface INotebookSearchOptions {
	regex?: boolean;
	wholeWord?: boolean;
	caseSensitive?: boolean;
	wordSeparators?: string;
	includeMarkupInput?: boolean;
	includeMarkupPreview?: boolean;
	includeCodeInput?: boolean;
	includeOutput?: boolean;
}

export interface INotebookExclusiveDocumentFilter {
	include?: string | glob.IRelativePattern;
	exclude?: string | glob.IRelativePattern;
}

export interface INotebookDocumentFilter {
	viewType?: string | string[];
	filenamePattern?: string | glob.IRelativePattern | INotebookExclusiveDocumentFilter;
}

//TODO@rebornix test

export function isDocumentExcludePattern(filenamePattern: string | glob.IRelativePattern | INotebookExclusiveDocumentFilter): filenamePattern is { include: string | glob.IRelativePattern; exclude: string | glob.IRelativePattern } {
	const arg = filenamePattern as INotebookExclusiveDocumentFilter;

	if ((typeof arg.include === 'string' || glob.isRelativePattern(arg.include))
		&& (typeof arg.exclude === 'string' || glob.isRelativePattern(arg.exclude))) {
		return true;
	}

	return false;
}
export function notebookDocumentFilterMatch(filter: INotebookDocumentFilter, viewType: string, resource: URI): boolean {
	if (Array.isArray(filter.viewType) && filter.viewType.indexOf(viewType) >= 0) {
		return true;
	}

	if (filter.viewType === viewType) {
		return true;
	}

	if (filter.filenamePattern) {
		const filenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.include : (filter.filenamePattern as string | glob.IRelativePattern);
		const excludeFilenamePattern = isDocumentExcludePattern(filter.filenamePattern) ? filter.filenamePattern.exclude : undefined;

		if (glob.match(filenamePattern, basename(resource.fsPath).toLowerCase())) {
			if (excludeFilenamePattern) {
				if (glob.match(excludeFilenamePattern, basename(resource.fsPath).toLowerCase())) {
					// should exclude

					return false;
				}
			}
			return true;
		}
	}
	return false;
}

export interface INotebookCellStatusBarItemProvider {
	viewType: string;
	onDidChangeStatusBarItems?: Event<void>;
	provideCellStatusBarItems(uri: URI, index: number, token: CancellationToken): Promise<INotebookCellStatusBarItemList | undefined>;
}


export interface INotebookDiffResult {
	cellsDiff: IDiffResult;
	linesDiff?: { originalCellhandle: number; modifiedCellhandle: number; lineChanges: ILineChange[] }[];
}

export interface INotebookCellStatusBarItem {
	readonly alignment: CellStatusbarAlignment;
	readonly priority?: number;
	readonly text: string;
	readonly color?: string | ThemeColor;
	readonly backgroundColor?: string | ThemeColor;
	readonly tooltip?: string;
	readonly command?: string | Command;
	readonly accessibilityInformation?: IAccessibilityInformation;
	readonly opacity?: string;
	readonly onlyShowWhenActive?: boolean;
}

export interface INotebookCellStatusBarItemList {
	items: INotebookCellStatusBarItem[];
	dispose?(): void;
}

export type ShowCellStatusBarType = 'hidden' | 'visible' | 'visibleAfterExecute';

export const NotebookSetting = {
	displayOrder: 'notebook.displayOrder',
	cellToolbarLocation: 'notebook.cellToolbarLocation',
	cellToolbarVisibility: 'notebook.cellToolbarVisibility',
	showCellStatusBar: 'notebook.showCellStatusBar',
	textDiffEditorPreview: 'notebook.diff.enablePreview',
	experimentalInsertToolbarAlignment: 'notebook.experimental.insertToolbarAlignment',
	compactView: 'notebook.compactView',
	focusIndicator: 'notebook.cellFocusIndicator',
	insertToolbarLocation: 'notebook.insertToolbarLocation',
	globalToolbar: 'notebook.globalToolbar',
	undoRedoPerCell: 'notebook.undoRedoPerCell',
	consolidatedOutputButton: 'notebook.consolidatedOutputButton',
	showFoldingControls: 'notebook.showFoldingControls',
	dragAndDropEnabled: 'notebook.dragAndDropEnabled',
	cellEditorOptionsCustomizations: 'notebook.editorOptionsCustomizations',
	consolidatedRunButton: 'notebook.consolidatedRunButton',
	openGettingStarted: 'notebook.experimental.openGettingStarted',
	textOutputLineLimit: 'notebook.output.textLineLimit',
	globalToolbarShowLabel: 'notebook.globalToolbarShowLabel',
	markupFontSize: 'notebook.markup.fontSize',
	interactiveWindowCollapseCodeCells: 'interactiveWindow.collapseCellInputCode',
	outputLineHeight: 'notebook.outputLineHeight',
	outputFontSize: 'notebook.outputFontSize',
	outputFontFamily: 'notebook.outputFontFamily'
} as const;

export const enum CellStatusbarAlignment {
	Left = 1,
	Right = 2
}

export interface INotebookDecorationRenderOptions {
	backgroundColor?: string | ThemeColor;
	borderColor?: string | ThemeColor;
	top?: editorCommon.IContentDecorationRenderOptions;
}

export class NotebookWorkingCopyTypeIdentifier {

	private static _prefix = 'notebook/';

	static create(viewType: string): string {
		return `${NotebookWorkingCopyTypeIdentifier._prefix}${viewType}`;
	}

	static parse(candidate: string): string | undefined {
		if (candidate.startsWith(NotebookWorkingCopyTypeIdentifier._prefix)) {
			return candidate.substring(NotebookWorkingCopyTypeIdentifier._prefix.length);
		}
		return undefined;
	}
}

export interface NotebookExtensionDescription {
	readonly id: ExtensionIdentifier;
	readonly location: UriComponents | undefined;
}
