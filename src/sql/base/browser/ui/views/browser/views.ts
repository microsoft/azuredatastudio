/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IThemable } from 'vs/platform/theme/common/styler';
import * as errors from 'vs/base/common/errors';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IAction, IActionRunner } from 'vs/base/common/actions';
import { IActionItem, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { prepareActions } from 'vs/workbench/browser/actions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { DelayedDragHandler } from 'vs/base/browser/dnd';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { AbstractCollapsibleView, CollapsibleState, IView as IBaseView, SplitView, ViewSizing } from 'sql/base/browser/ui/splitview/splitview';
import { $ } from 'sql/base/browser/builder';

export interface IViewOptions {

	id: string;

	name: string;

	actionRunner: IActionRunner;

	collapsed: boolean;

}

export interface IViewConstructorSignature {

	new(initialSize: number, options: IViewOptions, ...services: { _serviceBrand: any; }[]): IView;

}

export interface IView extends IBaseView, IThemable {

	id: string;

	name: string;

	getHeaderElement(): HTMLElement;

	create(): TPromise<void>;

	setVisible(visible: boolean): TPromise<void>;

	isVisible(): boolean;

	getActions(): IAction[];

	getSecondaryActions(): IAction[];

	getActionItem(action: IAction): IActionItem;

	getActionsContext(): any;

	showHeader(): boolean;

	hideHeader(): boolean;

	focusBody(): void;

	isExpanded(): boolean;

	expand(): void;

	collapse(): void;

	getOptimalWidth(): number;

	shutdown(): void;
}

export interface ICollapsibleViewOptions extends IViewOptions {

	ariaHeaderLabel?: string;

	sizing: ViewSizing;

	initialBodySize?: number;

}

export abstract class CollapsibleView extends AbstractCollapsibleView implements IView {

	readonly id: string;
	readonly name: string;

	protected treeContainer: HTMLElement;
	protected tree: ITree;
	protected toDispose: IDisposable[];
	protected toolBar: ToolBar;
	protected actionRunner: IActionRunner;
	protected isDisposed: boolean;

	private _isVisible: boolean;

	private dragHandler: DelayedDragHandler;

	constructor(
		initialSize: number,
		options: ICollapsibleViewOptions,
		protected keybindingService: IKeybindingService,
		protected contextMenuService: IContextMenuService
	) {
		super(initialSize, {
			ariaHeaderLabel: options.ariaHeaderLabel,
			sizing: options.sizing,
			bodySize: options.initialBodySize ? options.initialBodySize : 4 * 22,
			initialState: options.collapsed ? CollapsibleState.COLLAPSED : CollapsibleState.EXPANDED,
		});

		this.id = options.id;
		this.name = options.name;
		this.actionRunner = options.actionRunner;
		this.toDispose = [];
	}

	protected changeState(state: CollapsibleState): void {
		this.updateTreeVisibility(this.tree, state === CollapsibleState.EXPANDED);

		super.changeState(state);
	}

	get draggableLabel(): string { return this.name; }

	public create(): TPromise<void> {
		return TPromise.as(null);
	}

	getHeaderElement(): HTMLElement {
		return this.header;
	}

	public renderHeader(container: HTMLElement): void {

		// Tool bar
		this.toolBar = new ToolBar($('div.actions').appendTo(container).getHTMLElement(), this.contextMenuService, {
			orientation: ActionsOrientation.HORIZONTAL,
			actionItemProvider: (action) => this.getActionItem(action),
			ariaLabel: nls.localize('viewToolbarAriaLabel', "{0} actions", this.name),
			getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id)
		});
		this.toolBar.actionRunner = this.actionRunner;
		this.updateActions();

		// Expand on drag over
		this.dragHandler = new DelayedDragHandler(container, () => {
			if (!this.isExpanded()) {
				this.expand();
			}
		});
	}

	protected updateActions(): void {
		this.toolBar.setActions(prepareActions(this.getActions()), prepareActions(this.getSecondaryActions()))();
		this.toolBar.context = this.getActionsContext();
	}

	protected renderViewTree(container: HTMLElement): HTMLElement {
		const treeContainer = document.createElement('div');
		container.appendChild(treeContainer);

		return treeContainer;
	}

	public getViewer(): ITree {
		return this.tree;
	}

	public isVisible(): boolean {
		return this._isVisible;
	}

	public setVisible(visible: boolean): TPromise<void> {
		if (this._isVisible !== visible) {
			this._isVisible = visible;
			this.updateTreeVisibility(this.tree, visible && this.state === CollapsibleState.EXPANDED);
		}

		return TPromise.as(null);
	}

	public focusBody(): void {
		this.focusTree();
	}

	protected reveal(element: any, relativeTop?: number): TPromise<void> {
		if (!this.tree) {
			return TPromise.as(null); // return early if viewlet has not yet been created
		}

		return this.tree.reveal(element, relativeTop);
	}

	public layoutBody(size: number): void {
		if (this.tree) {
			this.treeContainer.style.height = size + 'px';
			this.tree.layout(size);
		}
	}

	public getActions(): IAction[] {
		return [];
	}

	public getSecondaryActions(): IAction[] {
		return [];
	}

	public getActionItem(action: IAction): IActionItem {
		return null;
	}

	public getActionsContext(): any {
		return undefined;
	}

	public shutdown(): void {
		// Subclass to implement
	}

	public getOptimalWidth(): number {
		return 0;
	}

	public dispose(): void {
		this.isDisposed = true;
		this.treeContainer = null;

		if (this.tree) {
			this.tree.dispose();
		}

		if (this.dragHandler) {
			this.dragHandler.dispose();
		}

		this.toDispose = dispose(this.toDispose);

		if (this.toolBar) {
			this.toolBar.dispose();
		}

		super.dispose();
	}

	private updateTreeVisibility(tree: ITree, isVisible: boolean): void {
		if (!tree) {
			return;
		}

		if (isVisible) {
			$(tree.getHTMLElement()).show();
		} else {
			$(tree.getHTMLElement()).hide(); // make sure the tree goes out of the tabindex world by hiding it
		}

		if (isVisible) {
			tree.onVisible();
		} else {
			tree.onHidden();
		}
	}

	private focusTree(): void {
		if (!this.tree) {
			return; // return early if viewlet has not yet been created
		}

		// Make sure the current selected element is revealed
		const selection = this.tree.getSelection();
		if (selection.length > 0) {
			this.reveal(selection[0], 0.5).then(null, errors.onUnexpectedError);
		}

		// Pass Focus to Viewer
		this.tree.domFocus();
	}
}

export interface IViewletViewOptions extends IViewOptions {

	viewletSettings: object;

}

export interface IViewState {

	collapsed: boolean;

	size: number | undefined;

	isHidden: boolean;

	order: number;

}
