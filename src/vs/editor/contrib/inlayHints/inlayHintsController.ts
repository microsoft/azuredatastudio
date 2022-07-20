/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { hash } from 'vs/base/common/hash';
import { DisposableStore, toDisposable } from 'vs/base/common/lifecycle';
import { LRUCache, ResourceMap } from 'vs/base/common/map';
import { IRange } from 'vs/base/common/range';
import { assertType } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { EditorOption, EDITOR_FONT_DEFAULTS } from 'vs/editor/common/config/editorOptions';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { IContentDecorationRenderOptions, IDecorationRenderOptions, IEditorContribution } from 'vs/editor/common/editorCommon';
import { IModelDeltaDecoration, ITextModel, IWordAtPosition, TrackedRangeStickiness } from 'vs/editor/common/model';
import { InlayHint, InlayHintKind, InlayHintsProvider, InlayHintsProviderRegistry } from 'vs/editor/common/modes';
import { LanguageFeatureRequestDelays } from 'vs/editor/common/modes/languageFeatureRegistry';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { editorInlayHintBackground, editorInlayHintForeground, editorInlayHintParameterBackground, editorInlayHintParameterForeground, editorInlayHintTypeBackground, editorInlayHintTypeForeground } from 'vs/platform/theme/common/colorRegistry';
import { themeColorFromId } from 'vs/platform/theme/common/themeService';

const MAX_DECORATORS = 1500;

class RequestMap<T = any> {

	private readonly _data = new ResourceMap<Set<T>>();

	push(model: ITextModel, provider: T): void {
		const value = this._data.get(model.uri);
		if (value === undefined) {
			this._data.set(model.uri, new Set([provider]));
		} else {
			value.add(provider);
		}
	}

	pop(model: ITextModel, provider: T): void {
		const value = this._data.get(model.uri);
		if (value) {
			value.delete(provider);
			if (value.size === 0) {
				this._data.delete(model.uri);
			}
		}
	}

	has(model: ITextModel, provider: T): boolean {
		return Boolean(this._data.get(model.uri)?.has(provider));
	}
}

export async function getInlayHints(model: ITextModel, ranges: Range[], requests: RequestMap<InlayHintsProvider>, token: CancellationToken): Promise<InlayHint[]> {
	const all: InlayHint[][] = [];
	const providers = InlayHintsProviderRegistry.ordered(model).reverse();

	const promises = providers.map(provider => ranges.map(async range => {
		try {
			requests.push(model, provider);
			const result = await provider.provideInlayHints(model, range, token);
			if (result?.length) {
				all.push(result.filter(hint => range.containsPosition(hint.position)));
			}
		} catch (err) {
			onUnexpectedExternalError(err);
		} finally {
			requests.pop(model, provider);
		}
	}));

	await Promise.all(promises.flat());

	return all.flat().sort((a, b) => Position.compare(a.position, b.position));
}

class InlayHintsCache {

	private readonly _entries = new LRUCache<string, InlayHint[]>(50);

	get(model: ITextModel): InlayHint[] | undefined {
		const key = InlayHintsCache._key(model);
		return this._entries.get(key);
	}

	set(model: ITextModel, value: InlayHint[]): void {
		const key = InlayHintsCache._key(model);
		this._entries.set(key, value);
	}

	private static _key(model: ITextModel): string {
		return `${model.uri.toString()}/${model.getVersionId()}`;
	}
}

export class InlayHintsController implements IEditorContribution {

	static readonly ID: string = 'editor.contrib.InlayHints';

	private static _decorationOwnerIdPool = 0;
	private readonly _decorationOwnerId = ++InlayHintsController._decorationOwnerIdPool;

	private readonly _disposables = new DisposableStore();
	private readonly _sessionDisposables = new DisposableStore();
	private readonly _getInlayHintsDelays = new LanguageFeatureRequestDelays(InlayHintsProviderRegistry, 25, 500);
	private readonly _cache = new InlayHintsCache();

	private _decorations = new Map<string, { hint: InlayHint, decorationTypeId: string }>();

	constructor(
		private readonly _editor: ICodeEditor,
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
	) {
		this._disposables.add(InlayHintsProviderRegistry.onDidChange(() => this._update()));
		this._disposables.add(_editor.onDidChangeModel(() => this._update()));
		this._disposables.add(_editor.onDidChangeModelLanguage(() => this._update()));
		this._disposables.add(_editor.onDidChangeConfiguration(e => {
			if (e.hasChanged(EditorOption.inlayHints)) {
				this._update();
			}
		}));
		this._update();
	}

