/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { alert } from 'vs/base/browser/ui/aria/aria';
import { asArray, isNonEmptyArray } from 'vs/base/common/arrays';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { onUnexpectedExternalError } from 'vs/base/common/errors';
import { Iterable } from 'vs/base/common/iterator';
import { IDisposable } from 'vs/base/common/lifecycle';
import { LinkedList } from 'vs/base/common/linkedList';
import { assertType } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { CodeEditorStateFlag, EditorStateCancellationTokenSource, TextModelCancellationTokenSource } from 'vs/editor/contrib/editorState/browser/editorState';
import { IActiveCodeEditor, isCodeEditor } from 'vs/editor/browser/editorBrowser';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection } from 'vs/editor/common/core/selection';
import { ScrollType } from 'vs/editor/common/editorCommon';
import { ITextModel } from 'vs/editor/common/model';
import { ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, FormattingOptions, TextEdit } from 'vs/editor/common/languages';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorker';
import { ITextModelService } from 'vs/editor/common/services/resolverService';
import { FormattingEdit } from 'vs/editor/contrib/format/browser/formattingEdit';
import * as nls from 'vs/nls';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { ExtensionIdentifierSet } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IProgress } from 'vs/platform/progress/common/progress';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { LanguageFeatureRegistry } from 'vs/editor/common/languageFeatureRegistry';
import { ILogService } from 'vs/platform/log/common/log';

export function alertFormattingEdits(edits: ISingleEditOperation[]): void {

	edits = edits.filter(edit => edit.range);
	if (!edits.length) {
		return;
	}

	let { range } = edits[0];
	for (let i = 1; i < edits.length; i++) {
		range = Range.plusRange(range, edits[i].range);
	}
	const { startLineNumber, endLineNumber } = range;
	if (startLineNumber === endLineNumber) {
		if (edits.length === 1) {
			alert(nls.localize('hint11', "Made 1 formatting edit on line {0}", startLineNumber));
		} else {
			alert(nls.localize('hintn1', "Made {0} formatting edits on line {1}", edits.length, startLineNumber));
		}
	} else {
		if (edits.length === 1) {
			alert(nls.localize('hint1n', "Made 1 formatting edit between lines {0} and {1}", startLineNumber, endLineNumber));
		} else {
			alert(nls.localize('hintnn', "Made {0} formatting edits between lines {1} and {2}", edits.length, startLineNumber, endLineNumber));
		}
	}
}

export function getRealAndSyntheticDocumentFormattersOrdered(
	documentFormattingEditProvider: LanguageFeatureRegistry<DocumentFormattingEditProvider>,
	documentRangeFormattingEditProvider: LanguageFeatureRegistry<DocumentRangeFormattingEditProvider>,
	model: ITextModel
): DocumentFormattingEditProvider[] {
	const result: DocumentFormattingEditProvider[] = [];
	const seen = new ExtensionIdentifierSet();

	// (1) add all document formatter
	const docFormatter = documentFormattingEditProvider.ordered(model);
	for (const formatter of docFormatter) {
		result.push(formatter);
		if (formatter.extensionId) {
			seen.add(formatter.extensionId);
		}
	}

	// (2) add all range formatter as document formatter (unless the same extension already did that)
	const rangeFormatter = documentRangeFormattingEditProvider.ordered(model);
	for (const formatter of rangeFormatter) {
		if (formatter.extensionId) {
			if (seen.has(formatter.extensionId)) {
				continue;
			}
			seen.add(formatter.extensionId);
		}
		result.push({
			displayName: formatter.displayName,
			extensionId: formatter.extensionId,
			provideDocumentFormattingEdits(model, options, token) {
				return formatter.provideDocumentRangeFormattingEdits(model, model.getFullModelRange(), options, token);
			}
		});
	}
	return result;
}

export const enum FormattingMode {
	Explicit = 1,
	Silent = 2
}

export interface IFormattingEditProviderSelector {
	<T extends (DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider)>(formatter: T[], document: ITextModel, mode: FormattingMode): Promise<T | undefined>;
}

export abstract class FormattingConflicts {

	private static readonly _selectors = new LinkedList<IFormattingEditProviderSelector>();

	static setFormatterSelector(selector: IFormattingEditProviderSelector): IDisposable {
		const remove = FormattingConflicts._selectors.unshift(selector);
		return { dispose: remove };
	}

