/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/breakpointWidget';
import * as nls from 'vs/nls';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { SelectBox, ISelectOptionItem } from 'vs/base/browser/ui/selectBox/selectBox';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as dom from 'vs/base/browser/dom';
import { Position, IPosition } from 'vs/editor/common/core/position';
import { ICodeEditor, IActiveCodeEditor } from 'vs/editor/browser/editorBrowser';
import { ZoneWidget } from 'vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IDebugService, IBreakpoint, BreakpointWidgetContext as Context, CONTEXT_BREAKPOINT_WIDGET_VISIBLE, DEBUG_SCHEME, CONTEXT_IN_BREAKPOINT_WIDGET, IBreakpointUpdateData, IBreakpointEditorContribution, BREAKPOINT_EDITOR_CONTRIBUTION_ID } from 'vs/workbench/contrib/debug/common/debug';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { createDecorator, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor, EditorCommand, registerEditorCommand } from 'vs/editor/browser/editorExtensions';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { IModelService } from 'vs/editor/common/services/model';
import { URI as uri } from 'vs/base/common/uri';
import { CompletionList, CompletionContext, CompletionItemKind } from 'vs/editor/common/languages';
import { CancellationToken } from 'vs/base/common/cancellation';
import { ITextModel } from 'vs/editor/common/model';
import { provideSuggestionItems, CompletionOptions } from 'vs/editor/contrib/suggest/browser/suggest';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { editorForeground } from 'vs/platform/theme/common/colorRegistry';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IDecorationOptions } from 'vs/editor/common/editorCommon';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { getSimpleEditorOptions, getSimpleCodeEditorWidgetOptions } from 'vs/workbench/contrib/codeEditor/browser/simpleEditorOptions';
import { IRange, Range } from 'vs/editor/common/core/range';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEditorOptions, EditorOption } from 'vs/editor/common/config/editorOptions';
import { PLAINTEXT_LANGUAGE_ID } from 'vs/editor/common/languages/modesRegistry';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { defaultSelectBoxStyles } from 'vs/platform/theme/browser/defaultStyles';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';

const $ = dom.$;
const IPrivateBreakpointWidgetService = createDecorator<IPrivateBreakpointWidgetService>('privateBreakpointWidgetService');
interface IPrivateBreakpointWidgetService {
	readonly _serviceBrand: undefined;
	close(success: boolean): void;
}
const DECORATION_KEY = 'breakpointwidgetdecoration';

function isPositionInCurlyBracketBlock(input: IActiveCodeEditor): boolean {
	const model = input.getModel();
	const bracketPairs = model.bracketPairs.getBracketPairsInRange(Range.fromPositions(input.getPosition()));
	return bracketPairs.some(p => p.openingBracketInfo.bracketText === '{');
}

function createDecorations(theme: IColorTheme, placeHolder: string): IDecorationOptions[] {
	const transparentForeground = theme.getColor(editorForeground)?.transparent(0.4);
	return [{
		range: {
			startLineNumber: 0,
			endLineNumber: 0,
			startColumn: 0,
			endColumn: 1
		},
		renderOptions: {
			after: {
				contentText: placeHolder,
				color: transparentForeground ? transparentForeground.toString() : undefined
			}
		}
	}];
}

export class BreakpointWidget extends ZoneWidget implements IPrivateBreakpointWidgetService {
	declare readonly _serviceBrand: undefined;

	private selectContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private input!: IActiveCodeEditor;
	private toDispose: lifecycle.IDisposable[];
	private conditionInput = '';
	private hitCountInput = '';
	private logMessageInput = '';
	private breakpoint: IBreakpoint | undefined;
	private context: Context;
	private heightInPx: number | undefined;

