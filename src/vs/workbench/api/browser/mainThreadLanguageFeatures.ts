/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { ITextModel, ISingleEditOperation } from 'vs/editor/common/model';
import * as modes from 'vs/editor/common/modes';
import * as search from 'vs/workbench/contrib/search/common/search';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Position as EditorPosition } from 'vs/editor/common/core/position';
import { Range as EditorRange, IRange } from 'vs/editor/common/core/range';
import { ExtHostContext, MainThreadLanguageFeaturesShape, ExtHostLanguageFeaturesShape, MainContext, IExtHostContext, ILanguageConfigurationDto, IRegExpDto, IIndentationRuleDto, IOnEnterRuleDto, ILocationDto, IWorkspaceSymbolDto, reviveWorkspaceEditDto, IDocumentFilterDto, IDefinitionLinkDto, ISignatureHelpProviderMetadataDto, ILinkDto, ICallHierarchyItemDto, ISuggestDataDto, ICodeActionDto, ISuggestDataDtoField, ISuggestResultDtoField, ICodeActionProviderMetadataDto, ILanguageWordDefinitionDto, IdentifiableInlineCompletions, IdentifiableInlineCompletion, ITypeHierarchyItemDto } from '../common/extHost.protocol';
import { LanguageConfigurationRegistry } from 'vs/editor/common/modes/languageConfigurationRegistry';
import { LanguageConfiguration, IndentationRule, OnEnterRule } from 'vs/editor/common/modes/languageConfiguration';
import { IModeService } from 'vs/editor/common/services/modeService';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { URI } from 'vs/base/common/uri';
import { Selection } from 'vs/editor/common/core/selection';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import * as callh from 'vs/workbench/contrib/callHierarchy/common/callHierarchy';
import * as typeh from 'vs/workbench/contrib/typeHierarchy/common/typeHierarchy';
import { mixin } from 'vs/base/common/objects';
import { decodeSemanticTokensDto } from 'vs/editor/common/services/semanticTokensDto';

@extHostNamedCustomer(MainContext.MainThreadLanguageFeatures)
export class MainThreadLanguageFeatures implements MainThreadLanguageFeaturesShape {

	private readonly _proxy: ExtHostLanguageFeaturesShape;
	private readonly _modeService: IModeService;
	private readonly _registrations = new Map<number, IDisposable>();

	constructor(
		extHostContext: IExtHostContext,
		@IModeService modeService: IModeService,
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageFeatures);
		this._modeService = modeService;

