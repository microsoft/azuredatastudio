/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from 'vs/base/common/async';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IDebugService, IExpression, CONTEXT_WATCH_EXPRESSIONS_FOCUSED, WATCH_VIEW_ID, CONTEXT_WATCH_EXPRESSIONS_EXIST, CONTEXT_WATCH_ITEM_TYPE, CONTEXT_VARIABLE_IS_READONLY, CONTEXT_CAN_VIEW_MEMORY } from 'vs/workbench/contrib/debug/common/debug';
import { Expression, Variable } from 'vs/workbench/contrib/debug/common/debugModel';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IAction } from 'vs/base/common/actions';
import { renderExpressionValue, renderViewTree, IInputBoxOptions, AbstractExpressionsRenderer, IExpressionTemplateData } from 'vs/workbench/contrib/debug/browser/baseDebugView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewPane, ViewAction } from 'vs/workbench/browser/parts/views/viewPane';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { IListAccessibilityProvider } from 'vs/base/browser/ui/list/listWidget';
import { WorkbenchAsyncDataTree } from 'vs/platform/list/browser/listService';
import { IAsyncDataSource, ITreeMouseEvent, ITreeContextMenuEvent, ITreeDragAndDrop, ITreeDragOverReaction, ITreeNode } from 'vs/base/browser/ui/tree/tree';
import { IDragAndDropData } from 'vs/base/browser/dnd';
import { ElementsDragAndDropData } from 'vs/base/browser/ui/list/listView';
import { FuzzyScore } from 'vs/base/common/filters';
import { IHighlight } from 'vs/base/browser/ui/highlightedlabel/highlightedLabel';
import { VariablesRenderer } from 'vs/workbench/contrib/debug/browser/variablesView';
import { IContextKeyService, ContextKeyExpr, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { watchExpressionsRemoveAll, watchExpressionsAdd } from 'vs/workbench/contrib/debug/browser/debugIcons';
import { registerAction2, MenuId, Action2, IMenuService, IMenu } from 'vs/platform/actions/common/actions';
import { localize } from 'vs/nls';
import { Codicon } from 'vs/base/common/codicons';
import { createAndFillInContextMenuActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { LinkDetector } from 'vs/workbench/contrib/debug/browser/linkDetector';

const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
let ignoreViewUpdates = false;
let useCachedEvaluation = false;

export class WatchExpressionsView extends ViewPane {

	private watchExpressionsUpdatedScheduler: RunOnceScheduler;
	private needsRefresh = false;
	private tree!: WorkbenchAsyncDataTree<IDebugService | IExpression, IExpression, FuzzyScore>;
	private watchExpressionsExist: IContextKey<boolean>;
	private watchItemType: IContextKey<string | undefined>;
	private variableReadonly: IContextKey<boolean>;
	private menu: IMenu;

	constructor(
		options: IViewletViewOptions,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IDebugService private readonly debugService: IDebugService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IMenuService menuService: IMenuService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);

		this.menu = menuService.createMenu(MenuId.DebugWatchContext, contextKeyService);
		this._register(this.menu);
		this.watchExpressionsUpdatedScheduler = new RunOnceScheduler(() => {
			this.needsRefresh = false;
			this.tree.updateChildren();
		}, 50);
		this.watchExpressionsExist = CONTEXT_WATCH_EXPRESSIONS_EXIST.bindTo(contextKeyService);
		this.variableReadonly = CONTEXT_VARIABLE_IS_READONLY.bindTo(contextKeyService);
		this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
		this.watchItemType = CONTEXT_WATCH_ITEM_TYPE.bindTo(contextKeyService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.element.classList.add('debug-pane');
		container.classList.add('debug-watch');
		const treeContainer = renderViewTree(container);

		const expressionsRenderer = this.instantiationService.createInstance(WatchExpressionsRenderer);
		const linkeDetector = this.instantiationService.createInstance(LinkDetector);
		this.tree = <WorkbenchAsyncDataTree<IDebugService | IExpression, IExpression, FuzzyScore>>this.instantiationService.createInstance(WorkbenchAsyncDataTree, 'WatchExpressions', treeContainer, new WatchExpressionsDelegate(), [expressionsRenderer, this.instantiationService.createInstance(VariablesRenderer, linkeDetector)],
			new WatchExpressionsDataSource(), {
			accessibilityProvider: new WatchExpressionsAccessibilityProvider(),
			identityProvider: { getId: (element: IExpression) => element.getId() },
			keyboardNavigationLabelProvider: {
				getKeyboardNavigationLabel: (e: IExpression) => {
					if (e === this.debugService.getViewModel().getSelectedExpression()?.expression) {
						// Don't filter input box
						return undefined;
					}

					return e.name;
				}
			},
			dnd: new WatchExpressionsDragAndDrop(this.debugService),
			overrideStyles: {
				listBackground: this.getBackgroundColor()
			}
		});
		this.tree.setInput(this.debugService);
		CONTEXT_WATCH_EXPRESSIONS_FOCUSED.bindTo(this.tree.contextKeyService);

		this._register(this.tree.onContextMenu(e => this.onContextMenu(e)));
		this._register(this.tree.onMouseDblClick(e => this.onMouseDblClick(e)));
		this._register(this.debugService.getModel().onDidChangeWatchExpressions(async we => {
			this.watchExpressionsExist.set(this.debugService.getModel().getWatchExpressions().length > 0);
			if (!this.isBodyVisible()) {
				this.needsRefresh = true;
			} else {
				if (we && !we.name) {
					// We are adding a new input box, no need to re-evaluate watch expressions
					useCachedEvaluation = true;
				}
				await this.tree.updateChildren();
				useCachedEvaluation = false;
				if (we instanceof Expression) {
					this.tree.reveal(we);
				}
			}
		}));
		this._register(this.debugService.getViewModel().onDidFocusStackFrame(() => {
			if (!this.isBodyVisible()) {
				this.needsRefresh = true;
				return;
			}

			if (!this.watchExpressionsUpdatedScheduler.isScheduled()) {
				this.watchExpressionsUpdatedScheduler.schedule();
			}
		}));
		this._register(this.debugService.getViewModel().onWillUpdateViews(() => {
			if (!ignoreViewUpdates) {
				this.tree.updateChildren();
			}
		}));

		this._register(this.onDidChangeBodyVisibility(visible => {
			if (visible && this.needsRefresh) {
				this.watchExpressionsUpdatedScheduler.schedule();
			}
		}));
		let horizontalScrolling: boolean | undefined;
		this._register(this.debugService.getViewModel().onDidSelectExpression(e => {
			const expression = e?.expression;
			if (expression instanceof Expression || (expression instanceof Variable && e?.settingWatch)) {
				horizontalScrolling = this.tree.options.horizontalScrolling;
				if (horizontalScrolling) {
					this.tree.updateOptions({ horizontalScrolling: false });
				}

				if (expression.name) {
					// Only rerender if the input is already done since otherwise the tree is not yet aware of the new element
					this.tree.rerender(expression);
				}
			} else if (!expression && horizontalScrolling !== undefined) {
				this.tree.updateOptions({ horizontalScrolling: horizontalScrolling });
				horizontalScrolling = undefined;
			}
		}));

		this._register(this.debugService.getViewModel().onDidEvaluateLazyExpression(async e => {
			if (e instanceof Variable && this.tree.hasNode(e)) {
				await this.tree.updateChildren(e, false, true);
				await this.tree.expand(e);
			}
		}));
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	override focus(): void {
		this.tree.domFocus();
	}

	collapseAll(): void {
		this.tree.collapseAll();
	}

	private onMouseDblClick(e: ITreeMouseEvent<IExpression>): void {
		if ((e.browserEvent.target as HTMLElement).className.indexOf('twistie') >= 0) {
			// Ignore double click events on twistie
			return;
		}

		const element = e.element;
		// double click on primitive value: open input box to be able to select and copy value.
		const selectedExpression = this.debugService.getViewModel().getSelectedExpression();
		if (element instanceof Expression && element !== selectedExpression?.expression) {
			this.debugService.getViewModel().setSelectedExpression(element, false);
		} else if (!element) {
			// Double click in watch panel triggers to add a new watch expression
			this.debugService.addWatchExpression();
		}
	}

	private onContextMenu(e: ITreeContextMenuEvent<IExpression>): void {
		const element = e.element;
		const selection = this.tree.getSelection();

		this.watchItemType.set(element instanceof Expression ? 'expression' : element instanceof Variable ? 'variable' : undefined);
		const actions: IAction[] = [];
		const attributes = element instanceof Variable ? element.presentationHint?.attributes : undefined;
		this.variableReadonly.set(!!attributes && attributes.indexOf('readOnly') >= 0 || !!element?.presentationHint?.lazy);
		createAndFillInContextMenuActions(this.menu, { arg: element, shouldForwardArgs: true }, actions);
		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => actions,
			getActionsContext: () => element && selection.includes(element) ? selection : element ? [element] : [],
		});
	}
}

class WatchExpressionsDelegate implements IListVirtualDelegate<IExpression> {

	getHeight(_element: IExpression): number {
		return 22;
	}

	getTemplateId(element: IExpression): string {
		if (element instanceof Expression) {
			return WatchExpressionsRenderer.ID;
		}

		// Variable
		return VariablesRenderer.ID;
	}
}

function isDebugService(element: any): element is IDebugService {
	return typeof element.getConfigurationManager === 'function';
}

class WatchExpressionsDataSource implements IAsyncDataSource<IDebugService, IExpression> {

	hasChildren(element: IExpression | IDebugService): boolean {
		return isDebugService(element) || element.hasChildren;
	}

	getChildren(element: IDebugService | IExpression): Promise<Array<IExpression>> {
		if (isDebugService(element)) {
			const debugService = element as IDebugService;
			const watchExpressions = debugService.getModel().getWatchExpressions();
			const viewModel = debugService.getViewModel();
			return Promise.all(watchExpressions.map(we => !!we.name && !useCachedEvaluation
				? we.evaluate(viewModel.focusedSession!, viewModel.focusedStackFrame!, 'watch').then(() => we)
				: Promise.resolve(we)));
		}

		return element.getChildren();
	}
}


class WatchExpressionsRenderer extends AbstractExpressionsRenderer {

	static readonly ID = 'watchexpression';

	constructor(
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@IDebugService debugService: IDebugService,
		@IContextViewService contextViewService: IContextViewService,
	) {
		super(debugService, contextViewService);
	}

	get templateId() {
		return WatchExpressionsRenderer.ID;
	}

	public override renderElement(node: ITreeNode<IExpression, FuzzyScore>, index: number, data: IExpressionTemplateData): void {
		super.renderExpressionElement(node.element, node, data);
	}

	protected renderExpression(expression: IExpression, data: IExpressionTemplateData, highlights: IHighlight[]): void {
		const text = typeof expression.value === 'string' ? `${expression.name}:` : expression.name;
		let title: string;
		if (expression.type) {
			title = expression.type === expression.value ?
				expression.type :
				`${expression.type}: ${expression.value}`;
		} else {
			title = expression.value;
		}

		data.label.set(text, highlights, title);
		renderExpressionValue(expression, data.value, {
			showChanged: true,
			maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
			showHover: true,
			colorize: true
		});
	}

	protected getInputBoxOptions(expression: IExpression, settingValue: boolean): IInputBoxOptions {
		if (settingValue) {
			return {
				initialValue: expression.value,
				ariaLabel: localize('typeNewValue', "Type new value"),
				onFinish: async (value: string, success: boolean) => {
					if (success && value) {
						const focusedFrame = this.debugService.getViewModel().focusedStackFrame;
						if (focusedFrame && (expression instanceof Variable || expression instanceof Expression)) {
							await expression.setExpression(value, focusedFrame);
							this.debugService.getViewModel().updateViews();
						}
					}
				}
			};
		}

		return {
			initialValue: expression.name ? expression.name : '',
			ariaLabel: localize('watchExpressionInputAriaLabel', "Type watch expression"),
			placeholder: localize('watchExpressionPlaceholder', "Expression to watch"),
			onFinish: (value: string, success: boolean) => {
				if (success && value) {
					this.debugService.renameWatchExpression(expression.getId(), value);
					ignoreViewUpdates = true;
					this.debugService.getViewModel().updateViews();
					ignoreViewUpdates = false;
				} else if (!expression.name) {
					this.debugService.removeWatchExpressions(expression.getId());
				}
			}
		};
	}

	protected override renderActionBar(actionBar: ActionBar, expression: IExpression) {
		const contextKeyService = getContextForWatchExpressionMenu(this.contextKeyService, expression);
		const menu = this.menuService.createMenu(MenuId.DebugWatchContext, contextKeyService);

		const primary: IAction[] = [];
		const context = expression;
		createAndFillInContextMenuActions(menu, { arg: context, shouldForwardArgs: false }, { primary, secondary: [] }, 'inline');

		actionBar.clear();
		actionBar.context = context;
		actionBar.push(primary, { icon: true, label: false });
	}
}

/**
 * Gets a context key overlay that has context for the given expression.
 */
function getContextForWatchExpressionMenu(parentContext: IContextKeyService, expression: IExpression) {
	return parentContext.createOverlay([
		[CONTEXT_CAN_VIEW_MEMORY.key, expression.memoryReference !== undefined],
		[CONTEXT_WATCH_ITEM_TYPE.key, 'expression']
	]);
}

class WatchExpressionsAccessibilityProvider implements IListAccessibilityProvider<IExpression> {

	getWidgetAriaLabel(): string {
		return localize({ comment: ['Debug is a noun in this context, not a verb.'], key: 'watchAriaTreeLabel' }, "Debug Watch Expressions");
	}

	getAriaLabel(element: IExpression): string {
		if (element instanceof Expression) {
			return localize('watchExpressionAriaLabel', "{0}, value {1}", (<Expression>element).name, (<Expression>element).value);
		}

		// Variable
		return localize('watchVariableAriaLabel', "{0}, value {1}", (<Variable>element).name, (<Variable>element).value);
	}
}

class WatchExpressionsDragAndDrop implements ITreeDragAndDrop<IExpression> {

	constructor(private debugService: IDebugService) { }

	onDragOver(data: IDragAndDropData): boolean | ITreeDragOverReaction {
		if (!(data instanceof ElementsDragAndDropData)) {
			return false;
		}

		const expressions = (data as ElementsDragAndDropData<IExpression>).elements;
		return expressions.length > 0 && expressions[0] instanceof Expression;
	}

	getDragURI(element: IExpression): string | null {
		if (!(element instanceof Expression) || element === this.debugService.getViewModel().getSelectedExpression()?.expression) {
			return null;
		}

		return element.getId();
	}

	getDragLabel(elements: IExpression[]): string | undefined {
		if (elements.length === 1) {
			return elements[0].name;
		}

		return undefined;
	}

	drop(data: IDragAndDropData, targetElement: IExpression): void {
		if (!(data instanceof ElementsDragAndDropData)) {
			return;
		}

		const draggedElement = (data as ElementsDragAndDropData<IExpression>).elements[0];
		const watches = this.debugService.getModel().getWatchExpressions();
		const position = targetElement instanceof Expression ? watches.indexOf(targetElement) : watches.length - 1;
		this.debugService.moveWatchExpression(draggedElement.getId(), position);
	}
}

registerAction2(class Collapse extends ViewAction<WatchExpressionsView> {
	constructor() {
		super({
			id: 'watch.collapse',
			viewId: WATCH_VIEW_ID,
			title: localize('collapse', "Collapse All"),
			f1: false,
			icon: Codicon.collapseAll,
			precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
			menu: {
				id: MenuId.ViewTitle,
				order: 30,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', WATCH_VIEW_ID)
			}
		});
	}

	runInView(_accessor: ServicesAccessor, view: WatchExpressionsView) {
		view.collapseAll();
	}
});

export const ADD_WATCH_ID = 'workbench.debug.viewlet.action.addWatchExpression'; // Use old and long id for backwards compatibility
export const ADD_WATCH_LABEL = localize('addWatchExpression', "Add Expression");

registerAction2(class AddWatchExpressionAction extends Action2 {
	constructor() {
		super({
			id: ADD_WATCH_ID,
			title: ADD_WATCH_LABEL,
			f1: false,
			icon: watchExpressionsAdd,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', WATCH_VIEW_ID)
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const debugService = accessor.get(IDebugService);
		debugService.addWatchExpression();
	}
});

export const REMOVE_WATCH_EXPRESSIONS_COMMAND_ID = 'workbench.debug.viewlet.action.removeAllWatchExpressions';
export const REMOVE_WATCH_EXPRESSIONS_LABEL = localize('removeAllWatchExpressions', "Remove All Expressions");
registerAction2(class RemoveAllWatchExpressionsAction extends Action2 {
	constructor() {
		super({
			id: REMOVE_WATCH_EXPRESSIONS_COMMAND_ID, // Use old and long id for backwards compatibility
			title: REMOVE_WATCH_EXPRESSIONS_LABEL,
			f1: false,
			icon: watchExpressionsRemoveAll,
			precondition: CONTEXT_WATCH_EXPRESSIONS_EXIST,
			menu: {
				id: MenuId.ViewTitle,
				order: 20,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', WATCH_VIEW_ID)
			}
		});
	}

	run(accessor: ServicesAccessor): void {
		const debugService = accessor.get(IDebugService);
		debugService.removeWatchExpressions();
	}
});
