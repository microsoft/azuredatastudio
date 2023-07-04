/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./interactiveEditor';
import { DisposableStore, MutableDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { IActiveCodeEditor, ICodeEditor, IDiffEditorConstructionOptions } from 'vs/editor/browser/editorBrowser';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { Range } from 'vs/editor/common/core/range';
import { localize } from 'vs/nls';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ZoneWidget } from 'vs/editor/contrib/zoneWidget/browser/zoneWidget';
import { CTX_INTERACTIVE_EDITOR_FOCUSED, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_FIRST, CTX_INTERACTIVE_EDITOR_INNER_CURSOR_LAST, CTX_INTERACTIVE_EDITOR_EMPTY, CTX_INTERACTIVE_EDITOR_OUTER_CURSOR_POSITION, CTX_INTERACTIVE_EDITOR_VISIBLE, MENU_INTERACTIVE_EDITOR_WIDGET, MENU_INTERACTIVE_EDITOR_WIDGET_STATUS, MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE, CTX_INTERACTIVE_EDITOR_MESSAGE_CROP_STATE, IInteractiveEditorSlashCommand, MENU_INTERACTIVE_EDITOR_WIDGET_FEEDBACK, ACTION_ACCEPT_CHANGES } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IModelDeltaDecoration, ITextModel } from 'vs/editor/common/model';
import { Dimension, addDisposableListener, getActiveElement, getTotalHeight, getTotalWidth, h, reset } from 'vs/base/browser/dom';
import { Emitter, Event, MicrotaskEmitter } from 'vs/base/common/event';
import { IEditorConstructionOptions } from 'vs/editor/browser/config/editorConfiguration';
import { ICodeEditorWidgetOptions } from 'vs/editor/browser/widget/codeEditorWidget';
import { EditorExtensionsRegistry } from 'vs/editor/browser/editorExtensions';
import { SnippetController2 } from 'vs/editor/contrib/snippet/browser/snippetController2';
import { IModelService } from 'vs/editor/common/services/model';
import { URI } from 'vs/base/common/uri';
import { EmbeddedCodeEditorWidget, EmbeddedDiffEditorWidget } from 'vs/editor/browser/widget/embeddedCodeEditorWidget';
import { HiddenItemStrategy, MenuWorkbenchToolBar } from 'vs/platform/actions/browser/toolbar';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { SuggestController } from 'vs/editor/contrib/suggest/browser/suggestController';
import { IPosition, Position } from 'vs/editor/common/core/position';
import { DEFAULT_FONT_FAMILY } from 'vs/workbench/browser/style';
import { DropdownWithDefaultActionViewItem, IMenuEntryActionViewItemOptions, MenuEntryActionViewItem, createActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { CompletionItem, CompletionItemInsertTextRule, CompletionItemKind, CompletionItemProvider, CompletionList, ProviderResult, TextEdit } from 'vs/editor/common/languages';
import { EditOperation, ISingleEditOperation } from 'vs/editor/common/core/editOperation';
import { ILanguageSelection, ILanguageService } from 'vs/editor/common/languages/language';
import { ResourceLabel } from 'vs/workbench/browser/labels';
import { FileKind } from 'vs/platform/files/common/files';
import { IAction } from 'vs/base/common/actions';
import { IActionViewItemOptions } from 'vs/base/browser/ui/actionbar/actionViewItems';
import { ILanguageFeaturesService } from 'vs/editor/common/services/languageFeatures';
import { LanguageSelector } from 'vs/editor/common/languageSelector';
import { createTextBufferFactoryFromSnapshot } from 'vs/editor/common/model/textModel';
import { LineRangeMapping } from 'vs/editor/common/diff/linesDiffComputer';
import { invertLineRange, lineRangeAsRange } from 'vs/workbench/contrib/interactiveEditor/browser/utils';
import { ICodeEditorViewState, ScrollType } from 'vs/editor/common/editorCommon';
import { LineRange } from 'vs/editor/common/core/lineRange';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { MenuItemAction, SubmenuItemAction } from 'vs/platform/actions/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { AccessibilityVerbositySettingId } from 'vs/workbench/contrib/accessibility/browser/accessibilityContribution';
import { assertType } from 'vs/base/common/types';
import { renderLabelWithIcons } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { IdleValue } from 'vs/base/common/async';

const defaultAriaLabel = localize('aria-label', "Interactive Editor Input");

const _inputEditorOptions: IEditorConstructionOptions = {
	padding: { top: 3, bottom: 2 },
	overviewRulerLanes: 0,
	glyphMargin: false,
	lineNumbers: 'off',
	folding: false,
	hideCursorInOverviewRuler: true,
	selectOnLineNumbers: false,
	selectionHighlight: false,
	scrollbar: {
		useShadows: false,
		vertical: 'hidden',
		horizontal: 'auto',
		alwaysConsumeMouseWheel: false
	},
	lineDecorationsWidth: 0,
	overviewRulerBorder: false,
	scrollBeyondLastLine: false,
	renderLineHighlight: 'none',
	fixedOverflowWidgets: true,
	dragAndDrop: false,
	revealHorizontalRightPadding: 5,
	minimap: { enabled: false },
	guides: { indentation: false },
	rulers: [],
	cursorWidth: 1,
	cursorStyle: 'line',
	cursorBlinking: 'blink',
	wrappingStrategy: 'advanced',
	wrappingIndent: 'none',
	renderWhitespace: 'none',
	dropIntoEditor: { enabled: true },
	quickSuggestions: false,
	suggest: {
		showIcons: false,
		showSnippets: false,
		showStatusBar: false,
	},
	wordWrap: 'on',
	ariaLabel: defaultAriaLabel,
	fontFamily: DEFAULT_FONT_FAMILY,
	fontSize: 13,
	lineHeight: 20,
};

const _previewEditorEditorOptions: IDiffEditorConstructionOptions = {
	scrollbar: { useShadows: false, alwaysConsumeMouseWheel: false },
	renderMarginRevertIcon: false,
	diffCodeLens: false,
	scrollBeyondLastLine: false,
	stickyScroll: { enabled: false },
	originalAriaLabel: localize('original', 'Original'),
	modifiedAriaLabel: localize('modified', 'Modified'),
	diffAlgorithm: 'advanced',
	readOnly: true,
	isInEmbeddedEditor: true
};

export interface InteractiveEditorWidgetViewState {
	editorViewState: ICodeEditorViewState;
	input: string;
	placeholder: string;
}

export class InteractiveEditorWidget {

	private static _modelPool: number = 1;

	private readonly _elements = h(
		'div.interactive-editor@root',
		[
			h('div.body', [
				h('div.content@content', [
					h('div.input@input', [
						h('div.editor-placeholder@placeholder'),
						h('div.editor-container@editor'),
					]),
					h('div.toolbar@editorToolbar'),
				]),
			]),
			h('div.progress@progress'),
			h('div.previewDiff.hidden@previewDiff'),
			h('div.previewCreateTitle.show-file-icons@previewCreateTitle'),
			h('div.previewCreate.hidden@previewCreate'),
			h('div.status@status', [
				h('div.label.info.hidden@infoLabel'),
				h('div.actions.hidden@statusToolbar'),
				h('div.label.status.hidden@statusLabel'),
				h('div.actions.hidden@feedbackToolbar'),
			]),
			h('div.markdownMessage.hidden@markdownMessage', [
				h('div.message@message'),
				h('div.messageActions@messageActions')
			]),
		]
	);

	private readonly _store = new DisposableStore();
	private readonly _slashCommands = this._store.add(new DisposableStore());

	private readonly _inputEditor: IActiveCodeEditor;
	private readonly _inputModel: ITextModel;
	private readonly _ctxInputEmpty: IContextKey<boolean>;
	private readonly _ctxMessageCropState: IContextKey<'cropped' | 'not_cropped' | 'expanded'>;
	private readonly _ctxInnerCursorFirst: IContextKey<boolean>;
	private readonly _ctxInnerCursorLast: IContextKey<boolean>;
	private readonly _ctxInputEditorFocused: IContextKey<boolean>;

	private readonly _progressBar: ProgressBar;

	private readonly _previewDiffEditor: IdleValue<EmbeddedDiffEditorWidget>;
	private readonly _previewDiffModel = this._store.add(new MutableDisposable());

	private readonly _previewCreateTitle: ResourceLabel;
	private readonly _previewCreateEditor: IdleValue<ICodeEditor>;
	private readonly _previewCreateModel = this._store.add(new MutableDisposable());

	private readonly _onDidChangeHeight = new MicrotaskEmitter<void>();
	readonly onDidChangeHeight: Event<void> = Event.filter(this._onDidChangeHeight.event, _ => !this._isLayouting);

	private readonly _onDidChangeInput = new Emitter<this>();
	readonly onDidChangeInput: Event<this> = this._onDidChangeInput.event;

	private _lastDim: Dimension | undefined;
	private _isLayouting: boolean = false;

	constructor(
		parentEditor: ICodeEditor,
		@IModelService private readonly _modelService: IModelService,
		@ILanguageService private readonly _languageService: ILanguageService,
		@IContextKeyService private readonly _contextKeyService: IContextKeyService,
		@ILanguageFeaturesService private readonly _languageFeaturesService: ILanguageFeaturesService,
		@IKeybindingService private readonly _keybindingService: IKeybindingService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IAccessibilityService private readonly _accessibilityService: IAccessibilityService,
		@IConfigurationService private readonly _configurationService: IConfigurationService
	) {

		// input editor logic
		const codeEditorWidgetOptions: ICodeEditorWidgetOptions = {
			isSimpleWidget: true,
			contributions: EditorExtensionsRegistry.getSomeEditorContributions([
				SnippetController2.ID,
				SuggestController.ID
			])
		};

		this._inputEditor = <IActiveCodeEditor>this._instantiationService.createInstance(EmbeddedCodeEditorWidget, this._elements.editor, _inputEditorOptions, codeEditorWidgetOptions, parentEditor);
		this._updateAriaLabel();
		this._store.add(this._inputEditor);
		this._store.add(this._inputEditor.onDidChangeModelContent(() => this._onDidChangeInput.fire(this)));
		this._store.add(this._inputEditor.onDidLayoutChange(() => this._onDidChangeHeight.fire()));
		this._store.add(this._inputEditor.onDidContentSizeChange(() => this._onDidChangeHeight.fire()));
		this._store.add(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(AccessibilityVerbositySettingId.InteractiveEditor)) {
				this._updateAriaLabel();
			}
		}));

		const uri = URI.from({ scheme: 'vscode', authority: 'interactive-editor', path: `/interactive-editor/model${InteractiveEditorWidget._modelPool++}.txt` });
		this._inputModel = this._modelService.getModel(uri) ?? this._modelService.createModel('', null, uri);
		this._inputEditor.setModel(this._inputModel);

		// --- context keys

		this._ctxMessageCropState = CTX_INTERACTIVE_EDITOR_MESSAGE_CROP_STATE.bindTo(this._contextKeyService);
		this._ctxInputEmpty = CTX_INTERACTIVE_EDITOR_EMPTY.bindTo(this._contextKeyService);

		this._ctxInnerCursorFirst = CTX_INTERACTIVE_EDITOR_INNER_CURSOR_FIRST.bindTo(this._contextKeyService);
		this._ctxInnerCursorLast = CTX_INTERACTIVE_EDITOR_INNER_CURSOR_LAST.bindTo(this._contextKeyService);
		this._ctxInputEditorFocused = CTX_INTERACTIVE_EDITOR_FOCUSED.bindTo(this._contextKeyService);

		// (1) inner cursor position (last/first line selected)
		const updateInnerCursorFirstLast = () => {
			const { lineNumber } = this._inputEditor.getPosition();
			this._ctxInnerCursorFirst.set(lineNumber === 1);
			this._ctxInnerCursorLast.set(lineNumber === this._inputModel.getLineCount());
		};
		this._store.add(this._inputEditor.onDidChangeCursorPosition(updateInnerCursorFirstLast));
		updateInnerCursorFirstLast();

		// (2) input editor focused or not
		const updateFocused = () => {
			const hasFocus = this._inputEditor.hasWidgetFocus();
			this._ctxInputEditorFocused.set(hasFocus);
			this._elements.content.classList.toggle('synthetic-focus', hasFocus);
		};
		this._store.add(this._inputEditor.onDidFocusEditorWidget(updateFocused));
		this._store.add(this._inputEditor.onDidBlurEditorWidget(updateFocused));
		this._store.add(toDisposable(() => {
			this._ctxInnerCursorFirst.reset();
			this._ctxInnerCursorLast.reset();
			this._ctxInputEditorFocused.reset();
		}));
		updateFocused();

		// placeholder

		this._elements.placeholder.style.fontSize = `${this._inputEditor.getOption(EditorOption.fontSize)}px`;
		this._elements.placeholder.style.lineHeight = `${this._inputEditor.getOption(EditorOption.lineHeight)}px`;
		this._store.add(addDisposableListener(this._elements.placeholder, 'click', () => this._inputEditor.focus()));

		// show/hide placeholder depending on text model being empty
		// content height

		const currentContentHeight = 0;

		const togglePlaceholder = () => {
			const hasText = this._inputModel.getValueLength() > 0;
			this._elements.placeholder.classList.toggle('hidden', hasText);
			this._ctxInputEmpty.set(!hasText);

			const contentHeight = this._inputEditor.getContentHeight();
			if (contentHeight !== currentContentHeight && this._lastDim) {
				this._lastDim = this._lastDim.with(undefined, contentHeight);
				this._inputEditor.layout(this._lastDim);
				this._onDidChangeHeight.fire();
			}
		};
		this._store.add(this._inputModel.onDidChangeContent(togglePlaceholder));
		togglePlaceholder();

		// toolbars

		const toolbar = this._instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.editorToolbar, MENU_INTERACTIVE_EDITOR_WIDGET, {
			telemetrySource: 'interactiveEditorWidget-toolbar',
			toolbarOptions: { primaryGroup: 'main' }
		});
		this._store.add(toolbar);

		this._progressBar = new ProgressBar(this._elements.progress);
		this._store.add(this._progressBar);

		const workbenchToolbarOptions = {
			hiddenItemStrategy: HiddenItemStrategy.NoHide,
			toolbarOptions: {
				primaryGroup: () => true,
				useSeparatorsInPrimaryActions: true
			},
			actionViewItemProvider: (action: IAction, options: IActionViewItemOptions) => {

				if (action instanceof SubmenuItemAction) {
					return this._instantiationService.createInstance(DropdownWithDefaultActionViewItem, action, { ...options, renderKeybindingWithDefaultActionLabel: true, persistLastActionId: false });
				}

				if (action.id === ACTION_ACCEPT_CHANGES) {
					const ButtonLikeActionViewItem = class extends MenuEntryActionViewItem {

						override render(container: HTMLElement): void {
							this.options.icon = false;
							super.render(container);
							assertType(this.element);
							this.element.classList.add('button-item');
						}

						protected override updateLabel(): void {
							assertType(this.label);
							assertType(this.action instanceof MenuItemAction);
							const label = MenuItemAction.label(this.action.item, { renderShortTitle: true });
							const labelElements = renderLabelWithIcons(`$(check)${label}`);
							reset(this.label, ...labelElements);
						}

						protected override updateClass(): void {
							// noop
						}
					};
					return this._instantiationService.createInstance(ButtonLikeActionViewItem, <MenuItemAction>action, <IMenuEntryActionViewItemOptions>options);
				}

				return createActionViewItem(this._instantiationService, action, options);
			}
		};
		const statusToolbar = this._instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.statusToolbar, MENU_INTERACTIVE_EDITOR_WIDGET_STATUS, { ...workbenchToolbarOptions, hiddenItemStrategy: HiddenItemStrategy.Ignore });
		this._store.add(statusToolbar.onDidChangeMenuItems(() => this._onDidChangeHeight.fire()));
		this._store.add(statusToolbar);

		const feedbackToolbar = this._instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.feedbackToolbar, MENU_INTERACTIVE_EDITOR_WIDGET_FEEDBACK, { ...workbenchToolbarOptions, hiddenItemStrategy: HiddenItemStrategy.Ignore });
		this._store.add(feedbackToolbar.onDidChangeMenuItems(() => this._onDidChangeHeight.fire()));
		this._store.add(feedbackToolbar);

		// preview editors
		this._previewDiffEditor = new IdleValue(() => this._store.add(_instantiationService.createInstance(EmbeddedDiffEditorWidget, this._elements.previewDiff, _previewEditorEditorOptions, { modifiedEditor: codeEditorWidgetOptions, originalEditor: codeEditorWidgetOptions }, parentEditor)));

		this._previewCreateTitle = this._store.add(_instantiationService.createInstance(ResourceLabel, this._elements.previewCreateTitle, { supportIcons: true }));
		this._previewCreateEditor = new IdleValue(() => this._store.add(_instantiationService.createInstance(EmbeddedCodeEditorWidget, this._elements.previewCreate, _previewEditorEditorOptions, codeEditorWidgetOptions, parentEditor)));

		this._elements.message.tabIndex = 0;
		this._elements.statusLabel.tabIndex = 0;
		const markdownMessageToolbar = this._instantiationService.createInstance(MenuWorkbenchToolBar, this._elements.messageActions, MENU_INTERACTIVE_EDITOR_WIDGET_MARKDOWN_MESSAGE, workbenchToolbarOptions);
		this._store.add(markdownMessageToolbar.onDidChangeMenuItems(() => this._onDidChangeHeight.fire()));
		this._store.add(markdownMessageToolbar);
	}

	private _updateAriaLabel(): void {
		if (!this._accessibilityService.isScreenReaderOptimized()) {
			return;
		}
		let label = defaultAriaLabel;
		if (this._configurationService.getValue<boolean>(AccessibilityVerbositySettingId.InteractiveEditor)) {
			const kbLabel = this._keybindingService.lookupKeybinding('interactiveEditor.accessibilityHelp')?.getLabel();
			label = kbLabel ? localize('interactiveEditor.accessibilityHelp', "Interactive Editor Input, Use {0} for Interactive Editor Accessibility Help.", kbLabel) : localize('interactiveSessionInput.accessibilityHelpNoKb', "Interactive Editor Input, Run the Interactive Editor Accessibility Help command for more information.");
		}
		_inputEditorOptions.ariaLabel = label;
		this._inputEditor.updateOptions({ ariaLabel: label });
	}

	dispose(): void {
		this._store.dispose();
		this._ctxInputEmpty.reset();
		this._ctxMessageCropState.reset();
	}

	get domNode(): HTMLElement {
		return this._elements.root;
	}

	layout(dim: Dimension) {
		this._isLayouting = true;
		try {
			const innerEditorWidth = dim.width - (getTotalWidth(this._elements.editorToolbar) + 8 /* L/R-padding */);
			dim = new Dimension(innerEditorWidth, dim.height);
			if (!this._lastDim || !Dimension.equals(this._lastDim, dim)) {
				this._lastDim = dim;
				this._inputEditor.layout(new Dimension(innerEditorWidth, this._inputEditor.getContentHeight()));
				this._elements.placeholder.style.width = `${innerEditorWidth  /* input-padding*/}px`;

				const previewDiffDim = new Dimension(dim.width, Math.min(300, Math.max(0, this._previewDiffEditor.value.getContentHeight())));
				this._previewDiffEditor.value.layout(previewDiffDim);
				this._elements.previewDiff.style.height = `${previewDiffDim.height}px`;

				const previewCreateDim = new Dimension(dim.width, Math.min(300, Math.max(0, this._previewCreateEditor.value.getContentHeight())));
				this._previewCreateEditor.value.layout(previewCreateDim);
				this._elements.previewCreate.style.height = `${previewCreateDim.height}px`;
			}
		} finally {
			this._isLayouting = false;
		}
	}

	getHeight(): number {
		const base = getTotalHeight(this._elements.progress) + getTotalHeight(this._elements.status);
		const editorHeight = this._inputEditor.getContentHeight() + 12 /* padding and border */;
		const markdownMessageHeight = getTotalHeight(this._elements.markdownMessage);
		const previewDiffHeight = this._previewDiffEditor.value.getModel().modified ? 12 + Math.min(300, Math.max(0, this._previewDiffEditor.value.getContentHeight())) : 0;
		const previewCreateTitleHeight = getTotalHeight(this._elements.previewCreateTitle);
		const previewCreateHeight = this._previewCreateEditor.value.getModel() ? 18 + Math.min(300, Math.max(0, this._previewCreateEditor.value.getContentHeight())) : 0;
		return base + editorHeight + markdownMessageHeight + previewDiffHeight + previewCreateTitleHeight + previewCreateHeight + 18 /* padding */ + 8 /*shadow*/;
	}

	updateProgress(show: boolean) {
		if (show) {
			this._progressBar.infinite();
		} else {
			this._progressBar.stop();
		}
	}

	get value(): string {
		return this._inputModel.getValue();
	}

	set value(value: string) {
		this._inputModel.setValue(value);
		this._inputEditor.setPosition(this._inputModel.getFullModelRange().getEndPosition());
	}

	selectAll() {
		this._inputEditor.setSelection(this._inputModel.getFullModelRange());
	}

	set placeholder(value: string) {
		this._elements.placeholder.innerText = value;
	}

	updateToolbar(show: boolean) {
		this._elements.statusToolbar.classList.toggle('hidden', !show);
		this._elements.feedbackToolbar.classList.toggle('hidden', !show);
		this._elements.status.classList.toggle('actions', show);
		this._elements.infoLabel.classList.toggle('hidden', show);
		this._onDidChangeHeight.fire();
	}

	updateMarkdownMessage(message: Node | undefined) {
		this._elements.markdownMessage.classList.toggle('hidden', !message);
		if (!message) {
			this._ctxMessageCropState.reset();
			reset(this._elements.message);

		} else {
			reset(this._elements.message, message);
			if (this._elements.message.scrollHeight > this._elements.message.clientHeight) {
				this._ctxMessageCropState.set('cropped');
			} else {
				this._ctxMessageCropState.set('not_cropped');
			}
		}
		this._onDidChangeHeight.fire();
	}

	updateInfo(message: string): void {
		this._elements.infoLabel.classList.toggle('hidden', !message);
		this._elements.infoLabel.innerText = message;
		this._onDidChangeHeight.fire();
	}

	updateStatus(message: string, ops: { classes?: string[]; resetAfter?: number; keepMessage?: boolean } = {}) {
		const isTempMessage = typeof ops.resetAfter === 'number';
		if (isTempMessage && !this._elements.statusLabel.dataset['state']) {
			const statusLabel = this._elements.statusLabel.innerText;
			const classes = Array.from(this._elements.statusLabel.classList.values());
			setTimeout(() => {
				this.updateStatus(statusLabel, { classes, keepMessage: true });
			}, ops.resetAfter);
		}
		reset(this._elements.statusLabel, message);
		this._elements.statusLabel.className = `label status ${(ops.classes ?? []).join(' ')}`;
		this._elements.statusLabel.classList.toggle('hidden', !message);
		if (isTempMessage) {
			this._elements.statusLabel.dataset['state'] = 'temp';
		} else {
			delete this._elements.statusLabel.dataset['state'];
		}
		this._onDidChangeHeight.fire();
	}

	reset() {
		this._ctxInputEmpty.reset();
		this._ctxInnerCursorFirst.reset();
		this._ctxInnerCursorLast.reset();
		this._ctxInputEditorFocused.reset();

		this.value = '';
		this.updateMarkdownMessage(undefined);

		reset(this._elements.statusLabel);
		this._elements.statusLabel.classList.toggle('hidden', true);
		this._elements.statusToolbar.classList.add('hidden');
		this._elements.feedbackToolbar.classList.add('hidden');
		this.hideCreatePreview();
		this.hideEditsPreview();
		this._onDidChangeHeight.fire();
	}

	focus() {
		this._inputEditor.focus();
	}

	hasFocus() {
		return this.domNode.contains(getActiveElement());
	}

	updateMarkdownMessageExpansionState(expand: boolean) {
		this._ctxMessageCropState.set(expand ? 'expanded' : 'cropped');
		this._elements.message.style.webkitLineClamp = expand ? '10' : '3';
		this._onDidChangeHeight.fire();
	}

	// --- preview

	showEditsPreview(textModelv0: ITextModel, edits: ISingleEditOperation[], changes: LineRangeMapping[]) {
		if (changes.length === 0) {
			this.hideEditsPreview();
			return;
		}

		this._elements.previewDiff.classList.remove('hidden');

		const languageSelection: ILanguageSelection = { languageId: textModelv0.getLanguageId(), onDidChange: Event.None };
		const modified = this._modelService.createModel(createTextBufferFactoryFromSnapshot(textModelv0.createSnapshot()), languageSelection, undefined, true);
		modified.applyEdits(edits, false);
		this._previewDiffEditor.value.setModel({ original: textModelv0, modified });

		// joined ranges
		let originalLineRange = changes[0].originalRange;
		let modifiedLineRange = changes[0].modifiedRange;
		for (let i = 1; i < changes.length; i++) {
			originalLineRange = originalLineRange.join(changes[i].originalRange);
			modifiedLineRange = modifiedLineRange.join(changes[i].modifiedRange);
		}

		// apply extra padding
		const pad = 3;
		const newStartLine = Math.max(1, originalLineRange.startLineNumber - pad);
		modifiedLineRange = new LineRange(newStartLine, modifiedLineRange.endLineNumberExclusive);
		originalLineRange = new LineRange(newStartLine, originalLineRange.endLineNumberExclusive);

		const newEndLineModified = Math.min(modifiedLineRange.endLineNumberExclusive + pad, modified.getLineCount());
		modifiedLineRange = new LineRange(modifiedLineRange.startLineNumber, newEndLineModified);
		const newEndLineOriginal = Math.min(originalLineRange.endLineNumberExclusive + pad, textModelv0.getLineCount());
		originalLineRange = new LineRange(originalLineRange.startLineNumber, newEndLineOriginal);

		const hiddenOriginal = invertLineRange(originalLineRange, textModelv0);
		const hiddenModified = invertLineRange(modifiedLineRange, modified);
		this._previewDiffEditor.value.getOriginalEditor().setHiddenAreas(hiddenOriginal.map(lineRangeAsRange), 'diff-hidden');
		this._previewDiffEditor.value.getModifiedEditor().setHiddenAreas(hiddenModified.map(lineRangeAsRange), 'diff-hidden');
		this._previewDiffEditor.value.revealLine(modifiedLineRange.startLineNumber, ScrollType.Immediate);

		this._onDidChangeHeight.fire();
	}

	hideEditsPreview() {
		this._elements.previewDiff.classList.add('hidden');
		this._previewDiffEditor.value.setModel(null);
		this._previewDiffModel.clear();
		this._onDidChangeHeight.fire();
	}

	showCreatePreview(uri: URI, edits: TextEdit[]): void {
		this._elements.previewCreateTitle.classList.remove('hidden');
		this._elements.previewCreate.classList.remove('hidden');

		this._previewCreateTitle.element.setFile(uri, { fileKind: FileKind.FILE });

		const langSelection = this._languageService.createByFilepathOrFirstLine(uri, undefined);
		const model = this._modelService.createModel('', langSelection, undefined, true);
		model.applyEdits(edits.map(edit => EditOperation.replace(Range.lift(edit.range), edit.text)));
		this._previewCreateModel.value = model;
		this._previewCreateEditor.value.setModel(model);
		this._onDidChangeHeight.fire();
	}

	hideCreatePreview() {
		this._elements.previewCreateTitle.classList.add('hidden');
		this._elements.previewCreate.classList.add('hidden');
		this._previewCreateEditor.value.setModel(null);
		this._previewCreateTitle.element.clear();
		this._onDidChangeHeight.fire();
	}

	showsAnyPreview() {
		return !this._elements.previewDiff.classList.contains('hidden') ||
			!this._elements.previewCreate.classList.contains('hidden');
	}

	// --- slash commands

	updateSlashCommands(commands: IInteractiveEditorSlashCommand[]) {

		this._slashCommands.clear();

		if (commands.length === 0) {
			return;
		}

		const selector: LanguageSelector = { scheme: this._inputModel.uri.scheme, pattern: this._inputModel.uri.path, language: this._inputModel.getLanguageId() };
		this._slashCommands.add(this._languageFeaturesService.completionProvider.register(selector, new class implements CompletionItemProvider {

			_debugDisplayName?: string = 'InteractiveEditorSlashCommandProvider';

			readonly triggerCharacters?: string[] = ['/'];

			provideCompletionItems(_model: ITextModel, position: Position): ProviderResult<CompletionList> {
				if (position.lineNumber !== 1 && position.column !== 1) {
					return undefined;
				}

				const suggestions: CompletionItem[] = commands.map(command => {

					const withSlash = `/${command.command}`;

					return {
						label: { label: withSlash, description: command.detail },
						insertText: `${withSlash} $0`,
						insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
						kind: CompletionItemKind.Text,
						range: new Range(1, 1, 1, 1),
					};
				});

				return { suggestions };
			}
		}));

		const decorations = this._inputEditor.createDecorationsCollection();

		const updateSlashDecorations = () => {
			const newDecorations: IModelDeltaDecoration[] = [];
			for (const command of commands) {
				const withSlash = `/${command.command}`;
				const firstLine = this._inputModel.getLineContent(1);
				if (firstLine.startsWith(withSlash)) {
					newDecorations.push({
						range: new Range(1, 1, 1, withSlash.length + 1),
						options: {
							description: 'interactive-editor-slash-command',
							inlineClassName: 'interactive-editor-slash-command',
						}
					});

					// inject detail when otherwise empty
					if (firstLine === `/${command.command} `) {
						newDecorations.push({
							range: new Range(1, withSlash.length + 1, 1, withSlash.length + 2),
							options: {
								description: 'interactive-editor-slash-command-detail',
								after: {
									content: `${command.detail}`,
									inlineClassName: 'interactive-editor-slash-command-detail'
								}
							}
						});
					}
					break;
				}
			}
			decorations.set(newDecorations);
		};

		this._slashCommands.add(this._inputEditor.onDidChangeModelContent(updateSlashDecorations));
		updateSlashDecorations();
	}
}

