/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from 'vs/base/common/event';

export interface IDisposableDataProvider<T> extends Slick.DataProvider<T> {
	dispose(): void;
	getRangeAsync(startIndex: number, length: number): Promise<T[]>;
	getColumnValues(column: Slick.Column<T>): Promise<string[]>;
	getFilteredColumnValues(column: Slick.Column<T>): Promise<string[]>;
	filter(columns?: Slick.Column<T>[]): Promise<void>;
	sort(args: Slick.OnSortEventArgs<T>): Promise<void>;
	readonly onFilterStateChange: Event<void>;
	readonly onSortComplete: Event<Slick.OnSortEventArgs<T>>;
	readonly isDataInMemory: boolean;
}