	constructor(editor: ICodeEditor, private lineNumber: number, private column: number | undefined, context: Context | undefined,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IDebugService private readonly debugService: IDebugService,
		@IThemeService private readonly themeService: IThemeService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IModelService private readonly modelService: IModelService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
	) {
		super(editor, { showFrame: true, showArrow: false, frameWidth: 1, isAccessible: true });

		this.toDispose = [];
		const model = this.editor.getModel();
		if (model) {
			const uri = model.uri;
			const breakpoints = this.debugService.getModel().getBreakpoints({ lineNumber: this.lineNumber, column: this.column, uri });
			this.breakpoint = breakpoints.length ? breakpoints[0] : undefined;
		}

		if (context === undefined) {
			if (this.breakpoint && !this.breakpoint.condition && !this.breakpoint.hitCondition && this.breakpoint.logMessage) {
				this.context = Context.LOG_MESSAGE;
			} else if (this.breakpoint && !this.breakpoint.condition && this.breakpoint.hitCondition) {
				this.context = Context.HIT_COUNT;
			} else {
				this.context = Context.CONDITION;
			}
		} else {
			this.context = context;
		}

		this.toDispose.push(this.debugService.getModel().onDidChangeBreakpoints(e => {
			if (this.breakpoint && e && e.removed && e.removed.indexOf(this.breakpoint) >= 0) {
				this.dispose();
			}
		}));
		this.codeEditorService.registerDecorationType('breakpoint-widget', DECORATION_KEY, {});

		this.create();
	}