	static async select<T extends (DocumentFormattingEditProvider | DocumentRangeFormattingEditProvider)>(formatter: T[], document: ITextModel, mode: FormattingMode): Promise<T | undefined> {
		if (formatter.length === 0) {
			return undefined;
		}
		const selector = Iterable.first(FormattingConflicts._selectors);
		if (selector) {
			return await selector(formatter, document, mode);
		}
		return undefined;
	}
}

export async function formatDocumentRangesWithSelectedProvider(
	accessor: ServicesAccessor,
	editorOrModel: ITextModel | IActiveCodeEditor,
	rangeOrRanges: Range | Range[],
	mode: FormattingMode,
	progress: IProgress<DocumentRangeFormattingEditProvider>,
	token: CancellationToken
): Promise<void> {

	const instaService = accessor.get(IInstantiationService);
	const { documentRangeFormattingEditProvider: documentRangeFormattingEditProviderRegistry } = accessor.get(ILanguageFeaturesService);
	const model = isCodeEditor(editorOrModel) ? editorOrModel.getModel() : editorOrModel;
	const provider = documentRangeFormattingEditProviderRegistry.ordered(model);
	const selected = await FormattingConflicts.select(provider, model, mode);
	if (selected) {
		progress.report(selected);
		await instaService.invokeFunction(formatDocumentRangesWithProvider, selected, editorOrModel, rangeOrRanges, token);
	}
}

export async function formatDocumentRangesWithProvider(
	accessor: ServicesAccessor,
	provider: DocumentRangeFormattingEditProvider,
	editorOrModel: ITextModel | IActiveCodeEditor,
	rangeOrRanges: Range | Range[],
	token: CancellationToken
): Promise<boolean> {
	const workerService = accessor.get(IEditorWorkerService);
	const logService = accessor.get(ILogService);

	let model: ITextModel;
	let cts: CancellationTokenSource;
	if (isCodeEditor(editorOrModel)) {
		model = editorOrModel.getModel();
		cts = new EditorStateCancellationTokenSource(editorOrModel, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position, undefined, token);
	} else {
		model = editorOrModel;
		cts = new TextModelCancellationTokenSource(editorOrModel, token);
	}

	// make sure that ranges don't overlap nor touch each other
	const ranges: Range[] = [];
	let len = 0;
	for (const range of asArray(rangeOrRanges).sort(Range.compareRangesUsingStarts)) {
		if (len > 0 && Range.areIntersectingOrTouching(ranges[len - 1], range)) {
			ranges[len - 1] = Range.fromPositions(ranges[len - 1].getStartPosition(), range.getEndPosition());
		} else {
			len = ranges.push(range);
		}
	}

	const computeEdits = async (range: Range) => {
		logService.trace(`[format][provideDocumentRangeFormattingEdits] (request)`, provider.extensionId?.value, range);

		const result = (await provider.provideDocumentRangeFormattingEdits(
			model,
			range,
			model.getFormattingOptions(),
			cts.token
		)) || [];

		logService.trace(`[format][provideDocumentRangeFormattingEdits] (response)`, provider.extensionId?.value, result);

		return result;
	};

	const hasIntersectingEdit = (a: TextEdit[], b: TextEdit[]) => {
		if (!a.length || !b.length) {
			return false;
		}
		// quick exit if the list of ranges are completely unrelated [O(n)]
		const mergedA = a.reduce((acc, val) => { return Range.plusRange(acc, val.range); }, a[0].range);
		if (!b.some(x => { return Range.intersectRanges(mergedA, x.range); })) {
			return false;
		}
		// fallback to a complete check [O(n^2)]
		for (const edit of a) {
			for (const otherEdit of b) {
				if (Range.intersectRanges(edit.range, otherEdit.range)) {
					return true;
				}
			}
		}
		return false;
	};

	const allEdits: TextEdit[] = [];
	const rawEditsList: TextEdit[][] = [];
	try {
		if (typeof provider.provideDocumentRangesFormattingEdits === 'function') {
			logService.trace(`[format][provideDocumentRangeFormattingEdits] (request)`, provider.extensionId?.value, ranges);
			const result = (await provider.provideDocumentRangesFormattingEdits(
				model,
				ranges,
				model.getFormattingOptions(),
				cts.token
			)) || [];
			logService.trace(`[format][provideDocumentRangeFormattingEdits] (response)`, provider.extensionId?.value, result);
			rawEditsList.push(result);
		} else {

			for (const range of ranges) {
				if (cts.token.isCancellationRequested) {
					return true;
				}
				rawEditsList.push(await computeEdits(range));
			}

			for (let i = 0; i < ranges.length; ++i) {
				for (let j = i + 1; j < ranges.length; ++j) {
					if (cts.token.isCancellationRequested) {
						return true;
					}
					if (hasIntersectingEdit(rawEditsList[i], rawEditsList[j])) {
						// Merge ranges i and j into a single range, recompute the associated edits
						const mergedRange = Range.plusRange(ranges[i], ranges[j]);
						const edits = await computeEdits(mergedRange);
						ranges.splice(j, 1);
						ranges.splice(i, 1);
						ranges.push(mergedRange);
						rawEditsList.splice(j, 1);
						rawEditsList.splice(i, 1);
						rawEditsList.push(edits);
						// Restart scanning
						i = 0;
						j = 0;
					}
				}
			}
		}

		for (const rawEdits of rawEditsList) {
			if (cts.token.isCancellationRequested) {
				return true;
			}
			const minimalEdits = await workerService.computeMoreMinimalEdits(model.uri, rawEdits);
			if (minimalEdits) {
				allEdits.push(...minimalEdits);
			}
		}
	} finally {
		cts.dispose();
	}

	if (allEdits.length === 0) {
		return false;
	}

	if (isCodeEditor(editorOrModel)) {
		// use editor to apply edits
		FormattingEdit.execute(editorOrModel, allEdits, true);
		alertFormattingEdits(allEdits);
		editorOrModel.revealPositionInCenterIfOutsideViewport(editorOrModel.getPosition(), ScrollType.Immediate);

	} else {
		// use model to apply edits
		const [{ range }] = allEdits;
		const initialSelection = new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
		model.pushEditOperations([initialSelection], allEdits.map(edit => {
			return {
				text: edit.text,
				range: Range.lift(edit.range),
				forceMoveMarkers: true
			};
		}), undoEdits => {
			for (const { range } of undoEdits) {
				if (Range.areIntersectingOrTouching(range, initialSelection)) {
					return [new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)];
				}
			}
			return null;
		});
	}

	return true;
}