export class InteractiveEditorZoneWidget extends ZoneWidget {

	readonly widget: InteractiveEditorWidget;

	private readonly _ctxVisible: IContextKey<boolean>;
	private readonly _ctxCursorPosition: IContextKey<'above' | 'below' | ''>;
	private _dimension?: Dimension;

	constructor(
		editor: ICodeEditor,
		@IInstantiationService private readonly _instaService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		super(editor, { showFrame: false, showArrow: false, isAccessible: true, className: 'interactive-editor-widget', keepEditorSelection: true, showInHiddenAreas: true, ordinal: 10000 + 3 });

		this._ctxVisible = CTX_INTERACTIVE_EDITOR_VISIBLE.bindTo(contextKeyService);
		this._ctxCursorPosition = CTX_INTERACTIVE_EDITOR_OUTER_CURSOR_POSITION.bindTo(contextKeyService);

		this._disposables.add(toDisposable(() => {
			this._ctxVisible.reset();
			this._ctxCursorPosition.reset();
		}));

		this.widget = this._instaService.createInstance(InteractiveEditorWidget, this.editor);
		this._disposables.add(this.widget.onDidChangeHeight(() => this._relayout()));
		this._disposables.add(this.widget);
		this.create();


		// todo@jrieken listen ONLY when showing
		const updateCursorIsAboveContextKey = () => {
			if (!this.position || !this.editor.hasModel()) {
				this._ctxCursorPosition.reset();
			} else if (this.position.lineNumber === this.editor.getPosition().lineNumber) {
				this._ctxCursorPosition.set('above');
			} else if (this.position.lineNumber + 1 === this.editor.getPosition().lineNumber) {
				this._ctxCursorPosition.set('below');
			} else {
				this._ctxCursorPosition.reset();
			}
		};
		this._disposables.add(this.editor.onDidChangeCursorPosition(e => updateCursorIsAboveContextKey()));
		this._disposables.add(this.editor.onDidFocusEditorText(e => updateCursorIsAboveContextKey()));
		updateCursorIsAboveContextKey();
	}

