/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from 'vs/base/common/htmlContent';
import { compare, compareSubstring } from 'vs/base/common/strings';
import { Position } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { ITextModel } from 'vs/editor/common/model';
import { CompletionItem, CompletionItemKind, CompletionItemProvider, CompletionList, LanguageId, CompletionItemInsertTextRule, CompletionContext, CompletionTriggerKind, CompletionItemLabel } from 'vs/editor/common/modes';
import { IModeService } from 'vs/editor/common/services/modeService';
import { SnippetParser } from 'vs/editor/contrib/snippet/snippetParser';
import { localize } from 'vs/nls';
import { ISnippetsService } from 'vs/workbench/contrib/snippets/browser/snippets.contribution';
import { Snippet, SnippetSource } from 'vs/workbench/contrib/snippets/browser/snippetsFile';
import { isPatternInWord } from 'vs/base/common/filters';
import { StopWatch } from 'vs/base/common/stopwatch';
import { LanguageConfigurationRegistry } from 'vs/editor/common/modes/languageConfigurationRegistry';

export class SnippetCompletion implements CompletionItem {

	label: CompletionItemLabel;
	detail: string;
	insertText: string;
	documentation?: MarkdownString;
	range: IRange | { insert: IRange, replace: IRange };
	sortText: string;
	kind: CompletionItemKind;
	insertTextRules: CompletionItemInsertTextRule;

	constructor(
		readonly snippet: Snippet,
		range: IRange | { insert: IRange, replace: IRange }
	) {
		this.label = { label: snippet.prefix, description: snippet.name };
		this.detail = localize('detail.snippet', "{0} ({1})", snippet.description || snippet.name, snippet.source);
		this.insertText = snippet.codeSnippet;
		this.range = range;
		this.sortText = `${snippet.snippetSource === SnippetSource.Extension ? 'z' : 'a'}-${snippet.prefix}`;
		this.kind = CompletionItemKind.Snippet;
		this.insertTextRules = CompletionItemInsertTextRule.InsertAsSnippet;
	}

	resolve(): this {
		this.documentation = new MarkdownString().appendCodeblock('', new SnippetParser().text(this.snippet.codeSnippet));
		return this;
	}

	static compareByLabel(a: SnippetCompletion, b: SnippetCompletion): number {
		return compare(a.label.label, b.label.label);
	}
}

export class SnippetCompletionProvider implements CompletionItemProvider {

	readonly _debugDisplayName = 'snippetCompletions';

	constructor(
		@IModeService private readonly _modeService: IModeService,
		@ISnippetsService private readonly _snippets: ISnippetsService
	) {
		//
	}