export async function formatDocumentWithSelectedProvider(
	accessor: ServicesAccessor,
	editorOrModel: ITextModel | IActiveCodeEditor,
	mode: FormattingMode,
	progress: IProgress<DocumentFormattingEditProvider>,
	token: CancellationToken
): Promise<void> {

	const instaService = accessor.get(IInstantiationService);
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const model = isCodeEditor(editorOrModel) ? editorOrModel.getModel() : editorOrModel;
	const provider = getRealAndSyntheticDocumentFormattersOrdered(languageFeaturesService.documentFormattingEditProvider, languageFeaturesService.documentRangeFormattingEditProvider, model);
	const selected = await FormattingConflicts.select(provider, model, mode);
	if (selected) {
		progress.report(selected);
		await instaService.invokeFunction(formatDocumentWithProvider, selected, editorOrModel, mode, token);
	}
}

export async function formatDocumentWithProvider(
	accessor: ServicesAccessor,
	provider: DocumentFormattingEditProvider,
	editorOrModel: ITextModel | IActiveCodeEditor,
	mode: FormattingMode,
	token: CancellationToken
): Promise<boolean> {
	const workerService = accessor.get(IEditorWorkerService);

	let model: ITextModel;
	let cts: CancellationTokenSource;
	if (isCodeEditor(editorOrModel)) {
		model = editorOrModel.getModel();
		cts = new EditorStateCancellationTokenSource(editorOrModel, CodeEditorStateFlag.Value | CodeEditorStateFlag.Position, undefined, token);
	} else {
		model = editorOrModel;
		cts = new TextModelCancellationTokenSource(editorOrModel, token);
	}

	let edits: TextEdit[] | undefined;
	try {
		const rawEdits = await provider.provideDocumentFormattingEdits(
			model,
			model.getFormattingOptions(),
			cts.token
		);

		edits = await workerService.computeMoreMinimalEdits(model.uri, rawEdits);

		if (cts.token.isCancellationRequested) {
			return true;
		}

	} finally {
		cts.dispose();
	}

	if (!edits || edits.length === 0) {
		return false;
	}

	if (isCodeEditor(editorOrModel)) {
		// use editor to apply edits
		FormattingEdit.execute(editorOrModel, edits, mode !== FormattingMode.Silent);

		if (mode !== FormattingMode.Silent) {
			alertFormattingEdits(edits);
			editorOrModel.revealPositionInCenterIfOutsideViewport(editorOrModel.getPosition(), ScrollType.Immediate);
		}

	} else {
		// use model to apply edits
		const [{ range }] = edits;
		const initialSelection = new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
		model.pushEditOperations([initialSelection], edits.map(edit => {
			return {
				text: edit.text,
				range: Range.lift(edit.range),
				forceMoveMarkers: true
			};
		}), undoEdits => {
			for (const { range } of undoEdits) {
				if (Range.areIntersectingOrTouching(range, initialSelection)) {
					return [new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn)];
				}
			}
			return null;
		});
	}

	return true;
}

