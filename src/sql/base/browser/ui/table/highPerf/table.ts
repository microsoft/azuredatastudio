/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IGridRange } from 'sql/base/common/gridRange';
import { IGridPosition } from 'sql/base/common/gridPosition';

export interface ITableRenderer<T, TTemplateData> {
	renderTemplate(container: HTMLElement): TTemplateData;
	renderCell(element: T, index: number, cell: number, columnId: string, templateData: TTemplateData, width: number | undefined): void;
	disposeCell?(element: T, index: number, cell: number, olumnId: string, templateData: TTemplateData, width: number | undefined): void;
	disposeTemplate(templateData: TTemplateData): void;
}

export interface IStaticTableRenderer<T, TTemplateData> extends ITableRenderer<T, TTemplateData> {
	renderCell(element: T | undefined, index: number, cell: number, columnId: string, templateData: TTemplateData, width: number | undefined): void;
	disposeCell?(element: T | undefined, index: number, cell: number, columnId: string, templateData: TTemplateData, width: number | undefined): void;
}

export class TableError extends Error {

	constructor(user: string, message: string) {
		super(`TableError [${user}] ${message}`);
	}
}

export interface ITableDataSource<T> {
	getRow(index: number): Promise<T>;
}

export interface ITableEvent<T> {
	elements: T[];
	indexes: IGridRange[];
	browserEvent?: UIEvent;
}

export interface ITableMouseEvent<T> {
	browserEvent: PointerEvent;
	buttons: number;
	element: T | undefined;
	index: IGridPosition | undefined;
}

export interface ITableContextMenuEvent<T> {
	browserEvent: UIEvent;
	element: T | undefined;
	index: IGridPosition | undefined;
	anchor: HTMLElement | { x: number; y: number; };
}

export interface ITableDragEvent {
	start: IGridPosition;
	current: IGridPosition;
}

export interface ITableColumn<T, TTemplateData> {
	/**
	 * Renderer associated with this column
	 */
	renderer: ITableRenderer<T, TTemplateData> | IStaticTableRenderer<T, TTemplateData>;
	/**
	 * Initial width of this column
	 */
	width?: number;
	/**
	 * Minimum allowed width of this column
	 */
	minWidth?: number;
	/**
	 * Is this column resizable?
	 */
	resizeable?: boolean;
	/**
	 * This string will be added to the cell as a class
	 * Useful for styling specific columns
	 */
	cellClass?: string;
	/**
	 * Specifies this column doesn't need data to render
	 * Useful when you don't need to wait for data you render a column
	 */
	static?: boolean;
	id: string;
	/**
	 * Name to display in the column header
	 */
	name: string;
}

export interface IStaticColumn<T, TTemplateData> extends ITableColumn<T, TTemplateData> {
	/**
	 * Renderer associated with this column
	 */
	renderer: IStaticTableRenderer<T, TTemplateData>;
}