	async provideCompletionItems(model: ITextModel, position: Position, context: CompletionContext): Promise<CompletionList> {

		if (context.triggerKind === CompletionTriggerKind.TriggerCharacter && context.triggerCharacter?.match(/\s/)) {
			// no snippets when suggestions have been triggered by space
			return { suggestions: [] };
		}

		const sw = new StopWatch(true);
		const languageId = this._getLanguageIdAtPosition(model, position);
		const snippets = await this._snippets.getSnippets(languageId);

		let pos = { lineNumber: position.lineNumber, column: 1 };
		let lineOffsets: number[] = [];
		const lineContent = model.getLineContent(position.lineNumber).toLowerCase();
		const endsInWhitespace = /\s/.test(lineContent[position.column - 2]);

		while (pos.column < position.column) {
			let word = model.getWordAtPosition(pos);
			if (word) {
				// at a word
				lineOffsets.push(word.startColumn - 1);
				pos.column = word.endColumn + 1;
				if (word.endColumn < position.column && !/\s/.test(lineContent[word.endColumn - 1])) {
					lineOffsets.push(word.endColumn - 1);
				}
			}
			else if (!/\s/.test(lineContent[pos.column - 1])) {
				// at a none-whitespace character
				lineOffsets.push(pos.column - 1);
				pos.column += 1;
			}
			else {
				// always advance!
				pos.column += 1;
			}
		}

		const availableSnippets = new Set<Snippet>(snippets);
		const suggestions: SnippetCompletion[] = [];

		const columnOffset = position.column - 1;

		for (const start of lineOffsets) {
			availableSnippets.forEach(snippet => {
				if (isPatternInWord(lineContent, start, columnOffset, snippet.prefixLow, 0, snippet.prefixLow.length)) {
					const prefixPos = position.column - (1 + start);
					const prefixRestLen = snippet.prefixLow.length - prefixPos;
					const endsWithPrefixRest = compareSubstring(lineContent, snippet.prefixLow, columnOffset, (columnOffset) + prefixRestLen, prefixPos, prefixPos + prefixRestLen);
					const startPosition = position.delta(0, -prefixPos);
					let endColumn = endsWithPrefixRest === 0 ? position.column + prefixRestLen : position.column;

					// First check if there is anything to the right of the cursor
					if (columnOffset < lineContent.length) {
						const autoClosingPairs = LanguageConfigurationRegistry.getAutoClosingPairs(languageId);
						const standardAutoClosingPairConditionals = autoClosingPairs.autoClosingPairsCloseSingleChar.get(lineContent[columnOffset]);
						// If the character to the right of the cursor is a closing character of an autoclosing pair
						if (standardAutoClosingPairConditionals?.some(p =>
							// and the start position is the opening character of an autoclosing pair
							p.open === lineContent[startPosition.column - 1] &&
							// and the snippet prefix contains the opening and closing pair at its edges
							snippet.prefix.startsWith(p.open) &&
							snippet.prefix[snippet.prefix.length - 1] === p.close)) {

							// Eat the character that was likely inserted because of auto-closing pairs
							endColumn++;
						}
					}

					const replace = Range.fromPositions(startPosition, { lineNumber: position.lineNumber, column: endColumn });
					const insert = replace.setEndPosition(position.lineNumber, position.column);

					suggestions.push(new SnippetCompletion(snippet, { replace, insert }));
					availableSnippets.delete(snippet);
				}
			});
		}
		if (endsInWhitespace || lineOffsets.length === 0) {
			// add remaing snippets when the current prefix ends in whitespace or when no
			// interesting positions have been found
			availableSnippets.forEach(snippet => {
				const insert = Range.fromPositions(position);
				const replace = lineContent.indexOf(snippet.prefixLow, columnOffset) === columnOffset ? insert.setEndPosition(position.lineNumber, position.column + snippet.prefixLow.length) : insert;
				suggestions.push(new SnippetCompletion(snippet, { replace, insert }));
			});
		}


		// dismbiguate suggestions with same labels
		suggestions.sort(SnippetCompletion.compareByLabel);
		for (let i = 0; i < suggestions.length; i++) {
			let item = suggestions[i];
			let to = i + 1;
			for (; to < suggestions.length && item.label === suggestions[to].label; to++) {
				suggestions[to].label.label = localize('snippetSuggest.longLabel', "{0}, {1}", suggestions[to].label.label, suggestions[to].snippet.name);
			}
			if (to > i + 1) {
				suggestions[i].label.label = localize('snippetSuggest.longLabel', "{0}, {1}", suggestions[i].label.label, suggestions[i].snippet.name);
				i = to;
			}
		}

		return {
			suggestions,
			duration: sw.elapsed()
		};
	}

	resolveCompletionItem(item: CompletionItem): CompletionItem {
		return (item instanceof SnippetCompletion) ? item.resolve() : item;
	}

	private _getLanguageIdAtPosition(model: ITextModel, position: Position): LanguageId {
		// validate the `languageId` to ensure this is a user
		// facing language with a name and the chance to have
		// snippets, else fall back to the outer language
		model.tokenizeIfCheap(position.lineNumber);
		let languageId = model.getLanguageIdAtPosition(position.lineNumber, position.column);
		const languageIdentifier = this._modeService.getLanguageIdentifier(languageId);
		if (languageIdentifier && !this._modeService.getLanguageName(languageIdentifier.language)) {
			languageId = model.getLanguageIdentifier().id;
		}
		return languageId;
	}
}