	private get placeholder(): string {
		const acceptString = this.keybindingService.lookupKeybinding(AcceptBreakpointWidgetInputAction.ID)?.getLabel() || 'Enter';
		const closeString = this.keybindingService.lookupKeybinding(CloseBreakpointWidgetCommand.ID)?.getLabel() || 'Escape';
		switch (this.context) {
			case Context.LOG_MESSAGE:
				return nls.localize('breakpointWidgetLogMessagePlaceholder', "Message to log when breakpoint is hit. Expressions within {} are interpolated. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
			case Context.HIT_COUNT:
				return nls.localize('breakpointWidgetHitCountPlaceholder', "Break when hit count condition is met. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
			default:
				return nls.localize('breakpointWidgetExpressionPlaceholder', "Break when expression evaluates to true. '{0}' to accept, '{1}' to cancel.", acceptString, closeString);
		}
	}

	private getInputValue(breakpoint: IBreakpoint | undefined): string {
		switch (this.context) {
			case Context.LOG_MESSAGE:
				return breakpoint && breakpoint.logMessage ? breakpoint.logMessage : this.logMessageInput;
			case Context.HIT_COUNT:
				return breakpoint && breakpoint.hitCondition ? breakpoint.hitCondition : this.hitCountInput;
			default:
				return breakpoint && breakpoint.condition ? breakpoint.condition : this.conditionInput;
		}
	}

	private rememberInput(): void {
		const value = this.input.getModel().getValue();
		switch (this.context) {
			case Context.LOG_MESSAGE:
				this.logMessageInput = value;
				break;
			case Context.HIT_COUNT:
				this.hitCountInput = value;
				break;
			default:
				this.conditionInput = value;
		}
	}

	private setInputMode(): void {
		if (this.editor.hasModel()) {
			// Use plaintext language for log messages, otherwise respect underlying editor language #125619
			const languageId = this.context === Context.LOG_MESSAGE ? PLAINTEXT_LANGUAGE_ID : this.editor.getModel().getLanguageId();
			this.input.getModel().setLanguage(languageId);
		}
	}

	override show(rangeOrPos: IRange | IPosition): void {
		const lineNum = this.input.getModel().getLineCount();
		super.show(rangeOrPos, lineNum + 1);
	}

	fitHeightToContent(): void {
		const lineNum = this.input.getModel().getLineCount();
		this._relayout(lineNum + 1);
	}

	protected _fillContainer(container: HTMLElement): void {
		this.setCssClass('breakpoint-widget');
		const selectBox = new SelectBox(<ISelectOptionItem[]>[{ text: nls.localize('expression', "Expression") }, { text: nls.localize('hitCount', "Hit Count") }, { text: nls.localize('logMessage', "Log Message") }], this.context, this.contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize('breakpointType', 'Breakpoint Type') });
		this.selectContainer = $('.breakpoint-select-container');
		selectBox.render(dom.append(container, this.selectContainer));
		selectBox.onDidSelect(e => {
			this.rememberInput();
			this.context = e.index;
			this.setInputMode();

			const value = this.getInputValue(this.breakpoint);
			this.input.getModel().setValue(value);
			this.input.focus();
		});

		this.inputContainer = $('.inputContainer');
		this.createBreakpointInput(dom.append(container, this.inputContainer));

		this.input.getModel().setValue(this.getInputValue(this.breakpoint));
		this.toDispose.push(this.input.getModel().onDidChangeContent(() => {
			this.fitHeightToContent();
		}));
		this.input.setPosition({ lineNumber: 1, column: this.input.getModel().getLineMaxColumn(1) });
		// Due to an electron bug we have to do the timeout, otherwise we do not get focus
		setTimeout(() => this.input.focus(), 150);
	}

	protected override _doLayout(heightInPixel: number, widthInPixel: number): void {
		this.heightInPx = heightInPixel;
		this.input.layout({ height: heightInPixel, width: widthInPixel - 113 });
		this.centerInputVertically();
	}

	protected override _onWidth(widthInPixel: number): void {
		if (typeof this.heightInPx === 'number') {
			this._doLayout(this.heightInPx, widthInPixel);
		}
	}

	private createBreakpointInput(container: HTMLElement): void {
		const scopedContextKeyService = this.contextKeyService.createScoped(container);
		this.toDispose.push(scopedContextKeyService);

		const scopedInstatiationService = this.instantiationService.createChild(new ServiceCollection(
			[IContextKeyService, scopedContextKeyService], [IPrivateBreakpointWidgetService, this]));

		const options = this.createEditorOptions();
		const codeEditorWidgetOptions = getSimpleCodeEditorWidgetOptions();
		this.input = <IActiveCodeEditor>scopedInstatiationService.createInstance(CodeEditorWidget, container, options, codeEditorWidgetOptions);
		CONTEXT_IN_BREAKPOINT_WIDGET.bindTo(scopedContextKeyService).set(true);
		const model = this.modelService.createModel('', null, uri.parse(`${DEBUG_SCHEME}:${this.editor.getId()}:breakpointinput`), true);
		if (this.editor.hasModel()) {
			model.setLanguage(this.editor.getModel().getLanguageId());
		}
		this.input.setModel(model);
		this.setInputMode();
		this.toDispose.push(model);
		const setDecorations = () => {
			const value = this.input.getModel().getValue();
			const decorations = !!value ? [] : createDecorations(this.themeService.getColorTheme(), this.placeholder);
			this.input.setDecorationsByType('breakpoint-widget', DECORATION_KEY, decorations);
		};
		this.input.getModel().onDidChangeContent(() => setDecorations());
		this.themeService.onDidColorThemeChange(() => setDecorations());

		this.toDispose.push(this.languageFeaturesService.completionProvider.register({ scheme: DEBUG_SCHEME, hasAccessToAllModels: true }, {
			_debugDisplayName: 'breakpointWidget',
			provideCompletionItems: (model: ITextModel, position: Position, _context: CompletionContext, token: CancellationToken): Promise<CompletionList> => {
				let suggestionsPromise: Promise<CompletionList>;
				const underlyingModel = this.editor.getModel();
				if (underlyingModel && (this.context === Context.CONDITION || (this.context === Context.LOG_MESSAGE && isPositionInCurlyBracketBlock(this.input)))) {
					suggestionsPromise = provideSuggestionItems(this.languageFeaturesService.completionProvider, underlyingModel, new Position(this.lineNumber, 1), new CompletionOptions(undefined, new Set<CompletionItemKind>().add(CompletionItemKind.Snippet)), _context, token).then(suggestions => {

						let overwriteBefore = 0;
						if (this.context === Context.CONDITION) {
							overwriteBefore = position.column - 1;
						} else {
							// Inside the currly brackets, need to count how many useful characters are behind the position so they would all be taken into account
							const value = this.input.getModel().getValue();
							while ((position.column - 2 - overwriteBefore >= 0) && value[position.column - 2 - overwriteBefore] !== '{' && value[position.column - 2 - overwriteBefore] !== ' ') {
								overwriteBefore++;
							}
						}

						return {
							suggestions: suggestions.items.map(s => {
								s.completion.range = Range.fromPositions(position.delta(0, -overwriteBefore), position);
								return s.completion;
							})
						};
					});
				} else {
					suggestionsPromise = Promise.resolve({ suggestions: [] });
				}

				return suggestionsPromise;
			}
		}));

		this.toDispose.push(this._configurationService.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('editor.fontSize') || e.affectsConfiguration('editor.lineHeight')) {
				this.input.updateOptions(this.createEditorOptions());
				this.centerInputVertically();
			}
		}));
	}

	private createEditorOptions(): IEditorOptions {
		const editorConfig = this._configurationService.getValue<IEditorOptions>('editor');
		const options = getSimpleEditorOptions(this._configurationService);
		options.fontSize = editorConfig.fontSize;
		options.fontFamily = editorConfig.fontFamily;
		options.lineHeight = editorConfig.lineHeight;
		options.fontLigatures = editorConfig.fontLigatures;
		options.ariaLabel = this.placeholder;
		return options;
	}

	private centerInputVertically() {
		if (this.container && typeof this.heightInPx === 'number') {
			const lineHeight = this.input.getOption(EditorOption.lineHeight);
			const lineNum = this.input.getModel().getLineCount();
			const newTopMargin = (this.heightInPx - lineNum * lineHeight) / 2;
			this.inputContainer.style.marginTop = newTopMargin + 'px';
		}
	}

	close(success: boolean): void {
		if (success) {
			// if there is already a breakpoint on this location - remove it.

			let condition = this.breakpoint && this.breakpoint.condition;
			let hitCondition = this.breakpoint && this.breakpoint.hitCondition;
			let logMessage = this.breakpoint && this.breakpoint.logMessage;
			this.rememberInput();

			if (this.conditionInput || this.context === Context.CONDITION) {
				condition = this.conditionInput;
			}
			if (this.hitCountInput || this.context === Context.HIT_COUNT) {
				hitCondition = this.hitCountInput;
			}
			if (this.logMessageInput || this.context === Context.LOG_MESSAGE) {
				logMessage = this.logMessageInput;
			}

			if (this.breakpoint) {
				const data = new Map<string, IBreakpointUpdateData>();
				data.set(this.breakpoint.getId(), {
					condition,
					hitCondition,
					logMessage
				});
				this.debugService.updateBreakpoints(this.breakpoint.originalUri, data, false).then(undefined, onUnexpectedError);
			} else {
				const model = this.editor.getModel();
				if (model) {
					this.debugService.addBreakpoints(model.uri, [{
						lineNumber: this.lineNumber,
						column: this.column,
						enabled: true,
						condition,
						hitCondition,
						logMessage
					}]);
				}
			}
		}

		this.dispose();
	}

	override dispose(): void {
		super.dispose();
		this.input.dispose();
		lifecycle.dispose(this.toDispose);
		setTimeout(() => this.editor.focus(), 0);
	}
}

