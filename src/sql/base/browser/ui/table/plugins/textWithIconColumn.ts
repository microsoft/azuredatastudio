/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Definition for column with icon on the left of text.
 */
export interface TextWithIconColumnDefinition<T extends Slick.SlickData> extends Slick.Column<T> {
	iconCssClassField?: string;
}

export interface TextWidthIconColumnOptions {
	iconCssClassField?: string;
	field?: string;
	width?: number;
	id?: string;
	resizable?: boolean;
	name?: string;
}

export class TextWidthIconColumn<T extends Slick.SlickData> {

	private _definition: TextWithIconColumnDefinition<T>;

	constructor(options: TextWidthIconColumnOptions) {
		this._definition = {
			id: options.id,
			field: options.field,
			resizable: options.resizable,
			formatter: this.formatter,
			width: options.width,
			name: options.name,
			iconCssClassField: options.iconCssClassField,
			cssClass: 'slick-icon-cell'
		};
	}
	private formatter(row: number, cell: number, value: any, columnDef: TextWithIconColumnDefinition<Slick.SlickData>, dataContext: Slick.SlickData): string {
		return `<div class="codicon slick-icon-cell-content ${dataContext[columnDef.iconCssClassField]}">${value}</div>`;
	}

	public get definition(): TextWithIconColumnDefinition<T> {
		return this._definition;
	}
}
