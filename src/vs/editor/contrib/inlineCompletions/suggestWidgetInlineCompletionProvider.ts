/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from 'vs/base/common/async';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';
import { IActiveCodeEditor } from 'vs/editor/browser/editorBrowser';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { CompletionItemInsertTextRule } from 'vs/editor/common/modes';
import { SnippetParser } from 'vs/editor/contrib/snippet/snippetParser';
import { SnippetSession } from 'vs/editor/contrib/snippet/snippetSession';
import { CompletionItem } from 'vs/editor/contrib/suggest/suggest';
import { SuggestController } from 'vs/editor/contrib/suggest/suggestController';
import { minimizeInlineCompletion } from './inlineCompletionsModel';
import { NormalizedInlineCompletion, normalizedInlineCompletionsEquals } from './inlineCompletionToGhostText';
import { compareBy, compareByNumber, findMaxBy } from './utils';

export interface SuggestWidgetState {
	/**
	 * Represents the currently selected item in the suggest widget as inline completion, if possible.
	*/
	selectedItemAsInlineCompletion: NormalizedInlineCompletion | undefined;
}

export class SuggestWidgetInlineCompletionProvider extends Disposable {
	private isSuggestWidgetVisible: boolean = false;
	private isShiftKeyPressed = false;
	private _isActive = false;
	private _currentInlineCompletion: NormalizedInlineCompletion | undefined = undefined;
	private readonly onDidChangeEmitter = new Emitter<void>();

	public readonly onDidChange = this.onDidChangeEmitter.event;

	// This delay fixes a suggest widget issue when typing "." immediately restarts the suggestion session.
	private readonly setInactiveDelayed = this._register(new RunOnceScheduler(() => {
		if (!this.isSuggestWidgetVisible) {
			if (this._isActive) {
				this._isActive = false;
				this.onDidChangeEmitter.fire();
			}
		}
	}, 100));

	/**
	 * Returns undefined if the suggest widget is not active.
	*/
	get state(): SuggestWidgetState | undefined {
		if (!this._isActive) {
			return undefined;
		}
		return { selectedItemAsInlineCompletion: this._currentInlineCompletion };
	}

	constructor(
		private readonly editor: IActiveCodeEditor,
		private readonly suggestControllerPreselector: () => NormalizedInlineCompletion | undefined
	) {
		super();

		// See the command acceptAlternativeSelectedSuggestion that is bound to shift+tab
		this._register(editor.onKeyDown(e => {
			if (e.shiftKey && !this.isShiftKeyPressed) {
				this.isShiftKeyPressed = true;
				this.update(this._isActive);
			}
		}));
		this._register(editor.onKeyUp(e => {
			if (e.shiftKey && this.isShiftKeyPressed) {
				this.isShiftKeyPressed = false;
				this.update(this._isActive);
			}
		}));

		const suggestController = SuggestController.get(this.editor);
		if (suggestController) {
			this._register(suggestController.registerSelector({
				priority: 100,
				select: (model, pos, suggestItems) => {
					const textModel = this.editor.getModel();
					const normalizedItemToPreselect = minimizeInlineCompletion(textModel, this.suggestControllerPreselector());
					if (!normalizedItemToPreselect) {
						return -1;
					}
					const position = Position.lift(pos);

					const candidates = suggestItems
						.map((suggestItem, index) => {
							const inlineSuggestItem = suggestionToInlineCompletion(suggestController, position, suggestItem, this.isShiftKeyPressed);
							const normalizedSuggestItem = minimizeInlineCompletion(textModel, inlineSuggestItem);
							if (!normalizedSuggestItem) {
								return undefined;
							}
							const valid =
								rangeStartsWith(normalizedItemToPreselect.range, normalizedSuggestItem.range) &&
								normalizedItemToPreselect.text.startsWith(normalizedSuggestItem.text);
							return { index, valid, prefixLength: normalizedSuggestItem.text.length, suggestItem };
						})
						.filter(item => item && item.valid);

					const result = findMaxBy(
						candidates,
						compareBy(s => s!.prefixLength, compareByNumber())
					);
					return result ? result.index : - 1;
				}
			}));

			let isBoundToSuggestWidget = false;
			const bindToSuggestWidget = () => {
				if (isBoundToSuggestWidget) {
					return;
				}
				isBoundToSuggestWidget = true;

				this._register(suggestController.widget.value.onDidShow(() => {
					this.isSuggestWidgetVisible = true;
					this.update(true);
				}));
				this._register(suggestController.widget.value.onDidHide(() => {
					this.isSuggestWidgetVisible = false;
					this.setInactiveDelayed.schedule();
					this.update(this._isActive);
				}));
				this._register(suggestController.widget.value.onDidFocus(() => {
					this.isSuggestWidgetVisible = true;
					this.update(true);
				}));
			};

			this._register(Event.once(suggestController.model.onDidTrigger)(e => {
				bindToSuggestWidget();
			}));
		}
		this.update(this._isActive);
	}

