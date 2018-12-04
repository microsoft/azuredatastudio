/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { JobManagementUtilities } from 'sql/parts/jobManagement/common/jobManagementUtilities';
import * as Model from 'vs/base/parts/tree/browser/treeModel';
import { Color } from 'vs/base/common/color';
import { INavigator, MappedNavigator } from 'vs/base/common/iterator';
import { Event, Emitter, Relay } from 'vs/base/common/event';
import { TreeContext, defaultStyles } from 'vs/base/parts/tree/browser/treeImpl';
import { mixin } from 'vs/base/common/objects';
import { JobStepsTreeView } from 'sql/parts/jobManagement/views/jobStepsTreeView';

export class JobStepsTree implements tree.ITree {

	private container: HTMLElement;
	private context: tree.ITreeContext;
	private model: Model.TreeModel;
	private view: JobStepsTreeView;

	private treeonDidChangeFocus = new Relay<tree.IFocusEvent>();
	readonly onDidChangeFocus: Event<tree.IFocusEvent> = this.treeonDidChangeFocus.event;
	private treeonDidChangeSelection = new Relay<tree.ISelectionEvent>();
	readonly onDidChangeSelection: Event<tree.ISelectionEvent> = this.treeonDidChangeSelection.event;
	private treeonHighlightChange = new Relay<tree.IHighlightEvent>();
	readonly onDidChangeHighlight: Event<tree.IHighlightEvent> = this.treeonHighlightChange.event;
	private treeonDidExpandItem = new Relay<Model.IItemExpandEvent>();
	readonly onDidExpandItem: Event<Model.IItemExpandEvent> = this.treeonDidExpandItem.event;
	private treeonDidCollapseItem = new Relay<Model.IItemCollapseEvent>();
	readonly onDidCollapseItem: Event<Model.IItemCollapseEvent> = this.treeonDidCollapseItem.event;
	private treeonDispose = new Emitter<void>();
	readonly onDidDispose: Event<void> = this.treeonDispose.event;

	constructor(container: HTMLElement, configuration: tree.ITreeConfiguration, options: tree.ITreeOptions = {}) {
		this.container = container;
		mixin(options, defaultStyles, false);

		options.twistiePixels = typeof options.twistiePixels === 'number' ? options.twistiePixels : 32;
		options.showTwistie = options.showTwistie === false ? false : true;
		options.indentPixels = typeof options.indentPixels === 'number' ? options.indentPixels : 12;
		options.alwaysFocused = options.alwaysFocused === true ? true : false;
		options.useShadows = options.useShadows === false ? false : true;
		options.paddingOnRow = options.paddingOnRow === false ? false : true;
		options.showLoading = options.showLoading === false ? false : true;

		this.context = new TreeContext(this, configuration, options);
		this.model = new Model.TreeModel(this.context);
		this.view = new JobStepsTreeView(this.context, this.container);

		this.view.setModel(this.model);

		this.treeonDidChangeFocus.input = this.model.onDidFocus;
		this.treeonDidChangeSelection.input = this.model.onDidSelect;
		this.treeonHighlightChange.input = this.model.onDidHighlight;
		this.treeonDidExpandItem.input = this.model.onDidExpandItem;
		this.treeonDidCollapseItem.input = this.model.onDidCollapseItem;
	}

	public style(styles: tree.ITreeStyles): void {
		this.view.applyStyles(styles);
	}

	get onDidFocus(): Event<void> {
		return this.view && this.view.onDOMFocus;
	}

	get onDidBlur(): Event<void> {
		return this.view && this.view.onDOMBlur;
	}

	get onDidScroll(): Event<void> {
		return this.view && this.view.onDidScroll;
	}

	public getHTMLElement(): HTMLElement {
		return this.view.getHTMLElement();
	}

	public layout(height?: number, width?: number): void {
		this.view.layout(height, width);
	}

	public domFocus(): void {
		this.view.focus();
	}

	public isDOMFocused(): boolean {
		return this.view.isFocused();
	}

	public domBlur(): void {
		this.view.blur();
	}

	public onVisible(): void {
		this.view.onVisible();
	}

	public onHidden(): void {
		this.view.onHidden();
	}

	public setInput(element: any): Promise {
		return this.model.setInput(element);
	}

	public getInput(): any {
		return this.model.getInput();
	}

	public refresh(element: any = null, recursive = true): Promise {
		return this.model.refresh(element, recursive);
	}

	public updateWidth(element: any): void {
		let item = this.model.getItem(element);
		return this.view.updateWidth(item);
	}

	public expand(element: any): Promise {
		return this.model.expand(element);
	}

	public expandAll(elements: any[]): Promise {
		return this.model.expandAll(elements);
	}

	public collapse(element: any, recursive: boolean = false): Promise {
		return this.model.collapse(element, recursive);
	}

	public collapseAll(elements: any[] = null, recursive: boolean = false): Promise {
		return this.model.collapseAll(elements, recursive);
	}

