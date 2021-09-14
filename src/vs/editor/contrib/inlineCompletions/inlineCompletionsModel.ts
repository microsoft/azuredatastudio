/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancelablePromise, createCancelablePromise, RunOnceScheduler } from 'vs/base/common/async';
import { CancellationToken } from 'vs/base/common/cancellation';
import { onUnexpectedError, onUnexpectedExternalError } from 'vs/base/common/errors';
import { Emitter } from 'vs/base/common/event';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import * as strings from 'vs/base/common/strings';
import { IActiveCodeEditor } from 'vs/editor/browser/editorBrowser';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { ITextModel } from 'vs/editor/common/model';
import { InlineCompletion, InlineCompletionContext, InlineCompletions, InlineCompletionsProvider, InlineCompletionsProviderRegistry, InlineCompletionTriggerKind } from 'vs/editor/common/modes';
import { BaseGhostTextWidgetModel, GhostText, GhostTextWidgetModel } from 'vs/editor/contrib/inlineCompletions/ghostTextWidget';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { MutableDisposable } from 'vs/editor/contrib/inlineCompletions/utils';
import { RedoCommand, UndoCommand } from 'vs/editor/browser/editorExtensions';
import { CoreEditingCommands } from 'vs/editor/browser/controller/coreCommands';

export class InlineCompletionsModel extends Disposable implements GhostTextWidgetModel {
	protected readonly onDidChangeEmitter = new Emitter<void>();
	public readonly onDidChange = this.onDidChangeEmitter.event;

	private readonly completionSession = this._register(new MutableDisposable<InlineCompletionsSession>());

	private active: boolean = false;

	constructor(
		private readonly editor: IActiveCodeEditor,
		private readonly commandService: ICommandService
	) {
		super();

		this._register(commandService.onDidExecuteCommand(e => {
			// These commands don't trigger onDidType.
			const commands = new Set([
				UndoCommand.id,
				RedoCommand.id,
				CoreEditingCommands.Tab.id,
				CoreEditingCommands.DeleteLeft.id,
				CoreEditingCommands.DeleteRight.id
			]);
			if (commands.has(e.commandId) && editor.hasTextFocus()) {
				this.handleUserInput();
			}
		}));

		this._register(this.editor.onDidType((e) => {
			this.handleUserInput();
		}));

		this._register(this.editor.onDidChangeCursorPosition((e) => {
			if (this.session && !this.session.isValid) {
				this.hide();
			}
		}));
	}

	private handleUserInput() {
		if (this.session && !this.session.isValid) {
			this.hide();
		}
		setTimeout(() => {
			// Wait for the cursor update that happens in the same iteration loop iteration
			this.startSessionIfTriggered();
		}, 0);
	}

	private get session(): InlineCompletionsSession | undefined {
		return this.completionSession.value;
	}

	public get ghostText(): GhostText | undefined {
		return this.session?.ghostText;
	}

	public get minReservedLineCount(): number {
		return this.session ? this.session.minReservedLineCount : 0;
	}

	public get expanded(): boolean {
		return this.session ? this.session.expanded : false;
	}

	public setExpanded(expanded: boolean): void {
		this.session?.setExpanded(expanded);
	}

	public setActive(active: boolean) {
		this.active = active;
		if (active) {
			this.session?.scheduleAutomaticUpdate();
		}
	}

	private startSessionIfTriggered(): void {
		const suggestOptions = this.editor.getOption(EditorOption.inlineSuggest);
		if (!suggestOptions.enabled) {
			return;
		}

		if (this.session && this.session.isValid) {
			return;
		}

		this.startSession();
	}

	public startSession(): void {
		if (this.completionSession.value) {
			return;
		}
		this.completionSession.value = new InlineCompletionsSession(this.editor, this.editor.getPosition(), () => this.active, this.commandService);
		this.completionSession.value.takeOwnership(
			this.completionSession.value.onDidChange(() => {
				this.onDidChangeEmitter.fire();
			})
		);
	}

	public hide(): void {
		this.completionSession.clear();
		this.onDidChangeEmitter.fire();
	}

	public commitCurrentSuggestion(): void {
		// Don't dispose the session, so that after committing, more suggestions are shown.
		this.session?.commitCurrentCompletion();
	}

	public showNext(): void {
		this.session?.showNextInlineCompletion();
	}

	public showPrevious(): void {
		this.session?.showPreviousInlineCompletion();
	}
}

class InlineCompletionsSession extends BaseGhostTextWidgetModel {
	public readonly minReservedLineCount = 0;