		if (this._modeService) {
			const updateAllWordDefinitions = () => {
				const langWordPairs = LanguageConfigurationRegistry.getWordDefinitions();
				let wordDefinitionDtos: ILanguageWordDefinitionDto[] = [];
				for (const [languageId, wordDefinition] of langWordPairs) {
					const language = this._modeService.getLanguageIdentifier(languageId);
					if (!language) {
						continue;
					}
					wordDefinitionDtos.push({
						languageId: language.language,
						regexSource: wordDefinition.source,
						regexFlags: wordDefinition.flags
					});
				}
				this._proxy.$setWordDefinitions(wordDefinitionDtos);
			};
			LanguageConfigurationRegistry.onDidChange((e) => {
				const wordDefinition = LanguageConfigurationRegistry.getWordDefinition(e.languageIdentifier.id);
				this._proxy.$setWordDefinitions([{
					languageId: e.languageIdentifier.language,
					regexSource: wordDefinition.source,
					regexFlags: wordDefinition.flags
				}]);
			});
			updateAllWordDefinitions();
		}
	}

	dispose(): void {
		for (const registration of this._registrations.values()) {
			registration.dispose();
		}
		this._registrations.clear();
	}

	$unregister(handle: number): void {
		const registration = this._registrations.get(handle);
		if (registration) {
			registration.dispose();
			this._registrations.delete(handle);
		}
	}

	//#region --- revive functions

	private static _reviveLocationDto(data?: ILocationDto): modes.Location;
	private static _reviveLocationDto(data?: ILocationDto[]): modes.Location[];
	private static _reviveLocationDto(data: ILocationDto | ILocationDto[] | undefined): modes.Location | modes.Location[] | undefined {
		if (!data) {
			return undefined; // {{SQL CARBON EDIT}} strict-null-checks
		} else if (Array.isArray(data)) {
			data.forEach(l => MainThreadLanguageFeatures._reviveLocationDto(l));
			return <modes.Location[]>data;
		} else {
			data.uri = URI.revive(data.uri);
			return <modes.Location>data;
		}
	}

	private static _reviveLocationLinkDto(data: IDefinitionLinkDto): modes.LocationLink;
	private static _reviveLocationLinkDto(data: IDefinitionLinkDto[]): modes.LocationLink[];
	private static _reviveLocationLinkDto(data: IDefinitionLinkDto | IDefinitionLinkDto[]): modes.LocationLink | modes.LocationLink[] {
		if (!data) {
			return <modes.LocationLink>data;
		} else if (Array.isArray(data)) {
			data.forEach(l => MainThreadLanguageFeatures._reviveLocationLinkDto(l));
			return <modes.LocationLink[]>data;
		} else {
			data.uri = URI.revive(data.uri);
			return <modes.LocationLink>data;
		}
	}

	private static _reviveWorkspaceSymbolDto(data: IWorkspaceSymbolDto): search.IWorkspaceSymbol;
	private static _reviveWorkspaceSymbolDto(data: IWorkspaceSymbolDto[]): search.IWorkspaceSymbol[];
	private static _reviveWorkspaceSymbolDto(data: undefined): undefined;
	private static _reviveWorkspaceSymbolDto(data: IWorkspaceSymbolDto | IWorkspaceSymbolDto[] | undefined): search.IWorkspaceSymbol | search.IWorkspaceSymbol[] | undefined {
		if (!data) {
			return <undefined>data;
		} else if (Array.isArray(data)) {
			data.forEach(MainThreadLanguageFeatures._reviveWorkspaceSymbolDto);
			return <search.IWorkspaceSymbol[]>data;
		} else {
			data.location = MainThreadLanguageFeatures._reviveLocationDto(data.location);
			return <search.IWorkspaceSymbol>data;
		}
	}

	private static _reviveCodeActionDto(data: ReadonlyArray<ICodeActionDto>): modes.CodeAction[] {
		if (data) {
			data.forEach(code => reviveWorkspaceEditDto(code.edit));
		}

		return <modes.CodeAction[]><unknown>data; // {{SQL CARBON EDIT}} strict-null-check
	}

	private static _reviveLinkDTO(data: ILinkDto): modes.ILink {
		if (data.url && typeof data.url !== 'string') {
			data.url = URI.revive(data.url);
		}
		return <modes.ILink>data;
	}

	private static _reviveCallHierarchyItemDto(data: ICallHierarchyItemDto | undefined): callh.CallHierarchyItem {
		if (data) {
			data.uri = URI.revive(data.uri);
		}
		return data as callh.CallHierarchyItem;
	}

	private static _reviveTypeHierarchyItemDto(data: ITypeHierarchyItemDto | undefined): typeh.TypeHierarchyItem {
		if (data) {
			data.uri = URI.revive(data.uri);
		}
		return data as typeh.TypeHierarchyItem;
	}

	//#endregion

	// --- outline

	$registerDocumentSymbolProvider(handle: number, selector: IDocumentFilterDto[], displayName: string): void {
		this._registrations.set(handle, modes.DocumentSymbolProviderRegistry.register(selector, <modes.DocumentSymbolProvider>{
			displayName,
			provideDocumentSymbols: (model: ITextModel, token: CancellationToken): Promise<modes.DocumentSymbol[] | undefined> => {
				return this._proxy.$provideDocumentSymbols(handle, model.uri, token);
			}
		}));
	}

	// --- code lens

	$registerCodeLensSupport(handle: number, selector: IDocumentFilterDto[], eventHandle: number | undefined): void {

		const provider = <modes.CodeLensProvider>{
			provideCodeLenses: async (model: ITextModel, token: CancellationToken): Promise<modes.CodeLensList | undefined> => {
				const listDto = await this._proxy.$provideCodeLenses(handle, model.uri, token);
				if (!listDto) {
					return undefined;
				}
				return {
					lenses: listDto.lenses,
					dispose: () => listDto.cacheId && this._proxy.$releaseCodeLenses(handle, listDto.cacheId)
				};
			},
			resolveCodeLens: (_model: ITextModel, codeLens: modes.CodeLens, token: CancellationToken): Promise<modes.CodeLens | undefined> => {
				return this._proxy.$resolveCodeLens(handle, codeLens, token);
			}
		};

		if (typeof eventHandle === 'number') {
			const emitter = new Emitter<modes.CodeLensProvider>();
			this._registrations.set(eventHandle, emitter);
			provider.onDidChange = emitter.event;
		}

		this._registrations.set(handle, modes.CodeLensProviderRegistry.register(selector, provider));
	}

	$emitCodeLensEvent(eventHandle: number, event?: any): void {
		const obj = this._registrations.get(eventHandle);
		if (obj instanceof Emitter) {
			obj.fire(event);
		}
	}

	// --- declaration

	$registerDefinitionSupport(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.DefinitionProviderRegistry.register(selector, <modes.DefinitionProvider>{
			provideDefinition: (model, position, token): Promise<modes.LocationLink[]> => {
				return this._proxy.$provideDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
			}
		}));
	}

	$registerDeclarationSupport(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.DeclarationProviderRegistry.register(selector, <modes.DeclarationProvider>{
			provideDeclaration: (model, position, token) => {
				return this._proxy.$provideDeclaration(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
			}
		}));
	}

	$registerImplementationSupport(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.ImplementationProviderRegistry.register(selector, <modes.ImplementationProvider>{
			provideImplementation: (model, position, token): Promise<modes.LocationLink[]> => {
				return this._proxy.$provideImplementation(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
			}
		}));
	}

	$registerTypeDefinitionSupport(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.TypeDefinitionProviderRegistry.register(selector, <modes.TypeDefinitionProvider>{
			provideTypeDefinition: (model, position, token): Promise<modes.LocationLink[]> => {
				return this._proxy.$provideTypeDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
			}
		}));
	}

	// --- extra info

	$registerHoverProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.HoverProviderRegistry.register(selector, <modes.HoverProvider>{
			provideHover: (model: ITextModel, position: EditorPosition, token: CancellationToken): Promise<modes.Hover | undefined> => {
				return this._proxy.$provideHover(handle, model.uri, position, token);
			}
		}));
	}

	// --- debug hover

	$registerEvaluatableExpressionProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.EvaluatableExpressionProviderRegistry.register(selector, <modes.EvaluatableExpressionProvider>{
			provideEvaluatableExpression: (model: ITextModel, position: EditorPosition, token: CancellationToken): Promise<modes.EvaluatableExpression | undefined> => {
				return this._proxy.$provideEvaluatableExpression(handle, model.uri, position, token);
			}
		}));
	}

	// --- inline values

	$registerInlineValuesProvider(handle: number, selector: IDocumentFilterDto[], eventHandle: number | undefined): void {
		const provider = <modes.InlineValuesProvider>{
			provideInlineValues: (model: ITextModel, viewPort: EditorRange, context: modes.InlineValueContext, token: CancellationToken): Promise<modes.InlineValue[] | undefined> => {
				return this._proxy.$provideInlineValues(handle, model.uri, viewPort, context, token);
			}
		};

		if (typeof eventHandle === 'number') {
			const emitter = new Emitter<void>();
			this._registrations.set(eventHandle, emitter);
			provider.onDidChangeInlineValues = emitter.event;
		}

		this._registrations.set(handle, modes.InlineValuesProviderRegistry.register(selector, provider));
	}

	$emitInlineValuesEvent(eventHandle: number, event?: any): void {
		const obj = this._registrations.get(eventHandle);
		if (obj instanceof Emitter) {
			obj.fire(event);
		}
	}

	// --- occurrences

	$registerDocumentHighlightProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.DocumentHighlightProviderRegistry.register(selector, <modes.DocumentHighlightProvider>{
			provideDocumentHighlights: (model: ITextModel, position: EditorPosition, token: CancellationToken): Promise<modes.DocumentHighlight[] | undefined> => {
				return this._proxy.$provideDocumentHighlights(handle, model.uri, position, token);
			}
		}));
	}

	// --- linked editing

	$registerLinkedEditingRangeProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.LinkedEditingRangeProviderRegistry.register(selector, <modes.LinkedEditingRangeProvider>{
			provideLinkedEditingRanges: async (model: ITextModel, position: EditorPosition, token: CancellationToken): Promise<modes.LinkedEditingRanges | undefined> => {
				const res = await this._proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
				if (res) {
					return {
						ranges: res.ranges,
						wordPattern: res.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(res.wordPattern) : undefined
					};
				}
				return undefined;
			}
		}));
	}

	// --- references

	$registerReferenceSupport(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.ReferenceProviderRegistry.register(selector, <modes.ReferenceProvider>{
			provideReferences: (model: ITextModel, position: EditorPosition, context: modes.ReferenceContext, token: CancellationToken): Promise<modes.Location[]> => {
				return this._proxy.$provideReferences(handle, model.uri, position, context, token).then(MainThreadLanguageFeatures._reviveLocationDto);
			}
		}));
	}

	// --- quick fix

	$registerQuickFixSupport(handle: number, selector: IDocumentFilterDto[], metadata: ICodeActionProviderMetadataDto, displayName: string, supportsResolve: boolean): void {
		const provider: modes.CodeActionProvider = {
			provideCodeActions: async (model: ITextModel, rangeOrSelection: EditorRange | Selection, context: modes.CodeActionContext, token: CancellationToken): Promise<modes.CodeActionList | undefined> => {
				const listDto = await this._proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, context, token);
				if (!listDto) {
					return undefined;
				}
				return <modes.CodeActionList>{
					actions: MainThreadLanguageFeatures._reviveCodeActionDto(listDto.actions),
					dispose: () => {
						if (typeof listDto.cacheId === 'number') {
							this._proxy.$releaseCodeActions(handle, listDto.cacheId);
						}
					}
				};
			},
			providedCodeActionKinds: metadata.providedKinds,
			documentation: metadata.documentation,
			displayName
		};

		if (supportsResolve) {
			provider.resolveCodeAction = async (codeAction: modes.CodeAction, token: CancellationToken): Promise<modes.CodeAction> => {
				const data = await this._proxy.$resolveCodeAction(handle, (<ICodeActionDto>codeAction).cacheId!, token);
				codeAction.edit = reviveWorkspaceEditDto(data);
				return codeAction;
			};
		}

		this._registrations.set(handle, modes.CodeActionProviderRegistry.register(selector, provider));
	}

	// --- formatting

	$registerDocumentFormattingSupport(handle: number, selector: IDocumentFilterDto[], extensionId: ExtensionIdentifier, displayName: string): void {
		this._registrations.set(handle, modes.DocumentFormattingEditProviderRegistry.register(selector, <modes.DocumentFormattingEditProvider>{
			extensionId,
			displayName,
			provideDocumentFormattingEdits: (model: ITextModel, options: modes.FormattingOptions, token: CancellationToken): Promise<ISingleEditOperation[] | undefined> => {
				return this._proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
			}
		}));
	}

	$registerRangeFormattingSupport(handle: number, selector: IDocumentFilterDto[], extensionId: ExtensionIdentifier, displayName: string): void {
		this._registrations.set(handle, modes.DocumentRangeFormattingEditProviderRegistry.register(selector, <modes.DocumentRangeFormattingEditProvider>{
			extensionId,
			displayName,
			provideDocumentRangeFormattingEdits: (model: ITextModel, range: EditorRange, options: modes.FormattingOptions, token: CancellationToken): Promise<ISingleEditOperation[] | undefined> => {
				return this._proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
			}
		}));
	}

	$registerOnTypeFormattingSupport(handle: number, selector: IDocumentFilterDto[], autoFormatTriggerCharacters: string[], extensionId: ExtensionIdentifier): void {
		this._registrations.set(handle, modes.OnTypeFormattingEditProviderRegistry.register(selector, <modes.OnTypeFormattingEditProvider>{
			extensionId,
			autoFormatTriggerCharacters,
			provideOnTypeFormattingEdits: (model: ITextModel, position: EditorPosition, ch: string, options: modes.FormattingOptions, token: CancellationToken): Promise<ISingleEditOperation[] | undefined> => {
				return this._proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
			}
		}));
	}

	// --- navigate type

	$registerNavigateTypeSupport(handle: number): void {
		let lastResultId: number | undefined;
		this._registrations.set(handle, search.WorkspaceSymbolProviderRegistry.register(<search.IWorkspaceSymbolProvider>{
			provideWorkspaceSymbols: (search: string, token: CancellationToken): Promise<search.IWorkspaceSymbol[]> => {
				return this._proxy.$provideWorkspaceSymbols(handle, search, token).then(result => {
					if (lastResultId !== undefined) {
						this._proxy.$releaseWorkspaceSymbols(handle, lastResultId);
					}
					lastResultId = result._id;
					return MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(result.symbols);
				});
			},
			resolveWorkspaceSymbol: (item: search.IWorkspaceSymbol, token: CancellationToken): Promise<search.IWorkspaceSymbol | undefined> => {
				return this._proxy.$resolveWorkspaceSymbol(handle, item, token).then(i => {
					if (i) {
						return MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(i);
					}
					return undefined;
				});
			}
		}));
	}

	// --- rename

	$registerRenameSupport(handle: number, selector: IDocumentFilterDto[], supportResolveLocation: boolean): void {
		this._registrations.set(handle, modes.RenameProviderRegistry.register(selector, <modes.RenameProvider>{
			provideRenameEdits: (model: ITextModel, position: EditorPosition, newName: string, token: CancellationToken) => {
				return this._proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then(reviveWorkspaceEditDto);
			},
			resolveRenameLocation: supportResolveLocation
				? (model: ITextModel, position: EditorPosition, token: CancellationToken): Promise<modes.RenameLocation | undefined> => this._proxy.$resolveRenameLocation(handle, model.uri, position, token)
				: undefined
		}));
	}

	// --- semantic tokens

	$registerDocumentSemanticTokensProvider(handle: number, selector: IDocumentFilterDto[], legend: modes.SemanticTokensLegend, eventHandle: number | undefined): void {
		let event: Event<void> | undefined = undefined;
		if (typeof eventHandle === 'number') {
			const emitter = new Emitter<void>();
			this._registrations.set(eventHandle, emitter);
			event = emitter.event;
		}
		this._registrations.set(handle, modes.DocumentSemanticTokensProviderRegistry.register(selector, new MainThreadDocumentSemanticTokensProvider(this._proxy, handle, legend, event)));
	}

	$emitDocumentSemanticTokensEvent(eventHandle: number): void {
		const obj = this._registrations.get(eventHandle);
		if (obj instanceof Emitter) {
			obj.fire(undefined);
		}
	}

	$registerDocumentRangeSemanticTokensProvider(handle: number, selector: IDocumentFilterDto[], legend: modes.SemanticTokensLegend): void {
		this._registrations.set(handle, modes.DocumentRangeSemanticTokensProviderRegistry.register(selector, new MainThreadDocumentRangeSemanticTokensProvider(this._proxy, handle, legend)));
	}

	// --- suggest

	private static _inflateSuggestDto(defaultRange: IRange | { insert: IRange, replace: IRange }, data: ISuggestDataDto): modes.CompletionItem {

		const label = data[ISuggestDataDtoField.label];

		return {
			label,
			kind: data[ISuggestDataDtoField.kind] ?? modes.CompletionItemKind.Property,
			tags: data[ISuggestDataDtoField.kindModifier],
			detail: data[ISuggestDataDtoField.detail],
			documentation: data[ISuggestDataDtoField.documentation],
			sortText: data[ISuggestDataDtoField.sortText],
			filterText: data[ISuggestDataDtoField.filterText],
			preselect: data[ISuggestDataDtoField.preselect],
			insertText: data[ISuggestDataDtoField.insertText] ?? (typeof label === 'string' ? label : label.label),
			range: data[ISuggestDataDtoField.range] ?? defaultRange,
			insertTextRules: data[ISuggestDataDtoField.insertTextRules],
			commitCharacters: data[ISuggestDataDtoField.commitCharacters],
			additionalTextEdits: data[ISuggestDataDtoField.additionalTextEdits],
			command: data[ISuggestDataDtoField.command],
			// not-standard
			_id: data.x,
		};
	}

	$registerSuggestSupport(handle: number, selector: IDocumentFilterDto[], triggerCharacters: string[], supportsResolveDetails: boolean, displayName: string): void {
		const provider: modes.CompletionItemProvider = {
			triggerCharacters,
			_debugDisplayName: displayName,
			provideCompletionItems: async (model: ITextModel, position: EditorPosition, context: modes.CompletionContext, token: CancellationToken): Promise<modes.CompletionList | undefined> => {
				const result = await this._proxy.$provideCompletionItems(handle, model.uri, position, context, token);
				if (!result) {
					return <any>result; // {{SQL CARBON EDIT}}
				}
				return {
					suggestions: result[ISuggestResultDtoField.completions].map(d => MainThreadLanguageFeatures._inflateSuggestDto(result[ISuggestResultDtoField.defaultRanges], d)),
					incomplete: result[ISuggestResultDtoField.isIncomplete] || false,
					duration: result[ISuggestResultDtoField.duration],
					dispose: () => {
						if (typeof result.x === 'number') {
							this._proxy.$releaseCompletionItems(handle, result.x);
						}
					}
				};
			}
		};
		if (supportsResolveDetails) {
			provider.resolveCompletionItem = (suggestion, token) => {
				return this._proxy.$resolveCompletionItem(handle, suggestion._id!, token).then(result => {
					if (!result) {
						return suggestion;
					}

					let newSuggestion = MainThreadLanguageFeatures._inflateSuggestDto(suggestion.range, result);
					return mixin(suggestion, newSuggestion, true);
				});
			};
		}
		this._registrations.set(handle, modes.CompletionProviderRegistry.register(selector, provider));
	}

	$registerInlineCompletionsSupport(handle: number, selector: IDocumentFilterDto[]): void {
		const provider: modes.InlineCompletionsProvider<IdentifiableInlineCompletions> = {
			provideInlineCompletions: async (model: ITextModel, position: EditorPosition, context: modes.InlineCompletionContext, token: CancellationToken): Promise<IdentifiableInlineCompletions | undefined> => {
				return this._proxy.$provideInlineCompletions(handle, model.uri, position, context, token);
			},
			handleItemDidShow: async (completions: IdentifiableInlineCompletions, item: IdentifiableInlineCompletion): Promise<void> => {
				return this._proxy.$handleInlineCompletionDidShow(handle, completions.pid, item.idx);
			},
			freeInlineCompletions: (completions: IdentifiableInlineCompletions): void => {
				this._proxy.$freeInlineCompletionsList(handle, completions.pid);
			}
		};
		this._registrations.set(handle, modes.InlineCompletionsProviderRegistry.register(selector, provider));
	}

	// --- parameter hints

	$registerSignatureHelpProvider(handle: number, selector: IDocumentFilterDto[], metadata: ISignatureHelpProviderMetadataDto): void {
		this._registrations.set(handle, modes.SignatureHelpProviderRegistry.register(selector, <modes.SignatureHelpProvider>{

			signatureHelpTriggerCharacters: metadata.triggerCharacters,
			signatureHelpRetriggerCharacters: metadata.retriggerCharacters,

			provideSignatureHelp: async (model: ITextModel, position: EditorPosition, token: CancellationToken, context: modes.SignatureHelpContext): Promise<modes.SignatureHelpResult | undefined> => {
				const result = await this._proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
				if (!result) {
					return undefined;
				}
				return {
					value: result,
					dispose: () => {
						this._proxy.$releaseSignatureHelp(handle, result.id);
					}
				};
			}
		}));
	}

	// --- inline hints

	$registerInlayHintsProvider(handle: number, selector: IDocumentFilterDto[], eventHandle: number | undefined): void {
		const provider = <modes.InlayHintsProvider>{
			provideInlayHints: async (model: ITextModel, range: EditorRange, token: CancellationToken): Promise<modes.InlayHint[] | undefined> => {
				const result = await this._proxy.$provideInlayHints(handle, model.uri, range, token);
				return result?.hints;
			}
		};

		if (typeof eventHandle === 'number') {
			const emitter = new Emitter<void>();
			this._registrations.set(eventHandle, emitter);
			provider.onDidChangeInlayHints = emitter.event;
		}

		this._registrations.set(handle, modes.InlayHintsProviderRegistry.register(selector, provider));
	}

	$emitInlayHintsEvent(eventHandle: number, event?: any): void {
		const obj = this._registrations.get(eventHandle);
		if (obj instanceof Emitter) {
			obj.fire(event);
		}
	}

	// --- links

	$registerDocumentLinkProvider(handle: number, selector: IDocumentFilterDto[], supportsResolve: boolean): void {
		const provider: modes.LinkProvider = {
			provideLinks: (model, token) => {
				return this._proxy.$provideDocumentLinks(handle, model.uri, token).then(dto => {
					if (!dto) {
						return undefined;
					}
					return {
						links: dto.links.map(MainThreadLanguageFeatures._reviveLinkDTO),
						dispose: () => {
							if (typeof dto.id === 'number') {
								this._proxy.$releaseDocumentLinks(handle, dto.id);
							}
						}
					};
				});
			}
		};
		if (supportsResolve) {
			provider.resolveLink = (link, token) => {
				const dto: ILinkDto = link;
				if (!dto.cacheId) {
					return link;
				}
				return this._proxy.$resolveDocumentLink(handle, dto.cacheId, token).then(obj => {
					return obj && MainThreadLanguageFeatures._reviveLinkDTO(obj);
				});
			};
		}
		this._registrations.set(handle, modes.LinkProviderRegistry.register(selector, provider));
	}

	// --- colors

	$registerDocumentColorProvider(handle: number, selector: IDocumentFilterDto[]): void {
		const proxy = this._proxy;
		this._registrations.set(handle, modes.ColorProviderRegistry.register(selector, <modes.DocumentColorProvider>{
			provideDocumentColors: (model, token) => {
				return proxy.$provideDocumentColors(handle, model.uri, token)
					.then(documentColors => {
						return documentColors.map(documentColor => {
							const [red, green, blue, alpha] = documentColor.color;
							const color = {
								red: red,
								green: green,
								blue: blue,
								alpha
							};

							return {
								color,
								range: documentColor.range
							};
						});
					});
			},

			provideColorPresentations: (model, colorInfo, token) => {
				return proxy.$provideColorPresentations(handle, model.uri, {
					color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
					range: colorInfo.range
				}, token);
			}
		}));
	}

	// --- folding

	$registerFoldingRangeProvider(handle: number, selector: IDocumentFilterDto[], eventHandle: number | undefined): void {
		const provider = <modes.FoldingRangeProvider>{
			provideFoldingRanges: (model, context, token) => {
				return this._proxy.$provideFoldingRanges(handle, model.uri, context, token);
			}
		};

		if (typeof eventHandle === 'number') {
			const emitter = new Emitter<modes.FoldingRangeProvider>();
			this._registrations.set(eventHandle, emitter);
			provider.onDidChange = emitter.event;
		}

		this._registrations.set(handle, modes.FoldingRangeProviderRegistry.register(selector, provider));
	}

	$emitFoldingRangeEvent(eventHandle: number, event?: any): void {
		const obj = this._registrations.get(eventHandle);
		if (obj instanceof Emitter) {
			obj.fire(event);
		}
	}

	// -- smart select

	$registerSelectionRangeProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, modes.SelectionRangeRegistry.register(selector, {
			provideSelectionRanges: (model, positions, token) => {
				return this._proxy.$provideSelectionRanges(handle, model.uri, positions, token);
			}
		}));
	}

	// --- call hierarchy

	$registerCallHierarchyProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, callh.CallHierarchyProviderRegistry.register(selector, {

			prepareCallHierarchy: async (document, position, token) => {
				const items = await this._proxy.$prepareCallHierarchy(handle, document.uri, position, token);
				if (!items) {
					return undefined;
				}
				return {
					dispose: () => {
						for (const item of items) {
							this._proxy.$releaseCallHierarchy(handle, item._sessionId);
						}
					},
					roots: items.map(MainThreadLanguageFeatures._reviveCallHierarchyItemDto)
				};
			},

			provideOutgoingCalls: async (item, token) => {
				const outgoing = await this._proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
				if (!outgoing) {
					return undefined; // {{SQL CARBON EDIT}} strict-null-check
				}
				outgoing.forEach(value => {
					value.to = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.to);
				});
				return <any>outgoing;
			},
			provideIncomingCalls: async (item, token) => {
				const incoming = await this._proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
				if (!incoming) {
					return undefined; // {{SQL CARBON EDIT}} strict-null-check
				}
				incoming.forEach(value => {
					value.from = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.from);
				});
				return <any>incoming;
			}
		}));
	}

	// --- configuration

	private static _reviveRegExp(regExp: IRegExpDto): RegExp {
		return new RegExp(regExp.pattern, regExp.flags);
	}

	private static _reviveIndentationRule(indentationRule: IIndentationRuleDto): IndentationRule {
		return {
			decreaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.decreaseIndentPattern),
			increaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.increaseIndentPattern),
			indentNextLinePattern: indentationRule.indentNextLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.indentNextLinePattern) : undefined,
			unIndentedLinePattern: indentationRule.unIndentedLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.unIndentedLinePattern) : undefined,
		};
	}

	private static _reviveOnEnterRule(onEnterRule: IOnEnterRuleDto): OnEnterRule {
		return {
			beforeText: MainThreadLanguageFeatures._reviveRegExp(onEnterRule.beforeText),
			afterText: onEnterRule.afterText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.afterText) : undefined,
			previousLineText: onEnterRule.previousLineText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.previousLineText) : undefined,
			action: onEnterRule.action
		};
	}

	private static _reviveOnEnterRules(onEnterRules: IOnEnterRuleDto[]): OnEnterRule[] {
		return onEnterRules.map(MainThreadLanguageFeatures._reviveOnEnterRule);
	}

	$setLanguageConfiguration(handle: number, languageId: string, _configuration: ILanguageConfigurationDto): void {

		const configuration: LanguageConfiguration = {
			comments: _configuration.comments,
			brackets: _configuration.brackets,
			wordPattern: _configuration.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(_configuration.wordPattern) : undefined,
			indentationRules: _configuration.indentationRules ? MainThreadLanguageFeatures._reviveIndentationRule(_configuration.indentationRules) : undefined,
			onEnterRules: _configuration.onEnterRules ? MainThreadLanguageFeatures._reviveOnEnterRules(_configuration.onEnterRules) : undefined,

			autoClosingPairs: undefined,
			surroundingPairs: undefined,
			__electricCharacterSupport: undefined
		};

		if (_configuration.__characterPairSupport) {
			// backwards compatibility
			configuration.autoClosingPairs = _configuration.__characterPairSupport.autoClosingPairs;
		}

		if (_configuration.__electricCharacterSupport && _configuration.__electricCharacterSupport.docComment) {
			configuration.__electricCharacterSupport = {
				docComment: {
					open: _configuration.__electricCharacterSupport.docComment.open,
					close: _configuration.__electricCharacterSupport.docComment.close
				}
			};
		}

		const languageIdentifier = this._modeService.getLanguageIdentifier(languageId);
		if (languageIdentifier) {
			this._registrations.set(handle, LanguageConfigurationRegistry.register(languageIdentifier, configuration, 100));
		}
	}

	// --- type hierarchy

	$registerTypeHierarchyProvider(handle: number, selector: IDocumentFilterDto[]): void {
		this._registrations.set(handle, typeh.TypeHierarchyProviderRegistry.register(selector, {

			prepareTypeHierarchy: async (document, position, token) => {
				const items = await this._proxy.$prepareTypeHierarchy(handle, document.uri, position, token);
				if (!items) {
					return undefined;
				}
				return {
					dispose: () => {
						for (const item of items) {
							this._proxy.$releaseTypeHierarchy(handle, item._sessionId);
						}
					},
					roots: items.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto)
				};
			},

			provideSupertypes: async (item, token) => {
				const supertypes = await this._proxy.$provideTypeHierarchySupertypes(handle, item._sessionId, item._itemId, token);
				if (!supertypes) {
					return supertypes;
				}
				return supertypes.map(item => MainThreadLanguageFeatures._reviveTypeHierarchyItemDto(item)) as any; // {{SQL CARBON EDIT}} Cast to any to get around weird compile error - trusting them to do the right thing here
			},
			provideSubtypes: async (item, token) => {
				const subtypes = await this._proxy.$provideTypeHierarchySubtypes(handle, item._sessionId, item._itemId, token);
				if (!subtypes) {
					return subtypes;
				}
				return subtypes.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto) as any; // {{SQL CARBON EDIT}} Cast to any to get around weird compile error - trusting them to do the right thing here
			}
		}));
	}

}