	private update(newActive: boolean): void {
		const newInlineCompletion = this.getInlineCompletion();
		let shouldFire = false;
		if (!normalizedInlineCompletionsEquals(this._currentInlineCompletion, newInlineCompletion)) {
			this._currentInlineCompletion = newInlineCompletion;
			shouldFire = true;
		}
		if (this._isActive !== newActive) {
			this._isActive = newActive;
			shouldFire = true;
		}
		if (shouldFire) {
			this.onDidChangeEmitter.fire();
		}
	}

	private getInlineCompletion(): NormalizedInlineCompletion | undefined {
		const suggestController = SuggestController.get(this.editor);
		if (!suggestController) {
			return undefined;
		}
		if (!this.isSuggestWidgetVisible) {
			return undefined;
		}
		const focusedItem = suggestController.widget.value.getFocusedItem();
		if (!focusedItem) {
			return undefined;
		}

		// TODO: item.isResolved
		return suggestionToInlineCompletion(
			suggestController,
			this.editor.getPosition(),
			focusedItem.item,
			this.isShiftKeyPressed
		);
	}

	public stopForceRenderingAbove(): void {
		const suggestController = SuggestController.get(this.editor);
		if (suggestController) {
			suggestController.stopForceRenderingAbove();
		}
	}

	public forceRenderingAbove(): void {
		const suggestController = SuggestController.get(this.editor);
		if (suggestController) {
			suggestController.forceRenderingAbove();
		}
	}
}

function rangeStartsWith(rangeToTest: Range, prefix: Range): boolean {
	return (
		rangeToTest.startLineNumber === prefix.startLineNumber &&
		rangeToTest.startColumn === prefix.startColumn &&
		(rangeToTest.endLineNumber < prefix.endLineNumber ||
			(rangeToTest.endLineNumber === prefix.endLineNumber &&
				rangeToTest.endColumn <= prefix.endColumn))
	);
}

function suggestionToInlineCompletion(suggestController: SuggestController, position: Position, item: CompletionItem, toggleMode: boolean): NormalizedInlineCompletion | undefined {
	// additionalTextEdits might not be resolved here, this could be problematic.
	if (Array.isArray(item.completion.additionalTextEdits) && item.completion.additionalTextEdits.length > 0) {
		// cannot represent additional text edits
		return {
			text: '',
			range: Range.fromPositions(position, position),
		};
	}

	let { insertText } = item.completion;
	if (item.completion.insertTextRules! & CompletionItemInsertTextRule.InsertAsSnippet) {
		const snippet = new SnippetParser().parse(insertText);
		const model = suggestController.editor.getModel()!;

		// Ignore snippets that are too large.
		// Adjust whitespace is expensive for them.
		if (snippet.children.length > 100) {
			return undefined;
		}

		SnippetSession.adjustWhitespace(model, position, snippet, true, true);
		insertText = snippet.toString();
	}

	const info = suggestController.getOverwriteInfo(item, toggleMode);
	return {
		text: insertText,
		range: Range.fromPositions(
			position.delta(0, -info.overwriteBefore),
			position.delta(0, Math.max(info.overwriteAfter, 0))
		),
	};
}
