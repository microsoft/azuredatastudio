/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from 'vs/base/common/event';

/**
 * Interface for table data providers
 */
export interface IDisposableDataProvider<T> extends Slick.DataProvider<T> {
	/**
	 * Disposes the data provider object
	 */
	dispose(): void;

	/**
	 * Gets the rows of the giving range
	 * @param startIndex Start index of the range
	 * @param length Length of the rows to retrieve
	 */
	getRangeAsync(startIndex: number, length: number): Promise<T[]>;

	/**
	 * Gets unique values of all the cells in the given column
	 * @param column the column information
	 */
	getColumnValues(column: Slick.Column<T>): Promise<string[]>;

	/**
	 * Gets the unique values of the filtered cells in the given column
	 * @param column
	 */
	getFilteredColumnValues(column: Slick.Column<T>): Promise<string[]>;

	/**
	 * Filters the data
	 * @param columns columns to be filtered, the
	 */
	filter(columns?: Slick.Column<T>[]): Promise<void>;

	/**
	 * Sorts the data
	 * @param args sort arguments
	 */
	sort(args: Slick.OnSortEventArgs<T>): Promise<void>;

	/**
	 * Event fired when the filters changed
	 */
	readonly onFilterStateChange: Event<void>;

	/**
	 * Event fired when the sorting is completed
	 */
	readonly onSortComplete: Event<Slick.OnSortEventArgs<T>>;

	/**
	 * Gets a boolean value indicating whether the data is current in memory
	 */
	readonly isDataInMemory: boolean;
}
