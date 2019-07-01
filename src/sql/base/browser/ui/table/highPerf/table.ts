/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Range } from 'vs/editor/common/core/range';
import { Position } from 'vs/editor/common/core/position';

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
	indexes: Range;
	browserEvent?: UIEvent;
}

export interface ITableMouseEvent<T> {
	browserEvent: MouseEvent;
	element: T | undefined;
	index: Position | undefined;
}

export interface ITableContextMenuEvent<T> {
	browserEvent: UIEvent;
	element: T | undefined;
	index: Position | undefined;
	anchor: HTMLElement | { x: number; y: number; };
}
