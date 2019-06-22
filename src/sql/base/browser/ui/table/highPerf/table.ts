/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ITableRenderer<T, TTemplateData> {
	renderTemplate(container: HTMLElement): TTemplateData;
	renderCell(element: T, index: number, templateData: TTemplateData, width: number | undefined): void;
	disposeCell?(element: T, index: number, templateData: TTemplateData, width: number | undefined): void;
	disposeTemplate(templateData: TTemplateData): void;
}

export interface ITableDataSource<T> {
	getRow(index: number): Promise<T>;
}

export interface ITableEvent<T> {
	elements: T[];
	indexes: number[];
	browserEvent?: UIEvent;
}

export interface ITableMouseEvent<T> {
	browserEvent: MouseEvent;
	element: T | undefined;
	index: number | undefined;
}

export interface ITableContextMenuEvent<T> {
	browserEvent: UIEvent;
	element: T | undefined;
	index: number | undefined;
	anchor: HTMLElement | { x: number; y: number; };
}