	dispose(): void {
		this._sessionDisposables.dispose();
		this._removeAllDecorations();
		this._disposables.dispose();
	}

	private _update(): void {
		this._sessionDisposables.clear();
		this._removeAllDecorations();

		if (!this._editor.getOption(EditorOption.inlayHints).enabled) {
			return;
		}

		const model = this._editor.getModel();
		if (!model || !InlayHintsProviderRegistry.has(model)) {
			return;
		}

		// iff possible, quickly update from cache
		const cached = this._cache.get(model);
		if (cached) {
			this._updateHintsDecorators([model.getFullModelRange()], cached);
		}

		const requests = new RequestMap<InlayHintsProvider>();

		const scheduler = new RunOnceScheduler(async () => {
			const t1 = Date.now();

			const cts = new CancellationTokenSource();
			this._sessionDisposables.add(toDisposable(() => cts.dispose(true)));

			const ranges = this._getHintsRanges();
			const result = await getInlayHints(model, ranges, requests, cts.token);
			scheduler.delay = this._getInlayHintsDelays.update(model, Date.now() - t1);
			if (cts.token.isCancellationRequested) {
				return;
			}
			this._updateHintsDecorators(ranges, result);
			this._cache.set(model, Array.from(this._decorations.values()).map(obj => obj.hint));

		}, this._getInlayHintsDelays.get(model));

		this._sessionDisposables.add(scheduler);

		// update inline hints when content or scroll position changes
		this._sessionDisposables.add(this._editor.onDidChangeModelContent(() => scheduler.schedule()));
		this._disposables.add(this._editor.onDidScrollChange(() => scheduler.schedule()));
		scheduler.schedule();

		// update inline hints when any any provider fires an event
		const providerListener = new DisposableStore();
		this._sessionDisposables.add(providerListener);
		for (const provider of InlayHintsProviderRegistry.all(model)) {
			if (typeof provider.onDidChangeInlayHints === 'function') {
				providerListener.add(provider.onDidChangeInlayHints(() => {
					if (!requests.has(model, provider)) {
						scheduler.schedule();
					}
				}));
			}
		}
	}

	private _getHintsRanges(): Range[] {
		const extra = 30;
		const model = this._editor.getModel()!;
		const visibleRanges = this._editor.getVisibleRangesPlusViewportAboveBelow();
		const result: Range[] = [];
		for (const range of visibleRanges.sort(Range.compareRangesUsingStarts)) {
			const extendedRange = model.validateRange(new Range(range.startLineNumber - extra, range.startColumn, range.endLineNumber + extra, range.endColumn));
			if (result.length === 0 || !Range.areIntersectingOrTouching(result[result.length - 1], extendedRange)) {
				result.push(extendedRange);
			} else {
				result[result.length - 1] = Range.plusRange(result[result.length - 1], extendedRange);
			}
		}
		return result;
	}

