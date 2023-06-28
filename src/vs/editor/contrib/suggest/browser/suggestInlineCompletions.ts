/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { FuzzyScore } from 'vs/base/common/filters';
import { Iterable } from 'vs/base/common/iterator';
import { IDisposable, RefCountedDisposable } from 'vs/base/common/lifecycle';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { EditorContributionInstantiation, registerEditorContribution } from 'vs/editor/browser/editorExtensions';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { EditorOption, FindComputedEditorOptionValueById } from 'vs/editor/common/config/editorOptions';
import { ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { IPosition, Position } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { IWordAtPosition } from 'vs/editor/common/core/wordHelper';
import { IEditorContribution } from 'vs/editor/common/editorCommon';
import { Command, CompletionItemInsertTextRule, CompletionItemProvider, CompletionTriggerKind, InlineCompletion, InlineCompletionContext, InlineCompletions, InlineCompletionsProvider } from 'vs/editor/common/languages';
import { ITextModel } from 'vs/editor/common/model';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { CompletionModel, LineContext } from 'vs/editor/contrib/suggest/browser/completionModel';
import { CompletionItem, CompletionItemModel, CompletionOptions, provideSuggestionItems, QuickSuggestionsOptions } from 'vs/editor/contrib/suggest/browser/suggest';
import { ISuggestMemoryService } from 'vs/editor/contrib/suggest/browser/suggestMemory';
import { WordDistance } from 'vs/editor/contrib/suggest/browser/wordDistance';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

class SuggestInlineCompletion implements InlineCompletion {

	constructor(
		readonly range: IRange,
		readonly insertText: string | { snippet: string },
		readonly filterText: string,
		readonly additionalTextEdits: ISingleEditOperation[] | undefined,
		readonly command: Command | undefined,
		readonly completion: CompletionItem,
	) { }
}

class InlineCompletionResults extends RefCountedDisposable implements InlineCompletions<SuggestInlineCompletion> {

	constructor(
		readonly model: ITextModel,
		readonly line: number,
		readonly word: IWordAtPosition,
		readonly completionModel: CompletionModel,
		completions: CompletionItemModel,
		@ISuggestMemoryService private readonly _suggestMemoryService: ISuggestMemoryService,
	) {
		super(completions.disposable);
	}

	canBeReused(model: ITextModel, line: number, word: IWordAtPosition) {
		return this.model === model // same model
			&& this.line === line
			&& this.word.word.length > 0
			&& this.word.startColumn === word.startColumn && this.word.endColumn < word.endColumn // same word
			&& this.completionModel.getIncompleteProvider().size === 0; // no incomplete results
	}

	get items(): SuggestInlineCompletion[] {
		const result: SuggestInlineCompletion[] = [];

		// Split items by preselected index. This ensures the memory-selected item shows first and that better/worst
		// ranked items are before/after
		const { items } = this.completionModel;
		const selectedIndex = this._suggestMemoryService.select(this.model, { lineNumber: this.line, column: this.word.endColumn + this.completionModel.lineContext.characterCountDelta }, items);
		const first = Iterable.slice(items, selectedIndex);
		const second = Iterable.slice(items, 0, selectedIndex);

		let resolveCount = 5;

		for (const item of Iterable.concat(first, second)) {

			if (item.score === FuzzyScore.Default) {
				// skip items that have no overlap
				continue;
			}

			const range = new Range(
				item.editStart.lineNumber, item.editStart.column,
				item.editInsertEnd.lineNumber, item.editInsertEnd.column + this.completionModel.lineContext.characterCountDelta // end PLUS character delta
			);
			const insertText = item.completion.insertTextRules && (item.completion.insertTextRules & CompletionItemInsertTextRule.InsertAsSnippet)
				? { snippet: item.completion.insertText }
				: item.completion.insertText;

			result.push(new SuggestInlineCompletion(
				range,
				insertText,
				item.filterTextLow ?? item.labelLow,
				item.completion.additionalTextEdits,
				item.completion.command,
				item
			));

			// resolve the first N suggestions eagerly
			if (resolveCount-- >= 0) {
				item.resolve(CancellationToken.None);
			}
		}
		return result;
	}
}


export class SuggestInlineCompletions implements InlineCompletionsProvider<InlineCompletionResults> {

	private _lastResult?: InlineCompletionResults;

	constructor(
		private readonly _getEditorOption: <T extends EditorOption>(id: T, model: ITextModel) => FindComputedEditorOptionValueById<T>,
		@ILanguageFeaturesService private readonly _languageFeatureService: ILanguageFeaturesService,
		@IClipboardService private readonly _clipboardService: IClipboardService,
		@ISuggestMemoryService private readonly _suggestMemoryService: ISuggestMemoryService,
	) { }

	async provideInlineCompletions(model: ITextModel, position: Position, context: InlineCompletionContext, token: CancellationToken): Promise<InlineCompletionResults | undefined> {

		if (context.selectedSuggestionInfo) {
			return undefined;
		}

		const config = this._getEditorOption(EditorOption.quickSuggestions, model);
		if (QuickSuggestionsOptions.isAllOff(config)) {
			// quick suggest is off (for this model/language)
			return undefined;
		}

		model.tokenization.tokenizeIfCheap(position.lineNumber);
		const lineTokens = model.tokenization.getLineTokens(position.lineNumber);
		const tokenType = lineTokens.getStandardTokenType(lineTokens.findTokenIndexAtOffset(Math.max(position.column - 1 - 1, 0)));
		if (QuickSuggestionsOptions.valueFor(config, tokenType) !== 'inline') {
			// quick suggest is off (for this token)
			return undefined;
		}

		// We consider non-empty leading words and trigger characters. The latter only
		// when no word is being typed (word characters superseed trigger characters)
		let wordInfo = model.getWordAtPosition(position);
		let triggerCharacterInfo: { ch: string; providers: Set<CompletionItemProvider> } | undefined;

		if (!wordInfo?.word) {
			triggerCharacterInfo = this._getTriggerCharacterInfo(model, position);
		}

		if (!wordInfo?.word && !triggerCharacterInfo) {
			// not at word, not a trigger character
			return undefined;
		}

		// ensure that we have word information and that we are at the end of a word
		// otherwise we stop because we don't want to do quick suggestions inside words
		if (!wordInfo) {
			wordInfo = model.getWordUntilPosition(position);
		}
		if (wordInfo.endColumn !== position.column) {
			return undefined;
		}

		let result: InlineCompletionResults;
		const leadingLineContents = model.getValueInRange(new Range(position.lineNumber, 1, position.lineNumber, position.column));
		if (!triggerCharacterInfo && this._lastResult?.canBeReused(model, position.lineNumber, wordInfo)) {
			// reuse a previous result iff possible, only a refilter is needed
			// TODO@jrieken this can be improved further and only incomplete results can be updated
			// console.log(`REUSE with ${wordInfo.word}`);
			const newLineContext = new LineContext(leadingLineContents, position.column - this._lastResult.word.endColumn);
			this._lastResult.completionModel.lineContext = newLineContext;
			this._lastResult.acquire();
			result = this._lastResult;

		} else {
			// refesh model is required
			const completions = await provideSuggestionItems(
				this._languageFeatureService.completionProvider,
				model, position,
				new CompletionOptions(undefined, undefined, triggerCharacterInfo?.providers),
				triggerCharacterInfo && { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: triggerCharacterInfo.ch },
				token
			);

			let clipboardText: string | undefined;
			if (completions.needsClipboard) {
				clipboardText = await this._clipboardService.readText();
			}

			const completionModel = new CompletionModel(
				completions.items,
				position.column,
				new LineContext(leadingLineContents, 0),
				WordDistance.None,
				this._getEditorOption(EditorOption.suggest, model),
				this._getEditorOption(EditorOption.snippetSuggestions, model),
				{ boostFullMatch: false, firstMatchCanBeWeak: false },
				clipboardText
			);
			result = new InlineCompletionResults(model, position.lineNumber, wordInfo, completionModel, completions, this._suggestMemoryService);
		}

		this._lastResult = result;
		return result;
	}

	handleItemDidShow(_completions: InlineCompletionResults, item: SuggestInlineCompletion): void {
		item.completion.resolve(CancellationToken.None);
	}

	freeInlineCompletions(result: InlineCompletionResults): void {
		result.release();
	}

	private _getTriggerCharacterInfo(model: ITextModel, position: IPosition) {
		const ch = model.getValueInRange(Range.fromPositions({ lineNumber: position.lineNumber, column: position.column - 1 }, position));
		const providers = new Set<CompletionItemProvider>();
		for (const provider of this._languageFeatureService.completionProvider.all(model)) {
			if (provider.triggerCharacters?.includes(ch)) {
				providers.add(provider);
			}
		}
		if (providers.size === 0) {
			return undefined;
		}
		return { providers, ch };
	}
}

class EditorContribution implements IEditorContribution {

	private static _counter = 0;
	private static _disposable: IDisposable | undefined;

	constructor(
		_editor: ICodeEditor,
		@ILanguageFeaturesService languageFeatureService: ILanguageFeaturesService,
		@ICodeEditorService editorService: ICodeEditorService,
		@IInstantiationService instaService: IInstantiationService,
	) {
		// HACK - way to contribute something only once
		if (++EditorContribution._counter === 1) {
			const provider = instaService.createInstance(
				SuggestInlineCompletions,
				(id, model) => {
					// HACK - reuse the editor options world outside from a "normal" contribution
					const editor = editorService.listCodeEditors().find(editor => editor.getModel() === model) ?? _editor;
					return editor.getOption(id);
				},
			);
			EditorContribution._disposable = languageFeatureService.inlineCompletionsProvider.register('*', provider);
		}
	}

	dispose(): void {
		if (--EditorContribution._counter === 0) {
			EditorContribution._disposable?.dispose();
			EditorContribution._disposable = undefined;
		}
	}
}

registerEditorContribution('suggest.inlineCompletionsProvider', EditorContribution, EditorContributionInstantiation.Eager); // eager because the contribution is used as a way to ONCE access a service to which a provider is registered
