/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookEditor, INotebookSection, INotebookParams } from 'sql/workbench/services/notebook/browser/notebookService';
import { ICellModel, INotebookModel } from 'sql/workbench/contrib/notebook/browser/models/modelInterfaces';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { CellType } from 'sql/workbench/contrib/notebook/common/models/contracts';

export class NotebookComponentStub implements INotebookEditor {
	get notebookParams(): INotebookParams {
		throw new Error('Method not implemented.');
	}
	get id(): string {
		throw new Error('Method not implemented.');
	}
	get cells(): ICellModel[] {
		throw new Error('Method not implemented.');
	}
	get modelReady(): Promise<INotebookModel> {
		throw new Error('Method not implemented.');
	}
	get model(): INotebookModel {
		throw new Error('Method not implemented.');
	}
	isDirty(): boolean {
		throw new Error('Method not implemented.');
	}
	isActive(): boolean {
		throw new Error('Method not implemented.');
	}
	isVisible(): boolean {
		throw new Error('Method not implemented.');
	}
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean {
		throw new Error('Method not implemented.');
	}
	runCell(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearOutput(cell: ICellModel): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	clearAllOutputs(): Promise<boolean> {
		throw new Error('Method not implemented.');
	}
	getSections(): INotebookSection[] {
		throw new Error('Method not implemented.');
	}
	navigateToSection(sectionId: string): void {
		throw new Error('Method not implemented.');
	}
	addCell(cellType: CellType, index?: number, event?: Event) {
		throw new Error('Method not implemented.');
	}
}

export class NodeStub implements Node {
	baseURI: string;
	childNodes: NodeListOf<ChildNode>;
	firstChild: ChildNode;
	isConnected: boolean;
	lastChild: ChildNode;
	namespaceURI: string;
	nextSibling: ChildNode;
	nodeName: string;
	nodeType: number;
	nodeValue: string;
	ownerDocument: Document;
	parentElement: HTMLElement;
	parentNode: Node & ParentNode;
	previousSibling: Node;
	textContent: string;
	appendChild<T extends Node>(newChild: T): T {
		throw new Error('Method not implemented.');
	}
	cloneNode(deep?: boolean): Node {
		throw new Error('Method not implemented.');
	}
	compareDocumentPosition(other: Node): number {
		throw new Error('Method not implemented.');
	}
	contains(other: Node): boolean {
		throw new Error('Method not implemented.');
	}
	getRootNode(options?: GetRootNodeOptions): Node {
		throw new Error('Method not implemented.');
	}
	hasChildNodes(): boolean {
		throw new Error('Method not implemented.');
	}
	insertBefore<T extends Node>(newChild: T, refChild: Node): T {
		throw new Error('Method not implemented.');
	}
	isDefaultNamespace(namespace: string): boolean {
		throw new Error('Method not implemented.');
	}
	isEqualNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	isSameNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	lookupNamespaceURI(prefix: string): string {
		throw new Error('Method not implemented.');
	}
	lookupPrefix(namespace: string): string {
		throw new Error('Method not implemented.');
	}
	normalize(): void {
		throw new Error('Method not implemented.');
	}
	removeChild<T extends Node>(oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	replaceChild<T extends Node>(newChild: Node, oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	ATTRIBUTE_NODE: number;
	CDATA_SECTION_NODE: number;
	COMMENT_NODE: number;
	DOCUMENT_FRAGMENT_NODE: number;
	DOCUMENT_NODE: number;
	DOCUMENT_POSITION_CONTAINED_BY: number;
	DOCUMENT_POSITION_CONTAINS: number;
	DOCUMENT_POSITION_DISCONNECTED: number;
	DOCUMENT_POSITION_FOLLOWING: number;
	DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: number;
	DOCUMENT_POSITION_PRECEDING: number;
	DOCUMENT_TYPE_NODE: number;
	ELEMENT_NODE: number;
	ENTITY_NODE: number;
	ENTITY_REFERENCE_NODE: number;
	NOTATION_NODE: number;
	PROCESSING_INSTRUCTION_NODE: number;
	TEXT_NODE: number;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
	dispatchEvent(event: Event): boolean {
		throw new Error('Method not implemented.');
	}
	removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
}