	public toggleExpansion(element: any, recursive: boolean = false): Promise {
		return this.model.toggleExpansion(element, recursive);
	}

	public toggleExpansionAll(elements: any[]): Promise {
		return this.model.toggleExpansionAll(elements);
	}

	public isExpanded(element: any): boolean {
		return this.model.isExpanded(element);
	}

	public getExpandedElements(): any[] {
		return this.model.getExpandedElements();
	}

	public reveal(element: any, relativeTop: number = null): Promise {
		return this.model.reveal(element, relativeTop);
	}

	public getRelativeTop(element: any): number {
		let item = this.model.getItem(element);
		return this.view.getRelativeTop(item);
	}

	public getFirstVisibleElement(): any {
		return this.view.getFirstVisibleElement();

	}

	public getScrollPosition(): number {
		return this.view.getScrollPosition();
	}

	public setScrollPosition(pos: number): void {
		this.view.setScrollPosition(pos);
	}

	getContentHeight(): number {
		return this.view.getContentHeight();
	}

	public setHighlight(element?: any, eventPayload?: any): void {
		this.model.setHighlight(element, eventPayload);
	}

	public getHighlight(): any {
		return this.model.getHighlight();
	}

	public isHighlighted(element: any): boolean {
		return this.model.isFocused(element);
	}

	public clearHighlight(eventPayload?: any): void {
		this.model.setHighlight(null, eventPayload);
	}

	public select(element: any, eventPayload?: any): void {
		this.model.select(element, eventPayload);
	}

	public selectRange(fromElement: any, toElement: any, eventPayload?: any): void {
		this.model.selectRange(fromElement, toElement, eventPayload);
	}

	public deselectRange(fromElement: any, toElement: any, eventPayload?: any): void {
		this.model.deselectRange(fromElement, toElement, eventPayload);
	}

	public selectAll(elements: any[], eventPayload?: any): void {
		this.model.selectAll(elements, eventPayload);
	}

	public deselect(element: any, eventPayload?: any): void {
		this.model.deselect(element, eventPayload);
	}

	public deselectAll(elements: any[], eventPayload?: any): void {
		this.model.deselectAll(elements, eventPayload);
	}

	public setSelection(elements: any[], eventPayload?: any): void {
		this.model.setSelection(elements, eventPayload);
	}

	public toggleSelection(element: any, eventPayload?: any): void {
		this.model.toggleSelection(element, eventPayload);
	}

	public isSelected(element: any): boolean {
		return this.model.isSelected(element);
	}

	public getSelection(): any[] {
		return this.model.getSelection();
	}

	public clearSelection(eventPayload?: any): void {
		this.model.setSelection([], eventPayload);
	}

	public selectNext(count?: number, clearSelection?: boolean, eventPayload?: any): void {
		this.model.selectNext(count, clearSelection, eventPayload);
	}

	public selectPrevious(count?: number, clearSelection?: boolean, eventPayload?: any): void {
		this.model.selectPrevious(count, clearSelection, eventPayload);
	}

	public selectParent(clearSelection?: boolean, eventPayload?: any): void {
		this.model.selectParent(clearSelection, eventPayload);
	}

	public setFocus(element?: any, eventPayload?: any): void {
		this.model.setFocus(element, eventPayload);
	}

	public isFocused(element: any): boolean {
		return this.model.isFocused(element);
	}

	public getFocus(): any {
		return this.model.getFocus();
	}

	public focusNext(count?: number, eventPayload?: any): void {
		this.model.focusNext(count, eventPayload);
	}

	public focusPrevious(count?: number, eventPayload?: any): void {
		this.model.focusPrevious(count, eventPayload);
	}

	public focusParent(eventPayload?: any): void {
		this.model.focusParent(eventPayload);
	}

	public focusFirstChild(eventPayload?: any): void {
		this.model.focusFirstChild(eventPayload);
	}

	public focusFirst(eventPayload?: any, from?: any): void {
		this.model.focusFirst(eventPayload, from);
	}

	public focusNth(index: number, eventPayload?: any): void {
		this.model.focusNth(index, eventPayload);
	}

	public focusLast(eventPayload?: any, from?: any): void {
		this.model.focusLast(eventPayload, from);
	}

	public focusNextPage(eventPayload?: any): void {
		this.view.focusNextPage(eventPayload);
	}

	public focusPreviousPage(eventPayload?: any): void {
		this.view.focusPreviousPage(eventPayload);
	}

	public clearFocus(eventPayload?: any): void {
		this.model.setFocus(null, eventPayload);
	}

	public addTraits(trait: string, elements: any[]): void {
		this.model.addTraits(trait, elements);
	}

	public removeTraits(trait: string, elements: any[]): void {
		this.model.removeTraits(trait, elements);
	}

	public toggleTrait(trait: string, element: any): void {
		this.model.hasTrait(trait, element) ? this.model.removeTraits(trait, [element])
			: this.model.addTraits(trait, [element]);
	}

