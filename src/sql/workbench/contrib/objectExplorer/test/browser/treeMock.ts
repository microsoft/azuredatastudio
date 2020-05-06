/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from 'vs/base/common/event';
import { INavigator } from 'sql/base/common/navigator';
import { ITree, IHighlightEvent, ISelectionEvent, IFocusEvent, ITreeStyles } from 'vs/base/parts/tree/browser/tree';
import { IItemExpandEvent, IItemCollapseEvent } from 'vs/base/parts/tree/browser/treeModel';

/**
 * A basic implementation of ITree to use for testing
 */
export class TestTree implements ITree {

	readonly onDidChangeFocus: Event<IFocusEvent>;
	readonly onDidChangeSelection: Event<ISelectionEvent>;
	readonly onDidChangeHighlight: Event<IHighlightEvent>;
	readonly onDidExpandItem: Event<IItemExpandEvent>;
	readonly onDidCollapseItem: Event<IItemCollapseEvent>;
	readonly onDidDispose: Event<void>;

	constructor() { }

	public style(styles: ITreeStyles): void { }

	get onDidFocus(): Event<void> { return undefined; }

	get onDidBlur(): Event<void> { return undefined; }

	get onDidScroll(): Event<void> { return undefined; }

	public getHTMLElement(): HTMLElement { return undefined; }

	public layout(height?: number, width?: number): void { }

	public domFocus(): void { }

	public isDOMFocused(): boolean { return true; }

	public domBlur(): void { }

	public onVisible(): void { }

	public onHidden(): void { }

	public setInput(element: any): Promise<any> { return Promise.resolve(true); }

	public getInput(): any { return undefined; }

	public refresh(element: any = null, recursive = true): Promise<any> { return Promise.resolve(true); }

	public expand(element: any): Promise<any> { return Promise.resolve(true); }

	public expandAll(elements: any[]): Promise<any> { return Promise.resolve(true); }

	public collapse(element: any, recursive: boolean = false): Promise<any> { return Promise.resolve(true); }

	public collapseAll(elements: any[] | null = null, recursive: boolean = false): Promise<any> { return Promise.resolve(true); }

	public toggleExpansion(element: any, recursive: boolean = false): Promise<any> { return Promise.resolve(true); }

	public isExpanded(element: any): boolean { return true; }

	public reveal(element: any, relativeTop: number | null = null): Promise<any> { return Promise.resolve(true); }

	public getExpandedElements(): any[] { return []; }

	public getScrollPosition(): number { return 0; }

	public setScrollPosition(pos: number): void { }

	getContentHeight(): number { return 0; }

	public getHighlight(): any { }

	public clearHighlight(eventPayload?: any): void { }

	public setSelection(elements: any[], eventPayload?: any): void { }

	public getSelection(): any[] { return []; }

	public clearSelection(eventPayload?: any): void { }

	public setFocus(element?: any, eventPayload?: any): void { }

	public getFocus(): any { }

	public focusNext(count?: number, eventPayload?: any): void { }

	public focusPrevious(count?: number, eventPayload?: any): void { }

	public focusParent(eventPayload?: any): void { }

	public focusFirstChild(eventPayload?: any): void { }

	public focusFirst(eventPayload?: any, from?: any): void { }

	public focusNth(index: number, eventPayload?: any): void { }

	public focusLast(eventPayload?: any, from?: any): void { }

	public focusNextPage(eventPayload?: any): void { }

	public focusPreviousPage(eventPayload?: any): void { }

	public clearFocus(eventPayload?: any): void { }

	public addTraits(trait: string, elements: any[]): void { }

	public removeTraits(trait: string, elements: any[]): void { }

	public select(element: any, eventPayload?: any): void { }

	public deselect(element: any, eventPayload?: any): void { }

	getNavigator(fromElement?: any, subTreeOnly?: boolean): INavigator<any> { return undefined; }

	public dispose(): void { }
}