export async function getDocumentRangeFormattingEditsUntilResult(
	workerService: IEditorWorkerService,
	languageFeaturesService: ILanguageFeaturesService,
	model: ITextModel,
	range: Range,
	options: FormattingOptions,
	token: CancellationToken
): Promise<TextEdit[] | undefined> {

	const providers = languageFeaturesService.documentRangeFormattingEditProvider.ordered(model);
	for (const provider of providers) {
		const rawEdits = await Promise.resolve(provider.provideDocumentRangeFormattingEdits(model, range, options, token)).catch(onUnexpectedExternalError);
		if (isNonEmptyArray(rawEdits)) {
			return await workerService.computeMoreMinimalEdits(model.uri, rawEdits);
		}
	}
	return undefined;
}

export async function getDocumentFormattingEditsUntilResult(
	workerService: IEditorWorkerService,
	languageFeaturesService: ILanguageFeaturesService,
	model: ITextModel,
	options: FormattingOptions,
	token: CancellationToken
): Promise<TextEdit[] | undefined> {

	const providers = getRealAndSyntheticDocumentFormattersOrdered(languageFeaturesService.documentFormattingEditProvider, languageFeaturesService.documentRangeFormattingEditProvider, model);
	for (const provider of providers) {
		const rawEdits = await Promise.resolve(provider.provideDocumentFormattingEdits(model, options, token)).catch(onUnexpectedExternalError);
		if (isNonEmptyArray(rawEdits)) {
			return await workerService.computeMoreMinimalEdits(model.uri, rawEdits);
		}
	}
	return undefined;
}

export function getOnTypeFormattingEdits(
	workerService: IEditorWorkerService,
	languageFeaturesService: ILanguageFeaturesService,
	model: ITextModel,
	position: Position,
	ch: string,
	options: FormattingOptions,
	token: CancellationToken
): Promise<TextEdit[] | null | undefined> {

	const providers = languageFeaturesService.onTypeFormattingEditProvider.ordered(model);

	if (providers.length === 0) {
		return Promise.resolve(undefined);
	}

	if (providers[0].autoFormatTriggerCharacters.indexOf(ch) < 0) {
		return Promise.resolve(undefined);
	}

	return Promise.resolve(providers[0].provideOnTypeFormattingEdits(model, position, ch, options, token)).catch(onUnexpectedExternalError).then(edits => {
		return workerService.computeMoreMinimalEdits(model.uri, edits);
	});
}

CommandsRegistry.registerCommand('_executeFormatRangeProvider', async function (accessor, ...args) {
	const [resource, range, options] = args;
	assertType(URI.isUri(resource));
	assertType(Range.isIRange(range));

	const resolverService = accessor.get(ITextModelService);
	const workerService = accessor.get(IEditorWorkerService);
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const reference = await resolverService.createModelReference(resource);
	try {
		return getDocumentRangeFormattingEditsUntilResult(workerService, languageFeaturesService, reference.object.textEditorModel, Range.lift(range), options, CancellationToken.None);
	} finally {
		reference.dispose();
	}
});

CommandsRegistry.registerCommand('_executeFormatDocumentProvider', async function (accessor, ...args) {
	const [resource, options] = args;
	assertType(URI.isUri(resource));

	const resolverService = accessor.get(ITextModelService);
	const workerService = accessor.get(IEditorWorkerService);
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const reference = await resolverService.createModelReference(resource);
	try {
		return getDocumentFormattingEditsUntilResult(workerService, languageFeaturesService, reference.object.textEditorModel, options, CancellationToken.None);
	} finally {
		reference.dispose();
	}
});

CommandsRegistry.registerCommand('_executeFormatOnTypeProvider', async function (accessor, ...args) {
	const [resource, position, ch, options] = args;
	assertType(URI.isUri(resource));
	assertType(Position.isIPosition(position));
	assertType(typeof ch === 'string');

	const resolverService = accessor.get(ITextModelService);
	const workerService = accessor.get(IEditorWorkerService);
	const languageFeaturesService = accessor.get(ILanguageFeaturesService);
	const reference = await resolverService.createModelReference(resource);
	try {
		return getOnTypeFormattingEdits(workerService, languageFeaturesService, reference.object.textEditorModel, Position.lift(position), ch, options, CancellationToken.None);
	} finally {
		reference.dispose();
	}
});
