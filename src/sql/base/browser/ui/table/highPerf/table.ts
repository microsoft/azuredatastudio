/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IColumnRenderer<T, TTemplateData> {
	renderTemplate(container: HTMLElement): TTemplateData;
	renderElement(element: T, index: number, templateData: TTemplateData, width: number | undefined): void;
	renderHeader(container: HTMLElement, element: T, width: number | undefined): void;
	disposeElement?(element: T, index: number, templateData: TTemplateData, width: number | undefined): void;
	disposeTemplate(templateData: TTemplateData): void;
}

export interface ITableDataSource<T> {
	getRow(index: number): Promise<T>;
}

export interface ITableMouseEvent<T> {
	browserEvent: MouseEvent;
	element: T | undefined;
	index: number | undefined;
}
