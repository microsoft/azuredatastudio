/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Icon column Definition
 */
export interface IconColumnDefinition<T extends Slick.SlickData> extends Slick.Column<T> {
	iconCssClassField?: string;
}

/**
 * Icon formatter
 */
export const IconFormatter: Slick.Formatter<Slick.SlickData> =
	(row: number, cell: number, value: any, columnDef: IconColumnDefinition<Slick.SlickData>, dataContext: Slick.SlickData): string => {
		return `<div class="codicon slick-icon-column ${dataContext[columnDef.iconCssClassField]}"></div>`;
	};