	public hasTrait(trait: string, element: any): boolean {
		return this.model.hasTrait(trait, element);
	}

	getNavigator(fromElement?: any, subTreeOnly?: boolean): INavigator<any> {
		return new MappedNavigator(this.model.getNavigator(fromElement, subTreeOnly), i => i && i.getElement());
	}

	public dispose(): void {
		this.treeonDispose.fire();

		if (this.model !== null) {
			this.model.dispose();
			this.model = null;
		}
		if (this.view !== null) {
			this.view.dispose();
			this.view = null;
		}

		this.treeonDidChangeFocus.dispose();
		this.treeonDidChangeSelection.dispose();
		this.treeonHighlightChange.dispose();
		this.treeonDidExpandItem.dispose();
		this.treeonDidCollapseItem.dispose();
		this.treeonDispose.dispose();
	}
}

export class JobStepsViewRow {
	public stepId: string;
	public stepName: string;
	public message: string;
	public rowID: string = generateUuid();
	public runStatus: string;
}

// Empty class just for tree input
export class JobStepsViewModel {
	public static readonly id = generateUuid();
}

export class JobStepsViewController extends TreeDefaults.DefaultController {

	protected onLeftClick(tree: tree.ITree, element: JobStepsViewRow, event: IMouseEvent, origin: string = 'mouse'): boolean {
		return true;
	}

	public onContextMenu(tree: tree.ITree, element: JobStepsViewRow, event: tree.ContextMenuEvent): boolean {
		return true;
	}

}

export class JobStepsViewDataSource implements tree.IDataSource {
	private treedata: JobStepsViewRow[];

	public getId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return JobStepsViewModel.id;
		} else {
			return (element as JobStepsViewRow).rowID;
		}
	}

	public hasChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): boolean {
		if (element instanceof JobStepsViewModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise {
		if (element instanceof JobStepsViewModel) {
			return TPromise.as(this.treedata);
		} else {
			return TPromise.as(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise {
		if (element instanceof JobStepsViewModel) {
			return TPromise.as(undefined);
		} else {
			return TPromise.as(new JobStepsViewModel());
		}
	}

	public set data(data: JobStepsViewRow[]) {
		this.treedata = data;
	}
}

export interface IListTemplate {
	statusIcon: HTMLElement;
	label: HTMLElement;
}

export class JobStepsViewRenderer implements tree.IRenderer {
	private treestatusIcon: HTMLElement;

	public getHeight(tree: tree.ITree, element: JobStepsViewRow): number {
		return 22 * Math.ceil(element.message.length/JobManagementUtilities.jobMessageLength);
	}

	public getTemplateId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return 'jobStepsViewModel';
		} else {
			return 'jobStepsViewRow';
		}
	}

	public renderTemplate(tree: tree.ITree, templateId: string, container: HTMLElement): IListTemplate {
		let row = DOM.$('.list-row');
		let label = DOM.$('.label');
		this.treestatusIcon = this.createStatusIcon();
		row.appendChild(this.treestatusIcon);
		row.appendChild(label);
		container.appendChild(row);
		let statusIcon = this.treestatusIcon;
		return { statusIcon, label };
	}

	public renderElement(tree: tree.ITree, element: JobStepsViewRow, templateId: string, templateData: IListTemplate): void {
		if (templateData.label.children.length > 0) {
			return;
		}
		let stepIdCol: HTMLElement = DOM.$('div');
		stepIdCol.className = 'tree-id-col';
		stepIdCol.innerText = element.stepId;
		let stepNameCol: HTMLElement = DOM.$('div');
		stepNameCol.className = 'tree-name-col';
		stepNameCol.innerText = element.stepName;
		let stepMessageCol: HTMLElement = DOM.$('div');
		stepMessageCol.className = 'tree-message-col';
		stepMessageCol.innerText = element.message;
		templateData.label.appendChild(stepIdCol);
		templateData.label.appendChild(stepNameCol);
		templateData.label.appendChild(stepMessageCol);
		let statusClass: string;
		if (element.runStatus === 'Succeeded') {
			statusClass = ' step-passed';
		} else if (element.runStatus === 'Failed') {
			statusClass = ' step-failed';
		} else {
			statusClass = ' step-unknown';
		}
		this.treestatusIcon.className += statusClass;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

	private createStatusIcon(): HTMLElement {
		let statusIcon: HTMLElement = DOM.$('div');
		statusIcon.className += 'status-icon';
		return statusIcon;
	}
}

export class JobStepsViewFilter implements tree.IFilter {
	private treefilterString: string;

	public isVisible(tree: tree.ITree, element: JobStepsViewRow): boolean {
		return this.treeisJobVisible();
	}

	private treeisJobVisible(): boolean {
		return true;
	}

	public set filterString(val: string) {
		this.treefilterString = val;
	}
}
