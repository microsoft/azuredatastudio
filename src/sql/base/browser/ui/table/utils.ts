/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function defaultFormatter<T>(valueProperty: keyof T): Slick.Formatter<T> {
	return (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: Slick.SlickData): string => {
		return value[valueProperty];
	};
}