class AcceptBreakpointWidgetInputAction extends EditorCommand {
	static ID = 'breakpointWidget.action.acceptInput';
	constructor() {
		super({
			id: AcceptBreakpointWidgetInputAction.ID,
			precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
			kbOpts: {
				kbExpr: CONTEXT_IN_BREAKPOINT_WIDGET,
				primary: KeyCode.Enter,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor): void {
		accessor.get(IPrivateBreakpointWidgetService).close(true);
	}
}

class CloseBreakpointWidgetCommand extends EditorCommand {
	static ID = 'closeBreakpointWidget';
	constructor() {
		super({
			id: CloseBreakpointWidgetCommand.ID,
			precondition: CONTEXT_BREAKPOINT_WIDGET_VISIBLE,
			kbOpts: {
				kbExpr: EditorContextKeys.textInputFocus,
				primary: KeyCode.Escape,
				secondary: [KeyMod.Shift | KeyCode.Escape],
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor, args: any): void {
		const debugContribution = editor.getContribution<IBreakpointEditorContribution>(BREAKPOINT_EDITOR_CONTRIBUTION_ID);
		if (debugContribution) {
			// if focus is in outer editor we need to use the debug contribution to close
			return debugContribution.closeBreakpointWidget();
		}

		accessor.get(IPrivateBreakpointWidgetService).close(false);
	}
}

registerEditorCommand(new AcceptBreakpointWidgetInputAction());
registerEditorCommand(new CloseBreakpointWidgetCommand());