	private readonly updateOperation = this._register(new MutableDisposable<UpdateOperation>());
	private readonly cache = this._register(new MutableDisposable<SynchronizedInlineCompletionsCache>());

	private updateSoon = this._register(new RunOnceScheduler(() => this.update(InlineCompletionTriggerKind.Automatic), 50));
	private readonly textModel = this.editor.getModel();

	constructor(
		editor: IActiveCodeEditor,
		private readonly triggerPosition: Position,
		private readonly shouldUpdate: () => boolean,
		private readonly commandService: ICommandService,
	) {
		super(editor);

		let lastCompletionItem: InlineCompletion | undefined = undefined;
		this._register(this.onDidChange(() => {
			const currentCompletion = this.currentCompletion;
			if (currentCompletion && currentCompletion.sourceInlineCompletion !== lastCompletionItem) {
				lastCompletionItem = currentCompletion.sourceInlineCompletion;

				const provider = currentCompletion.sourceProvider;
				if (provider.handleItemDidShow) {
					provider.handleItemDidShow(currentCompletion.sourceInlineCompletions, lastCompletionItem);
				}
			}
		}));

		this._register(this.editor.onDidChangeModelContent((e) => {
			if (this.cache.value) {
				let hasChanged = false;
				for (const c of this.cache.value.completions) {
					const newRange = this.textModel.getDecorationRange(c.decorationId);
					if (!newRange) {
						onUnexpectedError(new Error('Decoration has no range'));
						continue;
					}
					if (!c.synchronizedRange.equalsRange(newRange)) {
						hasChanged = true;
						c.synchronizedRange = newRange;
					}
				}
				if (hasChanged) {
					this.onDidChangeEmitter.fire();
				}
			}

			this.scheduleAutomaticUpdate();
		}));

		this.scheduleAutomaticUpdate();
	}

	//#region Selection

	// We use a semantic id to track the selection even if the cache changes.
	private currentlySelectedCompletionId: string | undefined = undefined;

	private fixAndGetIndexOfCurrentSelection(): number {
		if (!this.currentlySelectedCompletionId || !this.cache.value) {
			return 0;
		}
		if (this.cache.value.completions.length === 0) {
			// don't reset the selection in this case
			return 0;
		}

		const idx = this.cache.value.completions.findIndex(v => v.semanticId === this.currentlySelectedCompletionId);
		if (idx === -1) {
			// Reset the selection so that the selection does not jump back when it appears again
			this.currentlySelectedCompletionId = undefined;
			return 0;
		}
		return idx;
	}

	private get currentCachedCompletion(): CachedInlineCompletion | undefined {
		if (!this.cache.value) {
			return undefined;
		}
		return this.cache.value.completions[this.fixAndGetIndexOfCurrentSelection()];
	}

	public async showNextInlineCompletion(): Promise<void> {
		await this.ensureUpdateWithExplicitContext();

		const completions = this.cache.value?.completions || [];
		if (completions.length > 0) {
			const newIdx = (this.fixAndGetIndexOfCurrentSelection() + 1) % completions.length;
			this.currentlySelectedCompletionId = completions[newIdx].semanticId;
		} else {
			this.currentlySelectedCompletionId = undefined;
		}
		this.onDidChangeEmitter.fire();
	}

	public async showPreviousInlineCompletion(): Promise<void> {
		await this.ensureUpdateWithExplicitContext();

		const completions = this.cache.value?.completions || [];
		if (completions.length > 0) {
			const newIdx = (this.fixAndGetIndexOfCurrentSelection() + completions.length - 1) % completions.length;
			this.currentlySelectedCompletionId = completions[newIdx].semanticId;
		} else {
			this.currentlySelectedCompletionId = undefined;
		}
		this.onDidChangeEmitter.fire();
	}

	private async ensureUpdateWithExplicitContext(): Promise<void> {
		if (this.updateOperation.value) {
			// Restart or wait for current update operation
			if (this.updateOperation.value.triggerKind === InlineCompletionTriggerKind.Explicit) {
				await this.updateOperation.value.promise;
			} else {
				await this.update(InlineCompletionTriggerKind.Explicit);
			}
		} else if (this.cache.value?.triggerKind !== InlineCompletionTriggerKind.Explicit) {
			// Refresh cache
			await this.update(InlineCompletionTriggerKind.Explicit);
		}
	}

	//#endregion

	public get ghostText(): GhostText | undefined {
		const currentCompletion = this.currentCompletion;
		return currentCompletion ? inlineCompletionToGhostText(currentCompletion, this.editor.getModel()) : undefined;
	}

