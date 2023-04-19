/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeferredPromise } from 'vs/base/common/async';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { Codicon } from 'vs/base/common/codicons';
import { IMatch } from 'vs/base/common/filters';
import { IPreparedQuery, pieceToQuery, prepareQuery, scoreFuzzy2 } from 'vs/base/common/fuzzyScorer';
import { Disposable, DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { format, trim } from 'vs/base/common/strings';
import { IRange, Range } from 'vs/editor/common/core/range';
import { ScrollType } from 'vs/editor/common/editorCommon';
import { ITextModel } from 'vs/editor/common/model';
import { DocumentSymbol, SymbolKind, SymbolKinds, SymbolTag } from 'vs/editor/common/languages';
import { IOutlineModelService } from 'vs/editor/contrib/documentSymbols/browser/outlineModel';
import { AbstractEditorNavigationQuickAccessProvider, IEditorNavigationQuickAccessOptions, IQuickAccessTextEditorContext } from 'vs/editor/contrib/quickAccess/browser/editorNavigationQuickAccess';
import { localize } from 'vs/nls';
import { IQuickPick, IQuickPickItem, IQuickPickSeparator } from 'vs/platform/quickinput/common/quickInput';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';

export interface IGotoSymbolQuickPickItem extends IQuickPickItem {
	kind: SymbolKind;
	index: number;
	score?: number;
	range?: { decoration: IRange; selection: IRange };
}

export interface IGotoSymbolQuickAccessProviderOptions extends IEditorNavigationQuickAccessOptions {
	openSideBySideDirection?: () => undefined | 'right' | 'down';
}

export abstract class AbstractGotoSymbolQuickAccessProvider extends AbstractEditorNavigationQuickAccessProvider {

	static PREFIX = '@';
	static SCOPE_PREFIX = ':';
	static PREFIX_BY_CATEGORY = `${AbstractGotoSymbolQuickAccessProvider.PREFIX}${AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX}`;

	protected override readonly options: IGotoSymbolQuickAccessProviderOptions;

	constructor(
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IOutlineModelService private readonly _outlineModelService: IOutlineModelService,
		options: IGotoSymbolQuickAccessProviderOptions = Object.create(null)
	) {
		super(options);

		this.options = options;
		this.options.canAcceptInBackground = true;
	}

	protected provideWithoutTextEditor(picker: IQuickPick<IGotoSymbolQuickPickItem>): IDisposable {
		this.provideLabelPick(picker, localize('cannotRunGotoSymbolWithoutEditor', "To go to a symbol, first open a text editor with symbol information."));

		return Disposable.None;
	}

	protected provideWithTextEditor(context: IQuickAccessTextEditorContext, picker: IQuickPick<IGotoSymbolQuickPickItem>, token: CancellationToken): IDisposable {
		const editor = context.editor;
		const model = this.getModel(editor);
		if (!model) {
			return Disposable.None;
		}

		// Provide symbols from model if available in registry
		if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
			return this.doProvideWithEditorSymbols(context, model, picker, token);
		}

		// Otherwise show an entry for a model without registry
		// But give a chance to resolve the symbols at a later
		// point if possible
		return this.doProvideWithoutEditorSymbols(context, model, picker, token);
	}

	private doProvideWithoutEditorSymbols(context: IQuickAccessTextEditorContext, model: ITextModel, picker: IQuickPick<IGotoSymbolQuickPickItem>, token: CancellationToken): IDisposable {
		const disposables = new DisposableStore();

		// Generic pick for not having any symbol information
		this.provideLabelPick(picker, localize('cannotRunGotoSymbolWithoutSymbolProvider', "The active text editor does not provide symbol information."));

		// Wait for changes to the registry and see if eventually
		// we do get symbols. This can happen if the picker is opened
		// very early after the model has loaded but before the
		// language registry is ready.
		// https://github.com/microsoft/vscode/issues/70607
		(async () => {
			const result = await this.waitForLanguageSymbolRegistry(model, disposables);
			if (!result || token.isCancellationRequested) {
				return;
			}

			disposables.add(this.doProvideWithEditorSymbols(context, model, picker, token));
		})();

		return disposables;
	}

	private provideLabelPick(picker: IQuickPick<IGotoSymbolQuickPickItem>, label: string): void {
		picker.items = [{ label, index: 0, kind: SymbolKind.String }];
		picker.ariaLabel = label;
	}

	protected async waitForLanguageSymbolRegistry(model: ITextModel, disposables: DisposableStore): Promise<boolean> {
		if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
			return true;
		}

		const symbolProviderRegistryPromise = new DeferredPromise<boolean>();

		// Resolve promise when registry knows model
		const symbolProviderListener = disposables.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => {
			if (this._languageFeaturesService.documentSymbolProvider.has(model)) {
				symbolProviderListener.dispose();

				symbolProviderRegistryPromise.complete(true);
			}
		}));

		// Resolve promise when we get disposed too
		disposables.add(toDisposable(() => symbolProviderRegistryPromise.complete(false)));

		return symbolProviderRegistryPromise.p;
	}

	private doProvideWithEditorSymbols(context: IQuickAccessTextEditorContext, model: ITextModel, picker: IQuickPick<IGotoSymbolQuickPickItem>, token: CancellationToken): IDisposable {
		const editor = context.editor;
		const disposables = new DisposableStore();

		// Goto symbol once picked
		disposables.add(picker.onDidAccept(event => {
			const [item] = picker.selectedItems;
			if (item && item.range) {
				this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, preserveFocus: event.inBackground });

				if (!event.inBackground) {
					picker.hide();
				}
			}
		}));

		// Goto symbol side by side if enabled
		disposables.add(picker.onDidTriggerItemButton(({ item }) => {
			if (item && item.range) {
				this.gotoLocation(context, { range: item.range.selection, keyMods: picker.keyMods, forceSideBySide: true });

				picker.hide();
			}
		}));

		// Resolve symbols from document once and reuse this
		// request for all filtering and typing then on
		const symbolsPromise = this.getDocumentSymbols(model, token);

		// Set initial picks and update on type
		let picksCts: CancellationTokenSource | undefined = undefined;
		const updatePickerItems = async () => {

			// Cancel any previous ask for picks and busy
			picksCts?.dispose(true);
			picker.busy = false;

			// Create new cancellation source for this run
			picksCts = new CancellationTokenSource(token);

			// Collect symbol picks
			picker.busy = true;
			try {
				const query = prepareQuery(picker.value.substr(AbstractGotoSymbolQuickAccessProvider.PREFIX.length).trim());
				const items = await this.doGetSymbolPicks(symbolsPromise, query, undefined, picksCts.token);
				if (token.isCancellationRequested) {
					return;
				}

				if (items.length > 0) {
					picker.items = items;
				} else {
					if (query.original.length > 0) {
						this.provideLabelPick(picker, localize('noMatchingSymbolResults', "No matching editor symbols"));
					} else {
						this.provideLabelPick(picker, localize('noSymbolResults', "No editor symbols"));
					}
				}
			} finally {
				if (!token.isCancellationRequested) {
					picker.busy = false;
				}
			}
		};
		disposables.add(picker.onDidChangeValue(() => updatePickerItems()));
		updatePickerItems();

		// Reveal and decorate when active item changes
		// However, ignore the very first event so that
		// opening the picker is not immediately revealing
		// and decorating the first entry.
		let ignoreFirstActiveEvent = true;
		disposables.add(picker.onDidChangeActive(() => {
			const [item] = picker.activeItems;
			if (item && item.range) {
				if (ignoreFirstActiveEvent) {
					ignoreFirstActiveEvent = false;
					return;
				}

				// Reveal
				editor.revealRangeInCenter(item.range.selection, ScrollType.Smooth);

				// Decorate
				this.addDecorations(editor, item.range.decoration);
			}
		}));

		return disposables;
	}

	protected async doGetSymbolPicks(symbolsPromise: Promise<DocumentSymbol[]>, query: IPreparedQuery, options: { extraContainerLabel?: string } | undefined, token: CancellationToken): Promise<Array<IGotoSymbolQuickPickItem | IQuickPickSeparator>> {
		const symbols = await symbolsPromise;
		if (token.isCancellationRequested) {
			return [];
		}

		const filterBySymbolKind = query.original.indexOf(AbstractGotoSymbolQuickAccessProvider.SCOPE_PREFIX) === 0;
		const filterPos = filterBySymbolKind ? 1 : 0;

		// Split between symbol and container query
		let symbolQuery: IPreparedQuery;
		let containerQuery: IPreparedQuery | undefined;
		if (query.values && query.values.length > 1) {
			symbolQuery = pieceToQuery(query.values[0]); 		  // symbol: only match on first part
			containerQuery = pieceToQuery(query.values.slice(1)); // container: match on all but first parts
		} else {
			symbolQuery = query;
		}

		// Convert to symbol picks and apply filtering
		const filteredSymbolPicks: IGotoSymbolQuickPickItem[] = [];
		for (let index = 0; index < symbols.length; index++) {
			const symbol = symbols[index];

			const symbolLabel = trim(symbol.name);
			const symbolLabelWithIcon = `$(${SymbolKinds.toIcon(symbol.kind).id}) ${symbolLabel}`;
			const symbolLabelIconOffset = symbolLabelWithIcon.length - symbolLabel.length;

			let containerLabel = symbol.containerName;
			if (options?.extraContainerLabel) {
				if (containerLabel) {
					containerLabel = `${options.extraContainerLabel} • ${containerLabel}`;
				} else {
					containerLabel = options.extraContainerLabel;
				}
			}

			let symbolScore: number | undefined = undefined;
			let symbolMatches: IMatch[] | undefined = undefined;

			let containerScore: number | undefined = undefined;
			let containerMatches: IMatch[] | undefined = undefined;

			if (query.original.length > filterPos) {

				// First: try to score on the entire query, it is possible that
				// the symbol matches perfectly (e.g. searching for "change log"
				// can be a match on a markdown symbol "change log"). In that
				// case we want to skip the container query altogether.
				let skipContainerQuery = false;
				if (symbolQuery !== query) {
					[symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, { ...query, values: undefined /* disable multi-query support */ }, filterPos, symbolLabelIconOffset);
					if (typeof symbolScore === 'number') {
						skipContainerQuery = true; // since we consumed the query, skip any container matching
					}
				}

				// Otherwise: score on the symbol query and match on the container later
				if (typeof symbolScore !== 'number') {
					[symbolScore, symbolMatches] = scoreFuzzy2(symbolLabelWithIcon, symbolQuery, filterPos, symbolLabelIconOffset);
					if (typeof symbolScore !== 'number') {
						continue;
					}
				}

				// Score by container if specified
				if (!skipContainerQuery && containerQuery) {
					if (containerLabel && containerQuery.original.length > 0) {
						[containerScore, containerMatches] = scoreFuzzy2(containerLabel, containerQuery);
					}

					if (typeof containerScore !== 'number') {
						continue;
					}

					if (typeof symbolScore === 'number') {
						symbolScore += containerScore; // boost symbolScore by containerScore
					}
				}
			}

			const deprecated = symbol.tags && symbol.tags.indexOf(SymbolTag.Deprecated) >= 0;

			filteredSymbolPicks.push({
				index,
				kind: symbol.kind,
				score: symbolScore,
				label: symbolLabelWithIcon,
				ariaLabel: symbolLabel,
				description: containerLabel,
				highlights: deprecated ? undefined : {
					label: symbolMatches,
					description: containerMatches
				},
				range: {
					selection: Range.collapseToStart(symbol.selectionRange),
					decoration: symbol.range
				},
				strikethrough: deprecated,
				buttons: (() => {
					const openSideBySideDirection = this.options?.openSideBySideDirection ? this.options?.openSideBySideDirection() : undefined;
					if (!openSideBySideDirection) {
						return undefined;
					}

					return [
						{
							iconClass: openSideBySideDirection === 'right' ? Codicon.splitHorizontal.classNames : Codicon.splitVertical.classNames,
							tooltip: openSideBySideDirection === 'right' ? localize('openToSide', "Open to the Side") : localize('openToBottom', "Open to the Bottom")
						}
					];
				})()
			});
		}

		// Sort by score
		const sortedFilteredSymbolPicks = filteredSymbolPicks.sort((symbolA, symbolB) => filterBySymbolKind ?
			this.compareByKindAndScore(symbolA, symbolB) :
			this.compareByScore(symbolA, symbolB)
		);

		// Add separator for types
		// - @  only total number of symbols
		// - @: grouped by symbol kind
		let symbolPicks: Array<IGotoSymbolQuickPickItem | IQuickPickSeparator> = [];
		if (filterBySymbolKind) {
			let lastSymbolKind: SymbolKind | undefined = undefined;
			let lastSeparator: IQuickPickSeparator | undefined = undefined;
			let lastSymbolKindCounter = 0;

			function updateLastSeparatorLabel(): void {
				if (lastSeparator && typeof lastSymbolKind === 'number' && lastSymbolKindCounter > 0) {
					lastSeparator.label = format(NLS_SYMBOL_KIND_CACHE[lastSymbolKind] || FALLBACK_NLS_SYMBOL_KIND, lastSymbolKindCounter);
				}
			}

			for (const symbolPick of sortedFilteredSymbolPicks) {

				// Found new kind
				if (lastSymbolKind !== symbolPick.kind) {

					// Update last separator with number of symbols we found for kind
					updateLastSeparatorLabel();

					lastSymbolKind = symbolPick.kind;
					lastSymbolKindCounter = 1;

					// Add new separator for new kind
					lastSeparator = { type: 'separator' };
					symbolPicks.push(lastSeparator);
				}

				// Existing kind, keep counting
				else {
					lastSymbolKindCounter++;
				}

				// Add to final result
				symbolPicks.push(symbolPick);
			}

			// Update last separator with number of symbols we found for kind
			updateLastSeparatorLabel();
		} else if (sortedFilteredSymbolPicks.length > 0) {
			symbolPicks = [
				{ label: localize('symbols', "symbols ({0})", filteredSymbolPicks.length), type: 'separator' },
				...sortedFilteredSymbolPicks
			];
		}

		return symbolPicks;
	}

	private compareByScore(symbolA: IGotoSymbolQuickPickItem, symbolB: IGotoSymbolQuickPickItem): number {
		if (typeof symbolA.score !== 'number' && typeof symbolB.score === 'number') {
			return 1;
		} else if (typeof symbolA.score === 'number' && typeof symbolB.score !== 'number') {
			return -1;
		}

		if (typeof symbolA.score === 'number' && typeof symbolB.score === 'number') {
			if (symbolA.score > symbolB.score) {
				return -1;
			} else if (symbolA.score < symbolB.score) {
				return 1;
			}
		}

		if (symbolA.index < symbolB.index) {
			return -1;
		} else if (symbolA.index > symbolB.index) {
			return 1;
		}

		return 0;
	}

	private compareByKindAndScore(symbolA: IGotoSymbolQuickPickItem, symbolB: IGotoSymbolQuickPickItem): number {
		const kindA = NLS_SYMBOL_KIND_CACHE[symbolA.kind] || FALLBACK_NLS_SYMBOL_KIND;
		const kindB = NLS_SYMBOL_KIND_CACHE[symbolB.kind] || FALLBACK_NLS_SYMBOL_KIND;

		// Sort by type first if scoped search
		const result = kindA.localeCompare(kindB);
		if (result === 0) {
			return this.compareByScore(symbolA, symbolB);
		}

		return result;
	}

	protected async getDocumentSymbols(document: ITextModel, token: CancellationToken): Promise<DocumentSymbol[]> {
		const model = await this._outlineModelService.getOrCreate(document, token);
		return token.isCancellationRequested ? [] : model.asListOfDocumentSymbols();
	}
}