	protected override _fillContainer(container: HTMLElement): void {
		container.appendChild(this.widget.domNode);
	}


	protected override _doLayout(heightInPixel: number): void {

		const info = this.editor.getLayoutInfo();
		const spaceLeft = info.lineNumbersWidth + info.glyphMarginWidth + info.decorationsWidth;
		const spaceRight = info.minimap.minimapWidth + info.verticalScrollbarWidth;

		const maxWidth = !this.widget.showsAnyPreview() ? 640 : Number.MAX_SAFE_INTEGER;
		const width = Math.min(maxWidth, info.contentWidth - (info.glyphMarginWidth + info.decorationsWidth));
		this._dimension = new Dimension(width, heightInPixel);
		this.widget.domNode.style.marginLeft = `${spaceLeft}px`;
		this.widget.domNode.style.marginRight = `${spaceRight}px`;
		this.widget.domNode.style.width = `${width}px`;
		this.widget.layout(this._dimension);
	}

	private _computeHeightInLines(): number {
		const lineHeight = this.editor.getOption(EditorOption.lineHeight);
		return this.widget.getHeight() / lineHeight;
	}

	protected override _relayout() {
		if (this._dimension) {
			this._doLayout(this._dimension.height);
		}
		super._relayout(this._computeHeightInLines());
	}

	override show(where: IPosition): void {
		super.show(where, this._computeHeightInLines());
		this.widget.focus();
		this._ctxVisible.set(true);
	}

	override hide(): void {
		this._ctxVisible.reset();
		this._ctxCursorPosition.reset();
		this.widget.reset();
		super.hide();
	}
}
