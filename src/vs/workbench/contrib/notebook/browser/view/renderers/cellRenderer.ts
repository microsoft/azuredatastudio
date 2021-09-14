/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getPixelRatio, getZoomLevel } from 'vs/base/browser/browser';
import * as DOM from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import * as aria from 'vs/base/browser/ui/aria/aria';
import { renderIcon } from 'vs/base/browser/ui/iconLabel/iconLabels';
import { IListRenderer, IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { ProgressBar } from 'vs/base/browser/ui/progressbar/progressbar';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { Action, IAction } from 'vs/base/common/actions';
import * as Codicons from 'vs/base/common/codicons';
import { Color } from 'vs/base/common/color';
import { combinedDisposable, Disposable, DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import * as platform from 'vs/base/common/platform';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { EditorOption, IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { Range } from 'vs/editor/common/core/range';
import { EditorContextKeys } from 'vs/editor/common/editorContextKeys';
import { ITextModel } from 'vs/editor/common/model';
import * as modes from 'vs/editor/common/modes';
import { tokenizeLineToHTML } from 'vs/editor/common/modes/textToHtmlTokenizer';
import { localize } from 'vs/nls';
import { DropdownWithPrimaryActionViewItem } from 'vs/platform/actions/browser/dropdownWithPrimaryActionViewItem';
import { createActionViewItem, createAndFillInActionBarActions, MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenu, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { syncing } from 'vs/platform/theme/common/iconRegistry';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { DeleteCellAction, INotebookActionContext, INotebookCellActionContext } from 'vs/workbench/contrib/notebook/browser/contrib/coreActions';
import { BaseCellRenderTemplate, CellEditState, CodeCellLayoutInfo, CodeCellRenderTemplate, EXPAND_CELL_INPUT_COMMAND_ID, ICellViewModel, INotebookEditor, isCodeCellRenderTemplate, MarkdownCellRenderTemplate } from 'vs/workbench/contrib/notebook/browser/notebookBrowser';
import { errorStateIcon, successStateIcon, unfoldIcon } from 'vs/workbench/contrib/notebook/browser/notebookIcons';
import { CodiconActionViewItem } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellActionView';
import { CellContextKeyManager } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellContextKeys';
import { CellDragAndDropController, DRAGGING_CLASS } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellDnd';
import { CellEditorOptions } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellEditorOptions';
import { CellMenus } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellMenus';
import { CellEditorStatusBar } from 'vs/workbench/contrib/notebook/browser/view/renderers/cellWidgets';
import { CodeCell } from 'vs/workbench/contrib/notebook/browser/view/renderers/codeCell';
import { StatefulMarkdownCell } from 'vs/workbench/contrib/notebook/browser/view/renderers/markdownCell';
import { CodeCellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/codeCellViewModel';
import { MarkdownCellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/markdownCellViewModel';
import { CellViewModel } from 'vs/workbench/contrib/notebook/browser/viewModel/notebookViewModel';
import { CellEditType, CellKind, NotebookCellExecutionState, NotebookCellInternalMetadata, NotebookCellMetadata } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { NotebookOptions } from 'vs/workbench/contrib/notebook/common/notebookOptions';

const $ = DOM.$;

export class NotebookCellListDelegate extends Disposable implements IListVirtualDelegate<CellViewModel> {
	private readonly lineHeight: number;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		const editorOptions = this.configurationService.getValue<IEditorOptions>('editor');
		this.lineHeight = BareFontInfo.createFromRawSettings(editorOptions, getZoomLevel(), getPixelRatio()).lineHeight;
	}

	getHeight(element: CellViewModel): number {
		return element.getHeight(this.lineHeight);
	}

	hasDynamicHeight(element: CellViewModel): boolean {
		return element.hasDynamicHeight();
	}

	getTemplateId(element: CellViewModel): string {
		if (element.cellKind === CellKind.Markup) {
			return MarkdownCellRenderer.TEMPLATE_ID;
		} else {
			return CodeCellRenderer.TEMPLATE_ID;
		}
	}
}

abstract class AbstractCellRenderer {
	protected readonly editorOptions: CellEditorOptions;
	protected readonly cellMenus: CellMenus;

	constructor(
		protected readonly instantiationService: IInstantiationService,
		protected readonly notebookEditor: INotebookEditor,
		protected readonly contextMenuService: IContextMenuService,
		configurationService: IConfigurationService,
		protected readonly keybindingService: IKeybindingService,
		protected readonly notificationService: INotificationService,
		protected readonly contextKeyServiceProvider: (container: HTMLElement) => IContextKeyService,
		language: string,
		protected dndController: CellDragAndDropController | undefined
	) {
		this.editorOptions = new CellEditorOptions(notebookEditor, notebookEditor.notebookOptions, configurationService, language);
		this.cellMenus = this.instantiationService.createInstance(CellMenus);
	}

	dispose() {
		this.editorOptions.dispose();
		this.dndController = undefined;
	}

	protected createBetweenCellToolbar(container: HTMLElement, disposables: DisposableStore, contextKeyService: IContextKeyService, notebookOptions: NotebookOptions): ToolBar {
		const toolbar = new ToolBar(container, this.contextMenuService, {
			actionViewItemProvider: action => {
				if (action instanceof MenuItemAction) {
					if (notebookOptions.getLayoutConfiguration().insertToolbarAlignment === 'center') {
						return new CodiconActionViewItem(action, this.keybindingService, this.notificationService);
					} else {
						return new MenuEntryActionViewItem(action, this.keybindingService, this.notificationService);
					}
				}

				return undefined;
			}
		});
		disposables.add(toolbar);

		const cellMenu = this.instantiationService.createInstance(CellMenus);
		const menu = disposables.add(cellMenu.getCellInsertionMenu(contextKeyService));
		const updateActions = () => {
			const actions = this.getCellToolbarActions(menu);
			toolbar.setActions(actions.primary, actions.secondary);
		};

		disposables.add(menu.onDidChange(() => updateActions()));
		disposables.add(notebookOptions.onDidChangeOptions((e) => {
			if (e.insertToolbarAlignment) {
				updateActions();
			}
		}));
		updateActions();

		return toolbar;
	}

	protected setBetweenCellToolbarContext(templateData: BaseCellRenderTemplate, element: CodeCellViewModel | MarkdownCellViewModel, context: INotebookCellActionContext): void {
		templateData.betweenCellToolbar.context = context;

		const container = templateData.bottomCellContainer;
		const bottomToolbarOffset = element.layoutInfo.bottomToolbarOffset;
		container.style.top = `${bottomToolbarOffset}px`;

		templateData.elementDisposables.add(element.onDidChangeLayout(() => {
			const bottomToolbarOffset = element.layoutInfo.bottomToolbarOffset;
			container.style.top = `${bottomToolbarOffset}px`;
		}));
	}

	protected createToolbar(container: HTMLElement, elementClass?: string): ToolBar {
		const toolbar = new ToolBar(container, this.contextMenuService, {
			getKeyBinding: action => this.keybindingService.lookupKeybinding(action.id),
			actionViewItemProvider: action => {
				return createActionViewItem(this.instantiationService, action);
			},
			renderDropdownAsChildElement: true
		});

		if (elementClass) {
			toolbar.getElement().classList.add(elementClass);
		}

		return toolbar;
	}

	protected getCellToolbarActions(menu: IMenu): { primary: IAction[], secondary: IAction[]; } {
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary };

		createAndFillInActionBarActions(menu, { shouldForwardArgs: true }, result, g => /^inline/.test(g));

		return result;
	}

	protected setupCellToolbarActions(templateData: BaseCellRenderTemplate, disposables: DisposableStore): void {
		const updateActions = () => {
			const actions = this.getCellToolbarActions(templateData.titleMenu);

			const hadFocus = DOM.isAncestor(document.activeElement, templateData.toolbar.getElement());
			templateData.toolbar.setActions(actions.primary, actions.secondary);
			if (hadFocus) {
				this.notebookEditor.focus();
			}

			const layoutInfo = this.notebookEditor.notebookOptions.getLayoutConfiguration();
			if (actions.primary.length || actions.secondary.length) {
				templateData.container.classList.add('cell-has-toolbar-actions');
				if (isCodeCellRenderTemplate(templateData)) {
					templateData.focusIndicatorLeft.style.top = `${layoutInfo.editorToolbarHeight + layoutInfo.cellTopMargin}px`;
					templateData.focusIndicatorRight.style.top = `${layoutInfo.editorToolbarHeight + layoutInfo.cellTopMargin}px`;
				}
			} else {
				templateData.container.classList.remove('cell-has-toolbar-actions');
				if (isCodeCellRenderTemplate(templateData)) {
					templateData.focusIndicatorLeft.style.top = `${layoutInfo.cellTopMargin}px`;
					templateData.focusIndicatorRight.style.top = `${layoutInfo.cellTopMargin}px`;
				}
			}
		};

		// #103926
		let dropdownIsVisible = false;
		let deferredUpdate: (() => void) | undefined;

		updateActions();
		disposables.add(templateData.titleMenu.onDidChange(() => {
			if (this.notebookEditor.isDisposed) {
				return;
			}

			if (dropdownIsVisible) {
				deferredUpdate = () => updateActions();
				return;
			}

			updateActions();
		}));
		templateData.container.classList.toggle('cell-toolbar-dropdown-active', false);
		disposables.add(templateData.toolbar.onDidChangeDropdownVisibility(visible => {
			dropdownIsVisible = visible;
			templateData.container.classList.toggle('cell-toolbar-dropdown-active', visible);

			if (deferredUpdate && !visible) {
				setTimeout(() => {
					if (deferredUpdate) {
						deferredUpdate();
					}
				}, 0);
				deferredUpdate = undefined;
			}
		}));
	}

	protected commonRenderTemplate(templateData: BaseCellRenderTemplate): void {
		templateData.disposables.add(DOM.addDisposableListener(templateData.container, DOM.EventType.FOCUS, () => {
			if (templateData.currentRenderedCell) {
				this.notebookEditor.focusElement(templateData.currentRenderedCell);
			}
		}, true));

		this.addExpandListener(templateData);
	}

	protected commonRenderElement(element: ICellViewModel, templateData: BaseCellRenderTemplate): void {
		if (element.dragging) {
			templateData.container.classList.add(DRAGGING_CLASS);
		} else {
			templateData.container.classList.remove(DRAGGING_CLASS);
		}
	}

	protected addExpandListener(templateData: BaseCellRenderTemplate): void {
		templateData.disposables.add(domEvent(templateData.expandButton, DOM.EventType.CLICK)(() => {
			if (!templateData.currentRenderedCell) {
				return;
			}

			const textModel = this.notebookEditor.viewModel!.notebookDocument;
			const index = textModel.cells.indexOf(templateData.currentRenderedCell.model);

			if (index < 0) {
				return;
			}

			if (templateData.currentRenderedCell.metadata.inputCollapsed) {
				textModel.applyEdits([
					{ editType: CellEditType.Metadata, index, metadata: { ...templateData.currentRenderedCell.metadata, inputCollapsed: false } }
				], true, undefined, () => undefined, undefined);
			} else if (templateData.currentRenderedCell.metadata.outputCollapsed) {
				textModel.applyEdits([
					{ editType: CellEditType.Metadata, index, metadata: { ...templateData.currentRenderedCell.metadata, outputCollapsed: false } }
				], true, undefined, () => undefined, undefined);
			}
		}));
	}

	protected setupCollapsedPart(container: HTMLElement): { collapsedPart: HTMLElement, expandButton: HTMLElement; } {
		const collapsedPart = DOM.append(container, $('.cell.cell-collapsed-part', undefined, $('span.expandButton' + ThemeIcon.asCSSSelector(unfoldIcon))));
		const expandButton = collapsedPart.querySelector('.expandButton') as HTMLElement;
		const keybinding = this.keybindingService.lookupKeybinding(EXPAND_CELL_INPUT_COMMAND_ID);
		let title = localize('cellExpandButtonLabel', "Expand");
		if (keybinding) {
			title += ` (${keybinding.getLabel()})`;
		}

		collapsedPart.title = title;
		DOM.hide(collapsedPart);

		return { collapsedPart, expandButton };
	}
}

export class MarkdownCellRenderer extends AbstractCellRenderer implements IListRenderer<MarkdownCellViewModel, MarkdownCellRenderTemplate> {
	static readonly TEMPLATE_ID = 'markdown_cell';

	private readonly useRenderer: boolean;

	constructor(
		notebookEditor: INotebookEditor,
		dndController: CellDragAndDropController,
		private renderedEditors: Map<ICellViewModel, ICodeEditor | undefined>,
		contextKeyServiceProvider: (container: HTMLElement) => IContextKeyService,
		options: { useRenderer: boolean; },
		@IConfigurationService private configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
	) {
		super(instantiationService, notebookEditor, contextMenuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, 'markdown', dndController);
		this.useRenderer = options.useRenderer;
	}

	get templateId() {
		return MarkdownCellRenderer.TEMPLATE_ID;
	}

	renderTemplate(rootContainer: HTMLElement): MarkdownCellRenderTemplate {
		rootContainer.classList.add('markdown-cell-row');
		const container = DOM.append(rootContainer, DOM.$('.cell-inner-container'));
		const disposables = new DisposableStore();
		const contextKeyService = disposables.add(this.contextKeyServiceProvider(container));
		const decorationContainer = DOM.append(rootContainer, $('.cell-decoration'));
		const titleToolbarContainer = DOM.append(container, $('.cell-title-toolbar'));
		const toolbar = disposables.add(this.createToolbar(titleToolbarContainer));
		const deleteToolbar = disposables.add(this.createToolbar(titleToolbarContainer, 'cell-delete-toolbar'));
		deleteToolbar.setActions([this.instantiationService.createInstance(DeleteCellAction)]);

		DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-top'));
		const focusIndicatorLeft = DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left'));
		const focusIndicatorRight = DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right'));

		const codeInnerContent = DOM.append(container, $('.cell.code'));
		const editorPart = DOM.append(codeInnerContent, $('.cell-editor-part'));
		const editorContainer = DOM.append(editorPart, $('.cell-editor-container'));
		editorPart.style.display = 'none';

		const innerContent = DOM.append(container, $('.cell.markdown'));
		const foldingIndicator = DOM.append(focusIndicatorLeft, DOM.$('.notebook-folding-indicator'));

		const { collapsedPart, expandButton } = this.setupCollapsedPart(container);

		const bottomCellContainer = DOM.append(container, $('.cell-bottom-toolbar-container'));
		const betweenCellToolbar = disposables.add(this.createBetweenCellToolbar(bottomCellContainer, disposables, contextKeyService, this.notebookEditor.notebookOptions));
		const focusIndicatorBottom = DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-bottom'));

		const statusBar = disposables.add(this.instantiationService.createInstance(CellEditorStatusBar, editorPart));

		const titleMenu = disposables.add(this.cellMenus.getCellTitleMenu(contextKeyService));

		const templateData: MarkdownCellRenderTemplate = {
			useRenderer: this.useRenderer,
			rootContainer,
			collapsedPart,
			expandButton,
			contextKeyService,
			container,
			decorationContainer,
			cellContainer: innerContent,
			editorPart,
			editorContainer,
			focusIndicatorLeft,
			focusIndicatorBottom,
			focusIndicatorRight,
			foldingIndicator,
			disposables,
			elementDisposables: new DisposableStore(),
			toolbar,
			deleteToolbar,
			betweenCellToolbar,
			bottomCellContainer,
			titleMenu,
			statusBar,
			toJSON: () => { return {}; }
		};

		if (!this.useRenderer) {
			this.dndController?.registerDragHandle(templateData, rootContainer, container, () => this.getDragImage(templateData));
		}

		this.commonRenderTemplate(templateData);

		return templateData;
	}

	private getDragImage(templateData: MarkdownCellRenderTemplate): HTMLElement {
		if (templateData.currentRenderedCell?.getEditState() === CellEditState.Editing) {
			return this.getEditDragImage(templateData);
		} else {
			return this.getMarkdownDragImage(templateData);
		}
	}

	private getMarkdownDragImage(templateData: MarkdownCellRenderTemplate): HTMLElement {
		const dragImageContainer = DOM.$('.cell-drag-image.monaco-list-row.focused.markdown-cell-row');
		DOM.reset(dragImageContainer, templateData.container.cloneNode(true));

		// Remove all rendered content nodes after the
		const markdownContent = dragImageContainer.querySelector('.cell.markdown');
		const contentNodes = markdownContent?.children[0].children;
		if (contentNodes) {
			for (let i = contentNodes.length - 1; i >= 1; i--) {
				contentNodes.item(i)!.remove();
			}
		}

		return dragImageContainer;
	}

	private getEditDragImage(templateData: MarkdownCellRenderTemplate): HTMLElement {
		return new CodeCellDragImageRenderer().getDragImage(templateData, templateData.currentEditor!, 'markdown');
	}

	renderElement(element: MarkdownCellViewModel, index: number, templateData: MarkdownCellRenderTemplate, height: number | undefined): void {
		if (!this.notebookEditor.hasModel()) {
			throw new Error('The notebook editor is not attached with view model yet.');
		}

		const removedClassNames: string[] = [];
		templateData.rootContainer.classList.forEach(className => {
			if (/^nb\-.*$/.test(className)) {
				removedClassNames.push(className);
			}
		});

		removedClassNames.forEach(className => {
			templateData.rootContainer.classList.remove(className);
		});

		templateData.decorationContainer.innerText = '';

		this.commonRenderElement(element, templateData);

		templateData.currentRenderedCell = element;
		templateData.currentEditor = undefined;
		templateData.editorPart.style.display = 'none';
		templateData.cellContainer.innerText = '';

		if (height === undefined) {
			return;
		}

		const elementDisposables = templateData.elementDisposables;

		const generateCellTopDecorations = () => {
			templateData.decorationContainer.innerText = '';

			element.getCellDecorations().filter(options => options.topClassName !== undefined).forEach(options => {
				templateData.decorationContainer.append(DOM.$(`.${options.topClassName!}`));
			});
		};

		elementDisposables.add(element.onCellDecorationsChanged((e) => {
			const modified = e.added.find(e => e.topClassName) || e.removed.find(e => e.topClassName);

			if (modified) {
				generateCellTopDecorations();
			}
		}));

		elementDisposables.add(new CellContextKeyManager(templateData.contextKeyService, this.notebookEditor, element));

		this.updateForLayout(element, templateData);
		elementDisposables.add(element.onDidChangeLayout(() => {
			this.updateForLayout(element, templateData);
		}));

		this.updateForHover(element, templateData);
		const cellEditorOptions = new CellEditorOptions(this.notebookEditor, this.notebookEditor.notebookOptions, this.configurationService, 'markdown');
		cellEditorOptions.setLineNumbers(element.lineNumbers);
		elementDisposables.add(cellEditorOptions);

		elementDisposables.add(element.onDidChangeState(e => {
			if (e.cellIsHoveredChanged) {
				this.updateForHover(element, templateData);
			}

			if (e.metadataChanged) {
				this.updateCollapsedState(element);
			}

			if (e.cellLineNumberChanged) {
				cellEditorOptions.setLineNumbers(element.lineNumbers);
			}
		}));

		// render toolbar first
		this.setupCellToolbarActions(templateData, elementDisposables);

		const toolbarContext = <INotebookCellActionContext>{
			ui: true,
			cell: element,
			notebookEditor: this.notebookEditor,
			$mid: 12
		};
		templateData.toolbar.context = toolbarContext;
		templateData.deleteToolbar.context = toolbarContext;

		this.setBetweenCellToolbarContext(templateData, element, toolbarContext);

		const scopedInstaService = this.instantiationService.createChild(new ServiceCollection([IContextKeyService, templateData.contextKeyService]));
		const markdownCell = scopedInstaService.createInstance(StatefulMarkdownCell, this.notebookEditor, element, templateData, cellEditorOptions.getValue(element.internalMetadata), this.renderedEditors, { useRenderer: templateData.useRenderer });
		elementDisposables.add(markdownCell);
		elementDisposables.add(cellEditorOptions.onDidChange(newValue => markdownCell.updateEditorOptions(cellEditorOptions.getValue(element.internalMetadata))));

		templateData.statusBar.update(toolbarContext);
	}

	private updateForLayout(element: MarkdownCellViewModel, templateData: MarkdownCellRenderTemplate): void {
		const indicatorPostion = this.notebookEditor.notebookOptions.computeIndicatorPosition(element.layoutInfo.totalHeight, this.notebookEditor.viewModel?.viewType);
		templateData.focusIndicatorBottom.style.top = `${indicatorPostion.bottomIndicatorTop}px`;
		templateData.focusIndicatorLeft.style.height = `${indicatorPostion.verticalIndicatorHeight}px`;
		templateData.focusIndicatorRight.style.height = `${indicatorPostion.verticalIndicatorHeight}px`;

		templateData.container.classList.toggle('cell-statusbar-hidden', this.notebookEditor.notebookOptions.computeEditorStatusbarHeight(element.internalMetadata) === 0);
	}

	private updateForHover(element: MarkdownCellViewModel, templateData: MarkdownCellRenderTemplate): void {
		templateData.container.classList.toggle('markdown-cell-hover', element.cellIsHovered);
	}

	private updateCollapsedState(element: MarkdownCellViewModel) {
		if (element.metadata.inputCollapsed) {
			this.notebookEditor.hideMarkdownPreviews([element]);
		} else {
			this.notebookEditor.unhideMarkdownPreviews([element]);
		}
	}

	disposeTemplate(templateData: MarkdownCellRenderTemplate): void {
		templateData.disposables.clear();
	}

	disposeElement(element: ICellViewModel, _index: number, templateData: MarkdownCellRenderTemplate): void {
		templateData.elementDisposables.clear();
		element.getCellDecorations().forEach(e => {
			if (e.className) {
				templateData.container.classList.remove(e.className);
			}
		});
	}
}

class EditorTextRenderer {

	private static _ttPolicy = window.trustedTypes?.createPolicy('cellRendererEditorText', {
		createHTML(input) { return input; }
	});

	getRichText(editor: ICodeEditor, modelRange: Range): HTMLElement | null {
		const model = editor.getModel();
		if (!model) {
			return null;
		}

		const colorMap = this.getDefaultColorMap();
		const fontInfo = editor.getOptions().get(EditorOption.fontInfo);
		const fontFamilyVar = '--notebook-editor-font-family';
		const fontSizeVar = '--notebook-editor-font-size';
		const fontWeightVar = '--notebook-editor-font-weight';

		const style = ``
			+ `color: ${colorMap[modes.ColorId.DefaultForeground]};`
			+ `background-color: ${colorMap[modes.ColorId.DefaultBackground]};`
			+ `font-family: var(${fontFamilyVar});`
			+ `font-weight: var(${fontWeightVar});`
			+ `font-size: var(${fontSizeVar});`
			+ `line-height: ${fontInfo.lineHeight}px;`
			+ `white-space: pre;`;

		const element = DOM.$('div', { style });

		const fontSize = fontInfo.fontSize;
		const fontWeight = fontInfo.fontWeight;
		element.style.setProperty(fontFamilyVar, fontInfo.fontFamily);
		element.style.setProperty(fontSizeVar, `${fontSize}px`);
		element.style.setProperty(fontWeightVar, fontWeight);

		const linesHtml = this.getRichTextLinesAsHtml(model, modelRange, colorMap);
		element.innerHTML = linesHtml as string;
		return element;
	}

	private getRichTextLinesAsHtml(model: ITextModel, modelRange: Range, colorMap: string[]): string | TrustedHTML {
		const startLineNumber = modelRange.startLineNumber;
		const startColumn = modelRange.startColumn;
		const endLineNumber = modelRange.endLineNumber;
		const endColumn = modelRange.endColumn;

		const tabSize = model.getOptions().tabSize;

		let result = '';

		for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
			const lineTokens = model.getLineTokens(lineNumber);
			const lineContent = lineTokens.getLineContent();
			const startOffset = (lineNumber === startLineNumber ? startColumn - 1 : 0);
			const endOffset = (lineNumber === endLineNumber ? endColumn - 1 : lineContent.length);

			if (lineContent === '') {
				result += '<br>';
			} else {
				result += tokenizeLineToHTML(lineContent, lineTokens.inflate(), colorMap, startOffset, endOffset, tabSize, platform.isWindows);
			}
		}

		return EditorTextRenderer._ttPolicy?.createHTML(result) ?? result;
	}

	private getDefaultColorMap(): string[] {
		const colorMap = modes.TokenizationRegistry.getColorMap();
		const result: string[] = ['#000000'];
		if (colorMap) {
			for (let i = 1, len = colorMap.length; i < len; i++) {
				result[i] = Color.Format.CSS.formatHex(colorMap[i]);
			}
		}
		return result;
	}
}

class CodeCellDragImageRenderer {
	getDragImage(templateData: BaseCellRenderTemplate, editor: ICodeEditor, type: 'code' | 'markdown'): HTMLElement {
		let dragImage = this.getDragImageImpl(templateData, editor, type);
		if (!dragImage) {
			// TODO@roblourens I don't think this can happen
			dragImage = document.createElement('div');
			dragImage.textContent = '1 cell';
		}

		return dragImage;
	}

	private getDragImageImpl(templateData: BaseCellRenderTemplate, editor: ICodeEditor, type: 'code' | 'markdown'): HTMLElement | null {
		const dragImageContainer = templateData.container.cloneNode(true) as HTMLElement;
		dragImageContainer.classList.forEach(c => dragImageContainer.classList.remove(c));
		dragImageContainer.classList.add('cell-drag-image', 'monaco-list-row', 'focused', `${type}-cell-row`);

		const editorContainer: HTMLElement | null = dragImageContainer.querySelector('.cell-editor-container');
		if (!editorContainer) {
			return null;
		}

		const richEditorText = new EditorTextRenderer().getRichText(editor, new Range(1, 1, 1, 1000));
		if (!richEditorText) {
			return null;
		}
		DOM.reset(editorContainer, richEditorText);

		return dragImageContainer;
	}
}

export class CodeCellRenderer extends AbstractCellRenderer implements IListRenderer<CodeCellViewModel, CodeCellRenderTemplate> {
	static readonly TEMPLATE_ID = 'code_cell';

	constructor(
		notebookEditor: INotebookEditor,
		private renderedEditors: Map<ICellViewModel, ICodeEditor | undefined>,
		dndController: CellDragAndDropController,
		contextKeyServiceProvider: (container: HTMLElement) => IContextKeyService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IKeybindingService keybindingService: IKeybindingService,
		@INotificationService notificationService: INotificationService,
	) {
		super(instantiationService, notebookEditor, contextMenuService, configurationService, keybindingService, notificationService, contextKeyServiceProvider, 'plaintext', dndController);
	}

	get templateId() {
		return CodeCellRenderer.TEMPLATE_ID;
	}

	renderTemplate(rootContainer: HTMLElement): CodeCellRenderTemplate {
		rootContainer.classList.add('code-cell-row');
		const container = DOM.append(rootContainer, DOM.$('.cell-inner-container'));
		const disposables = new DisposableStore();
		const contextKeyService = disposables.add(this.contextKeyServiceProvider(container));
		const decorationContainer = DOM.append(rootContainer, $('.cell-decoration'));
		DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-top'));
		const titleToolbarContainer = DOM.append(container, $('.cell-title-toolbar'));
		const toolbar = disposables.add(this.createToolbar(titleToolbarContainer));
		const deleteToolbar = disposables.add(this.createToolbar(titleToolbarContainer, 'cell-delete-toolbar'));
		deleteToolbar.setActions([this.instantiationService.createInstance(DeleteCellAction)]);

		const focusIndicator = DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-left'));
		const dragHandle = DOM.append(container, DOM.$('.cell-drag-handle'));

		const cellContainer = DOM.append(container, $('.cell.code'));
		const runButtonContainer = DOM.append(cellContainer, $('.run-button-container'));

		const runToolbar = this.setupRunToolbar(runButtonContainer, container, contextKeyService, disposables);
		const executionOrderLabel = DOM.append(cellContainer, $('div.execution-count-label'));

		const editorPart = DOM.append(cellContainer, $('.cell-editor-part'));
		const editorContainer = DOM.append(editorPart, $('.cell-editor-container'));

		// create a special context key service that set the inCompositeEditor-contextkey
		const editorContextKeyService = disposables.add(this.contextKeyServiceProvider(editorPart));
		const editorInstaService = this.instantiationService.createChild(new ServiceCollection([IContextKeyService, editorContextKeyService]));
		EditorContextKeys.inCompositeEditor.bindTo(editorContextKeyService).set(true);

		const editor = editorInstaService.createInstance(CodeEditorWidget, editorContainer, {
			...this.editorOptions.getValue(),
			dimension: {
				width: 0,
				height: 0
			},
			// overflowWidgetsDomNode: this.notebookEditor.getOverflowContainerDomNode()
		}, {});

		disposables.add(editor);
		const { collapsedPart, expandButton } = this.setupCollapsedPart(container);

		const progressBar = new ProgressBar(editorPart);
		progressBar.hide();
		disposables.add(progressBar);

		const statusBar = disposables.add(this.instantiationService.createInstance(CellEditorStatusBar, editorPart));

		const outputContainer = DOM.append(container, $('.output'));
		const outputShowMoreContainer = DOM.append(container, $('.output-show-more-container'));

		const focusIndicatorRight = DOM.append(container, DOM.$('.cell-focus-indicator.cell-focus-indicator-side.cell-focus-indicator-right'));

		const focusSinkElement = DOM.append(container, $('.cell-editor-focus-sink'));
		focusSinkElement.setAttribute('tabindex', '0');
		const bottomCellContainer = DOM.append(container, $('.cell-bottom-toolbar-container'));
		const focusIndicatorBottom = DOM.append(container, $('.cell-focus-indicator.cell-focus-indicator-bottom'));
		const betweenCellToolbar = this.createBetweenCellToolbar(bottomCellContainer, disposables, contextKeyService, this.notebookEditor.notebookOptions);

		const titleMenu = disposables.add(this.cellMenus.getCellTitleMenu(contextKeyService));

		const templateData: CodeCellRenderTemplate = {
			rootContainer,
			editorPart,
			collapsedPart,
			expandButton,
			contextKeyService,
			container,
			decorationContainer,
			cellContainer,
			progressBar,
			statusBar,
			focusIndicatorLeft: focusIndicator,
			focusIndicatorRight,
			focusIndicatorBottom,
			toolbar,
			deleteToolbar,
			betweenCellToolbar,
			focusSinkElement,
			runToolbar,
			runButtonContainer,
			executionOrderLabel,
			outputContainer,
			outputShowMoreContainer,
			editor,
			disposables,
			elementDisposables: new DisposableStore(),
			bottomCellContainer,
			titleMenu,
			dragHandle,
			toJSON: () => { return {}; }
		};

		this.dndController?.registerDragHandle(templateData, rootContainer, dragHandle, () => new CodeCellDragImageRenderer().getDragImage(templateData, templateData.editor, 'code'));

		disposables.add(this.addDoubleClickCollapseHandler(templateData));
		disposables.add(DOM.addDisposableListener(focusSinkElement, DOM.EventType.FOCUS, () => {
			if (templateData.currentRenderedCell && (templateData.currentRenderedCell as CodeCellViewModel).outputsViewModels.length) {
				this.notebookEditor.focusNotebookCell(templateData.currentRenderedCell, 'output');
			}
		}));

		this.commonRenderTemplate(templateData);

		return templateData;
	}

	private addDoubleClickCollapseHandler(templateData: CodeCellRenderTemplate): IDisposable {
		const dragHandleListener = DOM.addDisposableListener(templateData.dragHandle, DOM.EventType.DBLCLICK, e => {
			const cell = templateData.currentRenderedCell;
			if (!cell) {
				return;
			}

			const clickedOnInput = e.offsetY < (cell.layoutInfo as CodeCellLayoutInfo).outputContainerOffset;
			const viewModel = this.notebookEditor.viewModel!;
			const metadata: Partial<NotebookCellMetadata> = clickedOnInput ?
				{ inputCollapsed: !cell.metadata.inputCollapsed } :
				{ outputCollapsed: !cell.metadata.outputCollapsed };
			viewModel.notebookDocument.applyEdits([
				{
					editType: CellEditType.PartialMetadata,
					index: viewModel.getCellIndex(cell),
					metadata
				}
			], true, undefined, () => undefined, undefined);
		});

		const collapsedPartListener = DOM.addDisposableListener(templateData.collapsedPart, DOM.EventType.DBLCLICK, e => {
			const cell = templateData.currentRenderedCell;
			if (!cell) {
				return;
			}

			const metadata: Partial<NotebookCellMetadata> = cell.metadata.inputCollapsed ?
				{ inputCollapsed: false } :
				{ outputCollapsed: false };
			const viewModel = this.notebookEditor.viewModel!;
			viewModel.notebookDocument.applyEdits([
				{
					editType: CellEditType.PartialMetadata,
					index: viewModel.getCellIndex(cell),
					metadata
				}
			], true, undefined, () => undefined, undefined);
		});

		return combinedDisposable(dragHandleListener, collapsedPartListener);
	}

	private createRunCellToolbar(container: HTMLElement, cellContainer: HTMLElement, contextKeyService: IContextKeyService, disposables: DisposableStore): ToolBar {
		const actionViewItemDisposables = disposables.add(new DisposableStore());
		const dropdownAction = disposables.add(new Action('notebook.moreRunActions', localize('notebook.moreRunActionsLabel', "More..."), 'codicon-chevron-down', true));

		const toolbar = disposables.add(new ToolBar(container, this.contextMenuService, {
			getKeyBinding: action => this.keybindingService.lookupKeybinding(action.id),
			actionViewItemProvider: _action => {
				actionViewItemDisposables.clear();

				const actions = this.getCellToolbarActions(this.cellMenus.getCellExecuteMenu(contextKeyService));
				const primary = actions.primary[0];
				if (!(primary instanceof MenuItemAction)) {
					return undefined;
				}

				if (!actions.secondary.length) {
					return undefined;
				}

				if (!this.notebookEditor.notebookOptions.getLayoutConfiguration().consolidatedRunButton) {
					return undefined;
				}

				const item = new DropdownWithPrimaryActionViewItem(
					primary,
					dropdownAction,
					actions.secondary,
					'notebook-cell-run-toolbar',
					this.contextMenuService,
					this.keybindingService,
					this.notificationService);
				actionViewItemDisposables.add(item.onDidChangeDropdownVisibility(visible => {
					cellContainer.classList.toggle('cell-run-toolbar-dropdown-active', visible);
				}));

				return item;
			},
			renderDropdownAsChildElement: true
		}));

		return toolbar;
	}

	private setupRunToolbar(runButtonContainer: HTMLElement, cellContainer: HTMLElement, contextKeyService: IContextKeyService, disposables: DisposableStore): ToolBar {
		const menu = this.cellMenus.getCellExecuteMenu(contextKeyService);
		const runToolbar = this.createRunCellToolbar(runButtonContainer, cellContainer, contextKeyService, disposables);
		const updateActions = () => {
			const actions = this.getCellToolbarActions(this.cellMenus.getCellExecuteMenu(contextKeyService));
			runToolbar.setActions(actions.primary);
		};
		updateActions();
		disposables.add(menu.onDidChange(updateActions));
		disposables.add(this.notebookEditor.notebookOptions.onDidChangeOptions(updateActions));
		return runToolbar;
	}

	private updateForOutputs(element: CodeCellViewModel, templateData: CodeCellRenderTemplate): void {
		if (element.outputsViewModels.length) {
			DOM.show(templateData.focusSinkElement);
		} else {
			DOM.hide(templateData.focusSinkElement);
		}
	}

	private updateForInternalMetadata(element: CodeCellViewModel, templateData: CodeCellRenderTemplate): void {
		if (!this.notebookEditor.hasModel()) {
			return;
		}

		const internalMetadata = element.internalMetadata;
		this.updateExecutionOrder(internalMetadata, templateData);

		if (internalMetadata.runState === NotebookCellExecutionState.Executing) {
			templateData.progressBar.infinite().show(500);
		} else {
			templateData.progressBar.hide();
		}
	}

	private updateExecutionOrder(internalMetadata: NotebookCellInternalMetadata, templateData: CodeCellRenderTemplate): void {
		if (this.notebookEditor.activeKernel?.implementsExecutionOrder) {
			const executionOrderLabel = typeof internalMetadata.executionOrder === 'number' ?
				`[${internalMetadata.executionOrder}]` :
				'[ ]';
			templateData.executionOrderLabel.innerText = executionOrderLabel;
		} else {
			templateData.executionOrderLabel.innerText = '';
		}
	}

	private updateForHover(element: CodeCellViewModel, templateData: CodeCellRenderTemplate): void {
		templateData.container.classList.toggle('cell-output-hover', element.outputIsHovered);
	}

	private updateForFocus(element: CodeCellViewModel, templateData: CodeCellRenderTemplate): void {
		templateData.container.classList.toggle('cell-output-focus', element.outputIsFocused);
	}

	private updateForLayout(element: CodeCellViewModel, templateData: CodeCellRenderTemplate): void {
		const layoutInfo = this.notebookEditor.notebookOptions.getLayoutConfiguration();
		const bottomToolbarDimensions = this.notebookEditor.notebookOptions.computeBottomToolbarDimensions(this.notebookEditor.viewModel?.viewType);

		templateData.focusIndicatorLeft.style.height = `${element.layoutInfo.indicatorHeight}px`;
		templateData.focusIndicatorRight.style.height = `${element.layoutInfo.indicatorHeight}px`;
		templateData.focusIndicatorBottom.style.top = `${element.layoutInfo.totalHeight - bottomToolbarDimensions.bottomToolbarGap - layoutInfo.cellBottomMargin}px`;
		templateData.outputContainer.style.top = `${element.layoutInfo.outputContainerOffset}px`;
		templateData.outputShowMoreContainer.style.top = `${element.layoutInfo.outputShowMoreContainerOffset}px`;
		templateData.dragHandle.style.height = `${element.layoutInfo.totalHeight - bottomToolbarDimensions.bottomToolbarGap}px`;

		templateData.container.classList.toggle('cell-statusbar-hidden', this.notebookEditor.notebookOptions.computeEditorStatusbarHeight(element.internalMetadata) === 0);
	}

	renderElement(element: CodeCellViewModel, index: number, templateData: CodeCellRenderTemplate, height: number | undefined): void {
		if (!this.notebookEditor.hasModel()) {
			throw new Error('The notebook editor is not attached with view model yet.');
		}

		const removedClassNames: string[] = [];
		templateData.rootContainer.classList.forEach(className => {
			if (/^nb\-.*$/.test(className)) {
				removedClassNames.push(className);
			}
		});

		removedClassNames.forEach(className => {
			templateData.rootContainer.classList.remove(className);
		});

		templateData.decorationContainer.innerText = '';

		this.commonRenderElement(element, templateData);

		templateData.currentRenderedCell = element;

		if (height === undefined) {
			return;
		}

		templateData.outputContainer.innerText = '';

		const elementDisposables = templateData.elementDisposables;

		const generateCellTopDecorations = () => {
			templateData.decorationContainer.innerText = '';

			element.getCellDecorations().filter(options => options.topClassName !== undefined).forEach(options => {
				templateData.decorationContainer.append(DOM.$(`.${options.topClassName!}`));
			});
		};

		elementDisposables.add(element.onCellDecorationsChanged((e) => {
			const modified = e.added.find(e => e.topClassName) || e.removed.find(e => e.topClassName);

			if (modified) {
				generateCellTopDecorations();
			}
		}));

		generateCellTopDecorations();

		const child = this.instantiationService.createChild(new ServiceCollection([IContextKeyService, templateData.contextKeyService]));
		elementDisposables.add(child.createInstance(CodeCell, this.notebookEditor, element, templateData));
		this.renderedEditors.set(element, templateData.editor);

		const cellEditorOptions = new CellEditorOptions(this.notebookEditor, this.notebookEditor.notebookOptions, this.configurationService, element.language);
		elementDisposables.add(cellEditorOptions);
		elementDisposables.add(cellEditorOptions.onDidChange(() => templateData.editor.updateOptions(cellEditorOptions.getValue(element.internalMetadata))));
		templateData.editor.updateOptions(cellEditorOptions.getValue(element.internalMetadata));

		elementDisposables.add(new CellContextKeyManager(templateData.contextKeyService, this.notebookEditor, element));

		this.updateForLayout(element, templateData);
		elementDisposables.add(element.onDidChangeLayout(() => {
			this.updateForLayout(element, templateData);
		}));

		this.updateForInternalMetadata(element, templateData);
		this.updateForHover(element, templateData);
		this.updateForFocus(element, templateData);
		cellEditorOptions.setLineNumbers(element.lineNumbers);
		elementDisposables.add(element.onDidChangeState((e) => {
			if (e.internalMetadataChanged) {
				this.updateForInternalMetadata(element, templateData);
				this.updateForLayout(element, templateData);
			}

			if (e.outputIsHoveredChanged) {
				this.updateForHover(element, templateData);
			}

			if (e.outputIsFocusedChanged) {
				this.updateForFocus(element, templateData);
			}

			if (e.cellLineNumberChanged) {
				cellEditorOptions.setLineNumbers(element.lineNumbers);
			}
		}));

		this.updateForOutputs(element, templateData);
		elementDisposables.add(element.onDidChangeOutputs(_e => this.updateForOutputs(element, templateData)));

		this.setupCellToolbarActions(templateData, elementDisposables);

		const toolbarContext = <INotebookCellActionContext>{
			ui: true,
			cell: element,
			cellTemplate: templateData,
			notebookEditor: this.notebookEditor,
			$mid: 12
		};
		templateData.toolbar.context = toolbarContext;
		templateData.runToolbar.context = toolbarContext;
		templateData.deleteToolbar.context = toolbarContext;

		this.setBetweenCellToolbarContext(templateData, element, toolbarContext);

		templateData.statusBar.update(toolbarContext);
	}

	disposeTemplate(templateData: CodeCellRenderTemplate): void {
		templateData.disposables.clear();
	}

	disposeElement(element: ICellViewModel, index: number, templateData: CodeCellRenderTemplate, height: number | undefined): void {
		templateData.elementDisposables.clear();
		this.renderedEditors.delete(element);
	}
}

export class TimerRenderer {
	constructor(private readonly container: HTMLElement) {
		DOM.hide(container);
	}

	private intervalTimer: number | undefined;

	start(startTime: number, adjustment: number): IDisposable {
		this.stop();
		DOM.show(this.container);
		const intervalTimer = setInterval(() => {
			const duration = Date.now() - startTime + adjustment;
			this.container.textContent = this.formatDuration(duration);
		}, 100);
		this.intervalTimer = intervalTimer as unknown as number | undefined;

		return toDisposable(() => {
			clearInterval(intervalTimer);
		});
	}

	stop() {
		if (this.intervalTimer) {
			clearInterval(this.intervalTimer);
		}
	}

	show(duration: number) {
		this.stop();

		DOM.show(this.container);
		this.container.textContent = this.formatDuration(duration);
	}

	clear() {
		DOM.hide(this.container);
		this.stop();
		this.container.textContent = '';
	}

	private formatDuration(duration: number) {
		const seconds = Math.floor(duration / 1000);
		const tenths = String(duration - seconds * 1000).charAt(0);

		return `${seconds}.${tenths}s`;
	}
}

export class RunStateRenderer {
	private static readonly MIN_SPINNER_TIME = 200;

	private spinnerTimer: any | undefined;
	private lastRunState: NotebookCellExecutionState | undefined;
	private pendingNewState: NotebookCellExecutionState | undefined;
	private pendingLastRunSuccess: boolean | undefined;

	constructor(private readonly element: HTMLElement) {
		DOM.hide(element);
	}

	clear() {
		if (this.spinnerTimer) {
			clearTimeout(this.spinnerTimer);
			this.spinnerTimer = undefined;
		}
	}

	renderState(runState: NotebookCellExecutionState | undefined, getCellIndex: () => number, lastRunSuccess: boolean | undefined = undefined) {
		if (this.spinnerTimer) {
			this.pendingNewState = runState;
			this.pendingLastRunSuccess = lastRunSuccess;
			return;
		}

		let runStateTooltip: string | undefined;
		if (!runState && lastRunSuccess) {
			aria.alert(`Code cell at ${getCellIndex()} finishes running successfully`);
			DOM.reset(this.element, renderIcon(successStateIcon));
		} else if (!runState && !lastRunSuccess) {
			aria.alert(`Code cell at ${getCellIndex()} finishes running with errors`);
			DOM.reset(this.element, renderIcon(errorStateIcon));
		} else if (runState === NotebookCellExecutionState.Executing) {
			runStateTooltip = localize('runStateExecuting', "Executing");
			if (this.lastRunState !== NotebookCellExecutionState.Executing) {
				aria.alert(`Code cell at ${getCellIndex()} starts running`);
			}
			DOM.reset(this.element, renderIcon(syncing));
			this.spinnerTimer = setTimeout(() => {
				this.spinnerTimer = undefined;
				if (this.pendingNewState && this.pendingNewState !== runState) {
					this.renderState(this.pendingNewState, getCellIndex, this.pendingLastRunSuccess);
					this.pendingNewState = undefined;
				}
			}, RunStateRenderer.MIN_SPINNER_TIME);
		} else if (runState === NotebookCellExecutionState.Pending) {
			// Not spinning
			runStateTooltip = localize('runStatePending', "Pending");
			DOM.reset(this.element, renderIcon(Codicons.Codicon.clock));
		} else {
			this.element.innerText = '';
		}

		if (!runState && typeof lastRunSuccess !== 'boolean') {
			DOM.hide(this.element);
		} else {
			this.element.style.display = 'flex';
		}

		if (runStateTooltip) {
			this.element.setAttribute('title', runStateTooltip);
		}

		this.lastRunState = runState;
	}
}

export class ListTopCellToolbar extends Disposable {
	private topCellToolbar: HTMLElement;
	private menu: IMenu;
	private toolbar: ToolBar;
	private _modelDisposables = new DisposableStore();
	constructor(
		protected readonly notebookEditor: INotebookEditor,

		contextKeyService: IContextKeyService,
		insertionIndicatorContainer: HTMLElement,
		@IInstantiationService protected readonly instantiationService: IInstantiationService,
		@IContextMenuService protected readonly contextMenuService: IContextMenuService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		this.topCellToolbar = DOM.append(insertionIndicatorContainer, $('.cell-list-top-cell-toolbar-container'));

		this.toolbar = this._register(new ToolBar(this.topCellToolbar, this.contextMenuService, {
			actionViewItemProvider: action => {
				if (action instanceof MenuItemAction) {
					const item = new CodiconActionViewItem(action, this.keybindingService, this.notificationService);
					return item;
				}

				return undefined;
			}
		}));
		this.toolbar.context = <INotebookActionContext>{
			notebookEditor
		};

		const cellMenu = this.instantiationService.createInstance(CellMenus);
		this.menu = this._register(cellMenu.getCellTopInsertionMenu(contextKeyService));
		this._register(this.menu.onDidChange(() => {
			this.updateActions();
		}));
		this.updateActions();

		// update toolbar container css based on cell list length
		this._register(this.notebookEditor.onDidChangeModel(() => {
			this._modelDisposables.clear();

			if (this.notebookEditor.viewModel) {
				this._modelDisposables.add(this.notebookEditor.viewModel.onDidChangeViewCells(() => {
					this.updateClass();
				}));

				this.updateClass();
			}
		}));

		this.updateClass();
	}

	private updateActions() {
		const actions = this.getCellToolbarActions(this.menu, false);
		this.toolbar.setActions(actions.primary, actions.secondary);
	}

	private updateClass() {
		if (this.notebookEditor.viewModel?.length === 0) {
			this.topCellToolbar.classList.add('emptyNotebook');
		} else {
			this.topCellToolbar.classList.remove('emptyNotebook');
		}
	}

	private getCellToolbarActions(menu: IMenu, alwaysFillSecondaryActions: boolean): { primary: IAction[], secondary: IAction[]; } {
		const primary: IAction[] = [];
		const secondary: IAction[] = [];
		const result = { primary, secondary };

		createAndFillInActionBarActions(menu, { shouldForwardArgs: true }, result, g => /^inline/.test(g));

		return result;
	}
}
