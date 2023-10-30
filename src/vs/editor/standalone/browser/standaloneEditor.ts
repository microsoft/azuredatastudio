/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./standalone-tokens';
import { Disposable, DisposableStore, IDisposable } from 'vs/base/common/lifecycle';
import { splitLines } from 'vs/base/common/strings';
import { URI } from 'vs/base/common/uri';
import { FontMeasurements } from 'vs/editor/browser/config/fontMeasurements';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { DiffNavigator, IDiffNavigator } from 'vs/editor/browser/widget/diffNavigator';
import { ApplyUpdateResult, ConfigurationChangedEvent, EditorOptions } from 'vs/editor/common/config/editorOptions';
import { BareFontInfo, FontInfo } from 'vs/editor/common/config/fontInfo';
import { EditorType, IDiffEditor } from 'vs/editor/common/editorCommon';
import { FindMatch, ITextModel, TextModelResolvedOptions } from 'vs/editor/common/model';
import * as languages from 'vs/editor/common/languages';
import { ILanguageConfigurationService } from 'vs/editor/common/languages/languageConfigurationRegistry';
import { NullState, nullTokenize } from 'vs/editor/common/languages/nullTokenize';
import { ILanguageService } from 'vs/editor/common/languages/language';
import { IModelService } from 'vs/editor/common/services/model';
import { createWebWorker as actualCreateWebWorker, IWebWorkerOptions, MonacoWebWorker } from 'vs/editor/browser/services/webWorker';
import * as standaloneEnums from 'vs/editor/common/standalone/standaloneEnums';
import { Colorizer, IColorizerElementOptions, IColorizerOptions } from 'vs/editor/standalone/browser/colorizer';
import { createTextModel, IActionDescriptor, IStandaloneCodeEditor, IStandaloneDiffEditor, IStandaloneDiffEditorConstructionOptions, IStandaloneEditorConstructionOptions, StandaloneDiffEditor, StandaloneDiffEditor2, StandaloneEditor } from 'vs/editor/standalone/browser/standaloneCodeEditor';
import { IEditorOverrideServices, StandaloneKeybindingService, StandaloneServices } from 'vs/editor/standalone/browser/standaloneServices';
import { StandaloneThemeService } from 'vs/editor/standalone/browser/standaloneThemeService';
import { IStandaloneThemeData, IStandaloneThemeService } from 'vs/editor/standalone/common/standaloneTheme';
import { CommandsRegistry, ICommandHandler } from 'vs/platform/commands/common/commands';
import { IMarker, IMarkerData, IMarkerService } from 'vs/platform/markers/common/markers';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { EditorCommand, ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { IMenuItem, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { PLAINTEXT_LANGUAGE_ID } from 'vs/editor/common/languages/modesRegistry';
import { LineRangeMapping, MovedText, RangeMapping, SimpleLineRangeMapping } from 'vs/editor/common/diff/linesDiffComputer';
import { LineRange } from 'vs/editor/common/core/lineRange';
import { EditorZoom } from 'vs/editor/common/config/editorZoom';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IRange } from 'vs/editor/common/core/range';
import { IPosition } from 'vs/editor/common/core/position';
import { ITextResourceEditorInput } from 'vs/platform/editor/common/editor';

/**
 * Create a new editor under `domElement`.
 * `domElement` should be empty (not contain other dom nodes).
 * The editor will read the size of `domElement`.
 */
export function create(domElement: HTMLElement, options?: IStandaloneEditorConstructionOptions, override?: IEditorOverrideServices): IStandaloneCodeEditor {
	const instantiationService = StandaloneServices.initialize(override || {});
	return instantiationService.createInstance(StandaloneEditor, domElement, options);
}

/**
 * Emitted when an editor is created.
 * Creating a diff editor might cause this listener to be invoked with the two editors.
 * @event
 */
export function onDidCreateEditor(listener: (codeEditor: ICodeEditor) => void): IDisposable {
	const codeEditorService = StandaloneServices.get(ICodeEditorService);
	return codeEditorService.onCodeEditorAdd((editor) => {
		listener(<ICodeEditor>editor);
	});
}

/**
 * Emitted when an diff editor is created.
 * @event
 */
export function onDidCreateDiffEditor(listener: (diffEditor: IDiffEditor) => void): IDisposable {
	const codeEditorService = StandaloneServices.get(ICodeEditorService);
	return codeEditorService.onDiffEditorAdd((editor) => {
		listener(<IDiffEditor>editor);
	});
}

/**
 * Get all the created editors.
 */
export function getEditors(): readonly ICodeEditor[] {
	const codeEditorService = StandaloneServices.get(ICodeEditorService);
	return codeEditorService.listCodeEditors();
}

/**
 * Get all the created diff editors.
 */
export function getDiffEditors(): readonly IDiffEditor[] {
	const codeEditorService = StandaloneServices.get(ICodeEditorService);
	return codeEditorService.listDiffEditors();
}

/**
 * Create a new diff editor under `domElement`.
 * `domElement` should be empty (not contain other dom nodes).
 * The editor will read the size of `domElement`.
 */
export function createDiffEditor(domElement: HTMLElement, options?: IStandaloneDiffEditorConstructionOptions, override?: IEditorOverrideServices): IStandaloneDiffEditor {
	const instantiationService = StandaloneServices.initialize(override || {});
	if ((options?.experimental as any)?.useVersion2) {
		return instantiationService.createInstance(StandaloneDiffEditor2, domElement, options);
	}
	return instantiationService.createInstance(StandaloneDiffEditor, domElement, options);
}

export interface IDiffNavigatorOptions {
	readonly followsCaret?: boolean;
	readonly ignoreCharChanges?: boolean;
	readonly alwaysRevealFirst?: boolean;
}

export function createDiffNavigator(diffEditor: IStandaloneDiffEditor, opts?: IDiffNavigatorOptions): IDiffNavigator {
	const instantiationService = StandaloneServices.initialize({});
	return instantiationService.createInstance(DiffNavigator, diffEditor, opts);
}

/**
 * Description of a command contribution
 */
export interface ICommandDescriptor {
	/**
	 * An unique identifier of the contributed command.
	 */
	id: string;
	/**
	 * Callback that will be executed when the command is triggered.
	 */
	run: ICommandHandler;
}

/**
 * Add a command.
 */
export function addCommand(descriptor: ICommandDescriptor): IDisposable {
	if ((typeof descriptor.id !== 'string') || (typeof descriptor.run !== 'function')) {
		throw new Error('Invalid command descriptor, `id` and `run` are required properties!');
	}
	return CommandsRegistry.registerCommand(descriptor.id, descriptor.run);
}

/**
 * Add an action to all editors.
 */
export function addEditorAction(descriptor: IActionDescriptor): IDisposable {
	if ((typeof descriptor.id !== 'string') || (typeof descriptor.label !== 'string') || (typeof descriptor.run !== 'function')) {
		throw new Error('Invalid action descriptor, `id`, `label` and `run` are required properties!');
	}

	const precondition = ContextKeyExpr.deserialize(descriptor.precondition);
	const run = (accessor: ServicesAccessor, ...args: any[]): void | Promise<void> => {
		return EditorCommand.runEditorCommand(accessor, args, precondition, (accessor, editor, args) => Promise.resolve(descriptor.run(editor, ...args)));
	};

	const toDispose = new DisposableStore();

	// Register the command
	toDispose.add(CommandsRegistry.registerCommand(descriptor.id, run));

	// Register the context menu item
	if (descriptor.contextMenuGroupId) {
		const menuItem: IMenuItem = {
			command: {
				id: descriptor.id,
				title: descriptor.label
			},
			when: precondition,
			group: descriptor.contextMenuGroupId,
			order: descriptor.contextMenuOrder || 0
		};
		toDispose.add(MenuRegistry.appendMenuItem(MenuId.EditorContext, menuItem));
	}

	// Register the keybindings
	if (Array.isArray(descriptor.keybindings)) {
		const keybindingService = StandaloneServices.get(IKeybindingService);
		if (!(keybindingService instanceof StandaloneKeybindingService)) {
			console.warn('Cannot add keybinding because the editor is configured with an unrecognized KeybindingService');
		} else {
			const keybindingsWhen = ContextKeyExpr.and(precondition, ContextKeyExpr.deserialize(descriptor.keybindingContext));
			toDispose.add(keybindingService.addDynamicKeybindings(descriptor.keybindings.map((keybinding) => {
				return {
					keybinding,
					command: descriptor.id,
					when: keybindingsWhen
				};
			})));
		}
	}

	return toDispose;
}

/**
 * A keybinding rule.
 */
export interface IKeybindingRule {
	keybinding: number;
	command?: string | null;
	commandArgs?: any;
	when?: string | null;
}

/**
 * Add a keybinding rule.
 */
export function addKeybindingRule(rule: IKeybindingRule): IDisposable {
	return addKeybindingRules([rule]);
}

/**
 * Add keybinding rules.
 */
export function addKeybindingRules(rules: IKeybindingRule[]): IDisposable {
	const keybindingService = StandaloneServices.get(IKeybindingService);
	if (!(keybindingService instanceof StandaloneKeybindingService)) {
		console.warn('Cannot add keybinding because the editor is configured with an unrecognized KeybindingService');
		return Disposable.None;
	}

	return keybindingService.addDynamicKeybindings(rules.map((rule) => {
		return {
			keybinding: rule.keybinding,
			command: rule.command,
			commandArgs: rule.commandArgs,
			when: ContextKeyExpr.deserialize(rule.when),
		};
	}));
}

/**
 * Create a new editor model.
 * You can specify the language that should be set for this model or let the language be inferred from the `uri`.
 */
export function createModel(value: string, language?: string, uri?: URI): ITextModel {
	const languageService = StandaloneServices.get(ILanguageService);
	const languageId = languageService.getLanguageIdByMimeType(language) || language;
	return createTextModel(
		StandaloneServices.get(IModelService),
		languageService,
		value,
		languageId,
		uri
	);
}

/**
 * Change the language for a model.
 */
export function setModelLanguage(model: ITextModel, mimeTypeOrLanguageId: string): void {
	const languageService = StandaloneServices.get(ILanguageService);
	const languageId = languageService.getLanguageIdByMimeType(mimeTypeOrLanguageId) || mimeTypeOrLanguageId || PLAINTEXT_LANGUAGE_ID;
	model.setLanguage(languageService.createById(languageId));
}

/**
 * Set the markers for a model.
 */
export function setModelMarkers(model: ITextModel, owner: string, markers: IMarkerData[]): void {
	if (model) {
		const markerService = StandaloneServices.get(IMarkerService);
		markerService.changeOne(owner, model.uri, markers);
	}
}

/**
 * Remove all markers of an owner.
 */
export function removeAllMarkers(owner: string) {
	const markerService = StandaloneServices.get(IMarkerService);
	markerService.changeAll(owner, []);
}

/**
 * Get markers for owner and/or resource
 *
 * @returns list of markers
 */
export function getModelMarkers(filter: { owner?: string; resource?: URI; take?: number }): IMarker[] {
	const markerService = StandaloneServices.get(IMarkerService);
	return markerService.read(filter);
}

/**
 * Emitted when markers change for a model.
 * @event
 */
export function onDidChangeMarkers(listener: (e: readonly URI[]) => void): IDisposable {
	const markerService = StandaloneServices.get(IMarkerService);
	return markerService.onMarkerChanged(listener);
}

/**
 * Get the model that has `uri` if it exists.
 */
export function getModel(uri: URI): ITextModel | null {
	const modelService = StandaloneServices.get(IModelService);
	return modelService.getModel(uri);
}

/**
 * Get all the created models.
 */
export function getModels(): ITextModel[] {
	const modelService = StandaloneServices.get(IModelService);
	return modelService.getModels();
}

/**
 * Emitted when a model is created.
 * @event
 */
export function onDidCreateModel(listener: (model: ITextModel) => void): IDisposable {
	const modelService = StandaloneServices.get(IModelService);
	return modelService.onModelAdded(listener);
}

/**
 * Emitted right before a model is disposed.
 * @event
 */
export function onWillDisposeModel(listener: (model: ITextModel) => void): IDisposable {
	const modelService = StandaloneServices.get(IModelService);
	return modelService.onModelRemoved(listener);
}

/**
 * Emitted when a different language is set to a model.
 * @event
 */
export function onDidChangeModelLanguage(listener: (e: { readonly model: ITextModel; readonly oldLanguage: string }) => void): IDisposable {
	const modelService = StandaloneServices.get(IModelService);
	return modelService.onModelLanguageChanged((e) => {
		listener({
			model: e.model,
			oldLanguage: e.oldLanguageId
		});
	});
}

/**
 * Create a new web worker that has model syncing capabilities built in.
 * Specify an AMD module to load that will `create` an object that will be proxied.
 */
export function createWebWorker<T extends object>(opts: IWebWorkerOptions): MonacoWebWorker<T> {
	return actualCreateWebWorker<T>(StandaloneServices.get(IModelService), StandaloneServices.get(ILanguageConfigurationService), opts);
}

/**
 * Colorize the contents of `domNode` using attribute `data-lang`.
 */
export function colorizeElement(domNode: HTMLElement, options: IColorizerElementOptions): Promise<void> {
	const languageService = StandaloneServices.get(ILanguageService);
	const themeService = <StandaloneThemeService>StandaloneServices.get(IStandaloneThemeService);
	return Colorizer.colorizeElement(themeService, languageService, domNode, options).then(() => {
		themeService.registerEditorContainer(domNode);
	});
}

/**
 * Colorize `text` using language `languageId`.
 */
export function colorize(text: string, languageId: string, options: IColorizerOptions): Promise<string> {
	const languageService = StandaloneServices.get(ILanguageService);
	const themeService = <StandaloneThemeService>StandaloneServices.get(IStandaloneThemeService);
	themeService.registerEditorContainer(document.body);
	return Colorizer.colorize(languageService, text, languageId, options);
}

/**
 * Colorize a line in a model.
 */
export function colorizeModelLine(model: ITextModel, lineNumber: number, tabSize: number = 4): string {
	const themeService = <StandaloneThemeService>StandaloneServices.get(IStandaloneThemeService);
	themeService.registerEditorContainer(document.body);
	return Colorizer.colorizeModelLine(model, lineNumber, tabSize);
}

/**
 * @internal
 */
function getSafeTokenizationSupport(language: string): Omit<languages.ITokenizationSupport, 'tokenizeEncoded'> {
	const tokenizationSupport = languages.TokenizationRegistry.get(language);
	if (tokenizationSupport) {
		return tokenizationSupport;
	}
	return {
		getInitialState: () => NullState,
		tokenize: (line: string, hasEOL: boolean, state: languages.IState) => nullTokenize(language, state)
	};
}

/**
 * Tokenize `text` using language `languageId`
 */
export function tokenize(text: string, languageId: string): languages.Token[][] {
	// Needed in order to get the mode registered for subsequent look-ups
	languages.TokenizationRegistry.getOrCreate(languageId);

	const tokenizationSupport = getSafeTokenizationSupport(languageId);
	const lines = splitLines(text);
	const result: languages.Token[][] = [];
	let state = tokenizationSupport.getInitialState();
	for (let i = 0, len = lines.length; i < len; i++) {
		const line = lines[i];
		const tokenizationResult = tokenizationSupport.tokenize(line, true, state);

		result[i] = tokenizationResult.tokens;
		state = tokenizationResult.endState;
	}
	return result;
}

/**
 * Define a new theme or update an existing theme.
 */
export function defineTheme(themeName: string, themeData: IStandaloneThemeData): void {
	const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
	standaloneThemeService.defineTheme(themeName, themeData);
}

/**
 * Switches to a theme.
 */
export function setTheme(themeName: string): void {
	const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
	standaloneThemeService.setTheme(themeName);
}

/**
 * Clears all cached font measurements and triggers re-measurement.
 */
export function remeasureFonts(): void {
	FontMeasurements.clearAllFontInfos();
}

/**
 * Register a command.
 */
export function registerCommand(id: string, handler: (accessor: any, ...args: any[]) => void): IDisposable {
	return CommandsRegistry.registerCommand({ id, handler });
}

export interface ILinkOpener {
	open(resource: URI): boolean | Promise<boolean>;
}

/**
 * Registers a handler that is called when a link is opened in any editor. The handler callback should return `true` if the link was handled and `false` otherwise.
 * The handler that was registered last will be called first when a link is opened.
 *
 * Returns a disposable that can unregister the opener again.
 */
export function registerLinkOpener(opener: ILinkOpener): IDisposable {
	const openerService = StandaloneServices.get(IOpenerService);
	return openerService.registerOpener({
		async open(resource: string | URI) {
			if (typeof resource === 'string') {
				resource = URI.parse(resource);
			}
			return opener.open(resource);
		}
	});
}

/**
 * Represents an object that can handle editor open operations (e.g. when "go to definition" is called
 * with a resource other than the current model).
 */
export interface ICodeEditorOpener {
	/**
	 * Callback that is invoked when a resource other than the current model should be opened (e.g. when "go to definition" is called).
	 * The callback should return `true` if the request was handled and `false` otherwise.
	 * @param source The code editor instance that initiated the request.
	 * @param resource The URI of the resource that should be opened.
	 * @param selectionOrPosition An optional position or selection inside the model corresponding to `resource` that can be used to set the cursor.
	 */
	openCodeEditor(source: ICodeEditor, resource: URI, selectionOrPosition?: IRange | IPosition): boolean | Promise<boolean>;
}

/**
 * Registers a handler that is called when a resource other than the current model should be opened in the editor (e.g. "go to definition").
 * The handler callback should return `true` if the request was handled and `false` otherwise.
 *
 * Returns a disposable that can unregister the opener again.
 *
 * If no handler is registered the default behavior is to do nothing for models other than the currently attached one.
 */
export function registerEditorOpener(opener: ICodeEditorOpener): IDisposable {
	const codeEditorService = StandaloneServices.get(ICodeEditorService);
	return codeEditorService.registerCodeEditorOpenHandler(async (input: ITextResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean) => {
		if (!source) {
			return null;
		}
		const selection = input.options?.selection;
		let selectionOrPosition: IRange | IPosition | undefined;
		if (selection && typeof selection.endLineNumber === 'number' && typeof selection.endColumn === 'number') {
			selectionOrPosition = <IRange>selection;
		} else if (selection) {
			selectionOrPosition = { lineNumber: selection.startLineNumber, column: selection.startColumn };
		}
		if (await opener.openCodeEditor(source, input.resource, selectionOrPosition)) {
			return source; // return source editor to indicate that this handler has successfully handled the opening
		}
		return null; // fallback to other registered handlers
	});
}

/**
 * @internal
 */
export function createMonacoEditorAPI(): typeof monaco.editor {
	return {
		// methods
		create: <any>create,
		getEditors: <any>getEditors,
		getDiffEditors: <any>getDiffEditors,
		onDidCreateEditor: <any>onDidCreateEditor,
		onDidCreateDiffEditor: <any>onDidCreateDiffEditor,
		createDiffEditor: <any>createDiffEditor,
		createDiffNavigator: <any>createDiffNavigator,

		addCommand: <any>addCommand,
		addEditorAction: <any>addEditorAction,
		addKeybindingRule: <any>addKeybindingRule,
		addKeybindingRules: <any>addKeybindingRules,

		createModel: <any>createModel,
		setModelLanguage: <any>setModelLanguage,
		setModelMarkers: <any>setModelMarkers,
		getModelMarkers: <any>getModelMarkers,
		removeAllMarkers: removeAllMarkers,
		onDidChangeMarkers: <any>onDidChangeMarkers,
		getModels: <any>getModels,
		getModel: <any>getModel,
		onDidCreateModel: <any>onDidCreateModel,
		onWillDisposeModel: <any>onWillDisposeModel,
		onDidChangeModelLanguage: <any>onDidChangeModelLanguage,


		createWebWorker: <any>createWebWorker,
		colorizeElement: <any>colorizeElement,
		colorize: <any>colorize,
		colorizeModelLine: <any>colorizeModelLine,
		tokenize: <any>tokenize,
		defineTheme: <any>defineTheme,
		setTheme: <any>setTheme,
		remeasureFonts: remeasureFonts,
		registerCommand: registerCommand,

		registerLinkOpener: registerLinkOpener,
		registerEditorOpener: <any>registerEditorOpener,

		// enums
		AccessibilitySupport: standaloneEnums.AccessibilitySupport,
		ContentWidgetPositionPreference: standaloneEnums.ContentWidgetPositionPreference,
		CursorChangeReason: standaloneEnums.CursorChangeReason,
		DefaultEndOfLine: standaloneEnums.DefaultEndOfLine,
		EditorAutoIndentStrategy: standaloneEnums.EditorAutoIndentStrategy,
		EditorOption: standaloneEnums.EditorOption,
		EndOfLinePreference: standaloneEnums.EndOfLinePreference,
		EndOfLineSequence: standaloneEnums.EndOfLineSequence,
		MinimapPosition: standaloneEnums.MinimapPosition,
		MouseTargetType: standaloneEnums.MouseTargetType,
		OverlayWidgetPositionPreference: standaloneEnums.OverlayWidgetPositionPreference,
		OverviewRulerLane: standaloneEnums.OverviewRulerLane,
		GlyphMarginLane: standaloneEnums.GlyphMarginLane,
		RenderLineNumbersType: standaloneEnums.RenderLineNumbersType,
		RenderMinimap: standaloneEnums.RenderMinimap,
		ScrollbarVisibility: standaloneEnums.ScrollbarVisibility,
		ScrollType: standaloneEnums.ScrollType,
		TextEditorCursorBlinkingStyle: standaloneEnums.TextEditorCursorBlinkingStyle,
		TextEditorCursorStyle: standaloneEnums.TextEditorCursorStyle,
		TrackedRangeStickiness: standaloneEnums.TrackedRangeStickiness,
		WrappingIndent: standaloneEnums.WrappingIndent,
		InjectedTextCursorStops: standaloneEnums.InjectedTextCursorStops,
		PositionAffinity: standaloneEnums.PositionAffinity,

		// classes
		ConfigurationChangedEvent: <any>ConfigurationChangedEvent,
		BareFontInfo: <any>BareFontInfo,
		FontInfo: <any>FontInfo,
		TextModelResolvedOptions: <any>TextModelResolvedOptions,
		FindMatch: <any>FindMatch,
		ApplyUpdateResult: <any>ApplyUpdateResult,
		LineRange: <any>LineRange,
		LineRangeMapping: <any>LineRangeMapping,
		RangeMapping: <any>RangeMapping,
		EditorZoom: <any>EditorZoom,
		MovedText: <any>MovedText,
		SimpleLineRangeMapping: <any>SimpleLineRangeMapping,

		// vars
		EditorType: EditorType,
		EditorOptions: <any>EditorOptions

	};
}
