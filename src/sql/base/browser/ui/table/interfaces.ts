/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposableDataProvider } from 'sql/base/common/dataProvider';

export interface ITableMouseEvent {
	anchor: HTMLElement | { x: number, y: number };
	cell?: { row: number, cell: number };
}

export interface ITableStyles {
	listFocusBackground: string | undefined;
	listFocusForeground: string | undefined;
	listActiveSelectionBackground: string | undefined;
	listActiveSelectionForeground: string | undefined;
	listFocusAndSelectionBackground: string | undefined;
	listFocusAndSelectionForeground: string | undefined;
	listInactiveFocusBackground: string | undefined;
	listInactiveSelectionBackground: string | undefined;
	listInactiveSelectionForeground: string | undefined;
	listHoverBackground: string | undefined;
	listHoverForeground: string | undefined;
	listDropBackground: string | undefined;
	listFocusOutline: string | undefined;
	listSelectionOutline: string | undefined;
	listHoverOutline: string | undefined;
	listInactiveFocusOutline: string | undefined;
	tableHeaderBackground: string | undefined;
	tableHeaderForeground: string | undefined;
}

export interface ITableSorter<T> {
	(args: Slick.OnSortEventArgs<T>): void;
}

export interface ITableConfiguration<T> {
	dataProvider?: IDisposableDataProvider<T> | Array<T>;
	columns?: Slick.Column<T>[];
	sorter?: ITableSorter<T>;
}

export interface FilterableColumn<T> extends Slick.Column<T> {
	filterable?: boolean;
	filterValues?: Array<string>;
}

export interface ITableKeyboardEvent {
	cell?: { row: number, cell: number };
	event: KeyboardEvent;
}
