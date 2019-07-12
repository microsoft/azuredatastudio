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

export interface ITableDataSource<T> {
	getRow(index: number): Promise<T>;
}

export interface ITableEvent<T> {
	elements: T[];
	indexes: IGridRange[];
	browserEvent?: UIEvent;
}

export interface ITableMouseEvent<T> {
	browserEvent: MouseEvent;
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