// #region NLS Helpers

const FALLBACK_NLS_SYMBOL_KIND = localize('property', "properties ({0})");
const NLS_SYMBOL_KIND_CACHE: { [type: number]: string } = {
	[SymbolKind.Method]: localize('method', "methods ({0})"),
	[SymbolKind.Function]: localize('function', "functions ({0})"),
	[SymbolKind.Constructor]: localize('_constructor', "constructors ({0})"),
	[SymbolKind.Variable]: localize('variable', "variables ({0})"),
	[SymbolKind.Class]: localize('class', "classes ({0})"),
	[SymbolKind.Struct]: localize('struct', "structs ({0})"),
	[SymbolKind.Event]: localize('event', "events ({0})"),
	[SymbolKind.Operator]: localize('operator', "operators ({0})"),
	[SymbolKind.Interface]: localize('interface', "interfaces ({0})"),
	[SymbolKind.Namespace]: localize('namespace', "namespaces ({0})"),
	[SymbolKind.Package]: localize('package', "packages ({0})"),
	[SymbolKind.TypeParameter]: localize('typeParameter', "type parameters ({0})"),
	[SymbolKind.Module]: localize('modules', "modules ({0})"),
	[SymbolKind.Property]: localize('property', "properties ({0})"),
	[SymbolKind.Enum]: localize('enum', "enumerations ({0})"),
	[SymbolKind.EnumMember]: localize('enumMember', "enumeration members ({0})"),
	[SymbolKind.String]: localize('string', "strings ({0})"),
	[SymbolKind.File]: localize('file', "files ({0})"),
	[SymbolKind.Array]: localize('array', "arrays ({0})"),
	[SymbolKind.Number]: localize('number', "numbers ({0})"),
	[SymbolKind.Boolean]: localize('boolean', "booleans ({0})"),
	[SymbolKind.Object]: localize('object', "objects ({0})"),
	[SymbolKind.Key]: localize('key', "keys ({0})"),
	[SymbolKind.Field]: localize('field', "fields ({0})"),
	[SymbolKind.Constant]: localize('constant', "constants ({0})")
};

//#endregion
