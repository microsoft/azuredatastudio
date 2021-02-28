/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { Event } from 'vs/base/common/event';
import { Color } from 'vs/base/common/color';

export interface IDisposableDataProvider<T> extends Slick.DataProvider<T> {
	dispose(): void;
	getColumnValues(column: Slick.Column<T>): Promise<string[]>;
	getFilteredColumnValues(column: Slick.Column<T>): Promise<string[]>;
	filter(columns?: Slick.Column<T>[]): Promise<void>;
	sort(args: Slick.OnSortEventArgs<T>): Promise<void>;
	readonly onFilterStateChange: Event<void>;
	readonly onSortComplete: Event<void>;
}

export interface ITableMouseEvent {
	anchor: HTMLElement | { x: number, y: number };
	cell?: { row: number, cell: number };
}

export interface ITableStyles extends IListStyles {
	tableHeaderBackground?: Color;
	tableHeaderForeground?: Color;
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