	private _updateHintsDecorators(ranges: Range[], hints: InlayHint[]): void {

		const { fontSize, fontFamily } = this._getLayoutInfo();
		const model = this._editor.getModel()!;

		const newDecorationsTypeIds: string[] = [];
		const newDecorationsData: IModelDeltaDecoration[] = [];

		const fontFamilyVar = '--code-editorInlayHintsFontFamily';
		this._editor.getContainerDomNode().style.setProperty(fontFamilyVar, fontFamily);

		for (const hint of hints) {

			const { text, position, whitespaceBefore, whitespaceAfter } = hint;
			const marginBefore = whitespaceBefore ? (fontSize / 3) | 0 : 0;
			const marginAfter = whitespaceAfter ? (fontSize / 3) | 0 : 0;

			const contentOptions: IContentDecorationRenderOptions = {
				contentText: fixSpace(text),
				fontSize: `${fontSize}px`,
				margin: `0px ${marginAfter}px 0px ${marginBefore}px`,
				fontFamily: `var(${fontFamilyVar}), ${EDITOR_FONT_DEFAULTS.fontFamily}`,
				padding: `1px ${Math.max(1, fontSize / 4) | 0}px`,
				borderRadius: `${(fontSize / 4) | 0}px`,
				verticalAlign: 'middle',
				backgroundColor: themeColorFromId(editorInlayHintBackground),
				color: themeColorFromId(editorInlayHintForeground)
			};

			if (hint.kind === InlayHintKind.Parameter) {
				contentOptions.backgroundColor = themeColorFromId(editorInlayHintParameterBackground);
				contentOptions.color = themeColorFromId(editorInlayHintParameterForeground);
			} else if (hint.kind === InlayHintKind.Type) {
				contentOptions.backgroundColor = themeColorFromId(editorInlayHintTypeBackground);
				contentOptions.color = themeColorFromId(editorInlayHintTypeForeground);
			}

			let renderOptions: IDecorationRenderOptions = { beforeInjectedText: { ...contentOptions, affectsLetterSpacing: true } };

			let range = Range.fromPositions(position);
			let word = model.getWordAtPosition(position);
			let usesWordRange = false;
			if (word) {
				if (word.endColumn === position.column) {
					// change decoration to after
					renderOptions.afterInjectedText = renderOptions.beforeInjectedText;
					renderOptions.beforeInjectedText = undefined;
					usesWordRange = true;
					range = wordToRange(word, position.lineNumber);
				} else if (word.startColumn === position.column) {
					usesWordRange = true;
					range = wordToRange(word, position.lineNumber);
				}
			}

			const key = 'inlayHints-' + hash(renderOptions).toString(16);
			this._codeEditorService.registerDecorationType('inlay-hints-controller', key, renderOptions, undefined, this._editor);

			// decoration types are ref-counted which means we only need to
			// call register und remove equally often
			newDecorationsTypeIds.push(key);

			const newLen = newDecorationsData.push({
				range,
				options: {
					...this._codeEditorService.resolveDecorationOptions(key, true),
					showIfCollapsed: !usesWordRange,
					stickiness: TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges
				}
			});

			if (newLen > MAX_DECORATORS) {
				break;
			}
		}

		// collect all decoration ids that are affected by the ranges
		// and only update those decorations
		const decorationIdsToUpdate: string[] = [];
		for (const range of ranges) {
			for (const { id } of model.getDecorationsInRange(range, this._decorationOwnerId, true)) {
				const obj = this._decorations.get(id);
				if (obj) {
					decorationIdsToUpdate.push(id);
					this._codeEditorService.removeDecorationType(obj.decorationTypeId);
					this._decorations.delete(id);
				}
			}
		}
		const newDecorationIds = model.deltaDecorations(decorationIdsToUpdate, newDecorationsData, this._decorationOwnerId);
		for (let i = 0; i < newDecorationIds.length; i++) {
			this._decorations.set(newDecorationIds[i], { hint: hints[i], decorationTypeId: newDecorationsTypeIds[i] });
		}
	}

	private _getLayoutInfo() {
		const options = this._editor.getOption(EditorOption.inlayHints);
		const editorFontSize = this._editor.getOption(EditorOption.fontSize);
		let fontSize = options.fontSize;
		if (!fontSize || fontSize < 5 || fontSize > editorFontSize) {
			fontSize = (editorFontSize * .9) | 0;
		}
		const fontFamily = options.fontFamily || this._editor.getOption(EditorOption.fontFamily);
		return { fontSize, fontFamily };
	}

	private _removeAllDecorations(): void {
		this._editor.deltaDecorations(Array.from(this._decorations.keys()), []);
		for (let obj of this._decorations.values()) {
			this._codeEditorService.removeDecorationType(obj.decorationTypeId);
		}
		this._decorations.clear();
	}
}

function wordToRange(word: IWordAtPosition, lineNumber: number): Range {
	return new Range(
		lineNumber,
		word.startColumn,
		lineNumber,
		word.endColumn
	);
}

function fixSpace(str: string): string {
	const noBreakWhitespace = '\xa0';
	return str.replace(/[ \t]/g, noBreakWhitespace);
}

registerEditorContribution(InlayHintsController.ID, InlayHintsController);

CommandsRegistry.registerCommand('_executeInlayHintProvider', async (accessor, ...args: [URI, IRange]): Promise<InlayHint[]> => {

	const [uri, range] = args;
	assertType(URI.isUri(uri));
	assertType(Range.isIRange(range));

	const ref = await accessor.get(ITextModelService).createModelReference(uri);
	try {
		const data = await getInlayHints(ref.object.textEditorModel, [Range.lift(range)], new RequestMap(), CancellationToken.None);
		return data;

	} finally {
		ref.dispose();
	}
});
