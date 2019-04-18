/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IListStyles } from 'vs/base/browser/ui/list/listWidget';
import { Color } from 'vs/base/common/color';

export interface IDisposableDataProvider<T> extends Slick.DataProvider<T> {
	dispose(): void;
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