	get currentCompletion(): LiveInlineCompletion | undefined {
		const completion = this.currentCachedCompletion;
		if (!completion) {
			return undefined;
		}
		return {
			text: completion.inlineCompletion.text,
			range: completion.synchronizedRange,
			command: completion.inlineCompletion.command,
			sourceProvider: completion.inlineCompletion.sourceProvider,
			sourceInlineCompletions: completion.inlineCompletion.sourceInlineCompletions,
			sourceInlineCompletion: completion.inlineCompletion.sourceInlineCompletion,
		};
	}

	get isValid(): boolean {
		return this.editor.getPosition().lineNumber === this.triggerPosition.lineNumber;
	}

	public scheduleAutomaticUpdate(): void {
		// Since updateSoon debounces, starvation can happen.
		// To prevent stale cache, we clear the current update operation.
		this.updateOperation.clear();
		this.updateSoon.schedule();
	}

	private async update(triggerKind: InlineCompletionTriggerKind): Promise<void> {
		if (!this.shouldUpdate()) {
			return;
		}

		const position = this.editor.getPosition();

		const promise = createCancelablePromise(async token => {
			let result;
			try {
				result = await provideInlineCompletions(position,
					this.editor.getModel(),
					{ triggerKind },
					token
				);
			} catch (e) {
				onUnexpectedError(e);
				return;
			}

			if (token.isCancellationRequested) {
				return;
			}

			this.cache.value = new SynchronizedInlineCompletionsCache(
				this.editor,
				result,
				() => this.onDidChangeEmitter.fire(),
				triggerKind
			);
			this.onDidChangeEmitter.fire();
		});
		const operation = new UpdateOperation(promise, triggerKind);
		this.updateOperation.value = operation;
		await promise;
		if (this.updateOperation.value === operation) {
			this.updateOperation.clear();
		}
	}

	public takeOwnership(disposable: IDisposable): void {
		this._register(disposable);
	}

	public commitCurrentCompletion(): void {
		const completion = this.currentCompletion;
		if (completion) {
			this.commit(completion);
		}
	}

	public commit(completion: LiveInlineCompletion): void {
		// Mark the cache as stale, but don't dispose it yet,
		// otherwise command args might get disposed.
		const cache = this.cache.replace(undefined);

		this.editor.executeEdits(
			'inlineSuggestion.accept',
			[
				EditOperation.replaceMove(completion.range, completion.text)
			]
		);
		if (completion.command) {
			this.commandService
				.executeCommand(completion.command.id, ...(completion.command.arguments || []))
				.finally(() => {
					cache?.dispose();
				})
				.then(undefined, onUnexpectedExternalError);
		} else {
			cache?.dispose();
		}

		this.onDidChangeEmitter.fire();
	}
}

class UpdateOperation implements IDisposable {
	constructor(public readonly promise: CancelablePromise<void>, public readonly triggerKind: InlineCompletionTriggerKind) {
	}

	dispose() {
		this.promise.cancel();
	}
}

/**
 * The cache keeps itself in sync with the editor.
 * It also owns the completions result and disposes it when the cache is diposed.
*/
class SynchronizedInlineCompletionsCache extends Disposable {
	public readonly completions: readonly CachedInlineCompletion[];

	constructor(
		editor: IActiveCodeEditor,
		completionsSource: LiveInlineCompletions,
		onChange: () => void,
		public readonly triggerKind: InlineCompletionTriggerKind,
	) {
		super();

		const decorationIds = editor.deltaDecorations(
			[],
			completionsSource.items.map(i => ({
				range: i.range,
				options: {
					description: 'inline-completion-tracking-range'
				},
			}))
		);
		this._register(toDisposable(() => {
			editor.deltaDecorations(decorationIds, []);
		}));

		this.completions = completionsSource.items.map((c, idx) => new CachedInlineCompletion(c, decorationIds[idx]));

		this._register(editor.onDidChangeModelContent(() => {
			let hasChanged = false;
			const model = editor.getModel();
			for (const c of this.completions) {
				const newRange = model.getDecorationRange(c.decorationId);
				if (!newRange) {
					onUnexpectedError(new Error('Decoration has no range'));
					continue;
				}
				if (!c.synchronizedRange.equalsRange(newRange)) {
					hasChanged = true;
					c.synchronizedRange = newRange;
				}
			}
			if (hasChanged) {
				onChange();
			}
		}));

		this._register(completionsSource);
	}
}

class CachedInlineCompletion {
	public readonly semanticId: string = JSON.stringify({
		text: this.inlineCompletion.text,
		startLine: this.inlineCompletion.range.startLineNumber,
		startColumn: this.inlineCompletion.range.startColumn,
		command: this.inlineCompletion.command
	});
	/**
	 * The range, synchronized with text model changes.
	*/
	public synchronizedRange: Range;