export class MainThreadDocumentSemanticTokensProvider implements modes.DocumentSemanticTokensProvider {

	constructor(
		private readonly _proxy: ExtHostLanguageFeaturesShape,
		private readonly _handle: number,
		private readonly _legend: modes.SemanticTokensLegend,
		public readonly onDidChange: Event<void> | undefined,
	) {
	}

	public releaseDocumentSemanticTokens(resultId: string | undefined): void {
		if (resultId) {
			this._proxy.$releaseDocumentSemanticTokens(this._handle, parseInt(resultId, 10));
		}
	}

	public getLegend(): modes.SemanticTokensLegend {
		return this._legend;
	}

	async provideDocumentSemanticTokens(model: ITextModel, lastResultId: string | null, token: CancellationToken): Promise<modes.SemanticTokens | modes.SemanticTokensEdits | null> {
		const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
		const encodedDto = await this._proxy.$provideDocumentSemanticTokens(this._handle, model.uri, nLastResultId, token);
		if (!encodedDto) {
			return null;
		}
		if (token.isCancellationRequested) {
			return null;
		}
		const dto = decodeSemanticTokensDto(encodedDto);
		if (dto.type === 'full') {
			return {
				resultId: String(dto.id),
				data: dto.data
			};
		}
		return {
			resultId: String(dto.id),
			edits: dto.deltas
		};
	}
}

export class MainThreadDocumentRangeSemanticTokensProvider implements modes.DocumentRangeSemanticTokensProvider {

	constructor(
		private readonly _proxy: ExtHostLanguageFeaturesShape,
		private readonly _handle: number,
		private readonly _legend: modes.SemanticTokensLegend,
	) {
	}

	public getLegend(): modes.SemanticTokensLegend {
		return this._legend;
	}

	async provideDocumentRangeSemanticTokens(model: ITextModel, range: EditorRange, token: CancellationToken): Promise<modes.SemanticTokens | null> {
		const encodedDto = await this._proxy.$provideDocumentRangeSemanticTokens(this._handle, model.uri, range, token);
		if (!encodedDto) {
			return null;
		}
		if (token.isCancellationRequested) {
			return null;
		}
		const dto = decodeSemanticTokensDto(encodedDto);
		if (dto.type === 'full') {
			return {
				resultId: String(dto.id),
				data: dto.data
			};
		}
		throw new Error(`Unexpected`);
	}
}