	constructor(
		public readonly inlineCompletion: LiveInlineCompletion,
		public readonly decorationId: string,
	) {
		this.synchronizedRange = inlineCompletion.range;
	}
}

export interface NormalizedInlineCompletion extends InlineCompletion {
	range: Range;
}

function leftTrim(str: string): string {
	return str.replace(/^\s+/, '');
}

export function inlineCompletionToGhostText(inlineCompletion: NormalizedInlineCompletion, textModel: ITextModel): GhostText | undefined {
	// This is a single line string
	const valueToBeReplaced = textModel.getValueInRange(inlineCompletion.range);

	let remainingInsertText: string;

	// Consider these cases
	// valueToBeReplaced -> inlineCompletion.text
	// "\t\tfoo" -> "\t\tfoobar" (+"bar")
	// "\t" -> "\t\tfoobar" (+"\tfoobar")
	// "\t\tfoo" -> "\t\t\tfoobar" (+"\t", +"bar")
	// "\t\tfoo" -> "\tfoobar" (-"\t", +"\bar")

	const firstNonWsCol = textModel.getLineFirstNonWhitespaceColumn(inlineCompletion.range.startLineNumber);

	if (inlineCompletion.text.startsWith(valueToBeReplaced)) {
		remainingInsertText = inlineCompletion.text.substr(valueToBeReplaced.length);
	} else if (firstNonWsCol === 0 || inlineCompletion.range.startColumn < firstNonWsCol) {
		// Only allow ignoring leading whitespace in indentation.
		const valueToBeReplacedTrimmed = leftTrim(valueToBeReplaced);
		const insertTextTrimmed = leftTrim(inlineCompletion.text);
		if (!insertTextTrimmed.startsWith(valueToBeReplacedTrimmed)) {
			return undefined;
		}
		remainingInsertText = insertTextTrimmed.substr(valueToBeReplacedTrimmed.length);
	} else {
		return undefined;
	}

	const position = inlineCompletion.range.getEndPosition();

	const lines = strings.splitLines(remainingInsertText);

	if (lines.length > 1 && textModel.getLineMaxColumn(position.lineNumber) !== position.column) {
		// Such ghost text is not supported.
		return undefined;
	}

	return {
		lines,
		position
	};
}

export interface LiveInlineCompletion extends NormalizedInlineCompletion {
	sourceProvider: InlineCompletionsProvider;
	sourceInlineCompletion: InlineCompletion;
	sourceInlineCompletions: InlineCompletions;
}

/**
 * Contains no duplicated items.
*/
export interface LiveInlineCompletions extends InlineCompletions<LiveInlineCompletion> {
	dispose(): void;
}

function getDefaultRange(position: Position, model: ITextModel): Range {
	const word = model.getWordAtPosition(position);
	const maxColumn = model.getLineMaxColumn(position.lineNumber);
	// By default, always replace up until the end of the current line.
	// This default might be subject to change!
	return word
		? new Range(position.lineNumber, word.startColumn, position.lineNumber, maxColumn)
		: Range.fromPositions(position, position.with(undefined, maxColumn));
}

async function provideInlineCompletions(
	position: Position,
	model: ITextModel,
	context: InlineCompletionContext,
	token: CancellationToken = CancellationToken.None
): Promise<LiveInlineCompletions> {
	const defaultReplaceRange = getDefaultRange(position, model);

	const providers = InlineCompletionsProviderRegistry.all(model);
	const results = await Promise.all(
		providers.map(
			async provider => {
				const completions = await provider.provideInlineCompletions(model, position, context, token);
				return ({
					completions,
					provider,
					dispose: () => {
						if (completions) {
							provider.freeInlineCompletions(completions);
						}
					}
				});
			}
		)
	);

	const itemsByHash = new Map<string, LiveInlineCompletion>();
	for (const result of results) {
		const completions = result.completions;
		if (completions) {
			for (const item of completions.items.map<LiveInlineCompletion>(item => ({
				text: item.text,
				range: item.range ? Range.lift(item.range) : defaultReplaceRange,
				command: item.command,
				sourceProvider: result.provider,
				sourceInlineCompletions: completions,
				sourceInlineCompletion: item
			}))) {
				if (item.range.startLineNumber !== item.range.endLineNumber) {
					// Ignore invalid ranges.
					continue;
				}
				itemsByHash.set(JSON.stringify({ text: item.text, range: item.range }), item);
			}
		}
	}

	return {
		items: [...itemsByHash.values()],
		dispose: () => {
			for (const result of results) {
				result.dispose();
			}
		},
	};
}
