/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'sql/base/common/strings';

/**
 * Definition for column with icon on the left of text.
 */
export interface TextWithIconColumnDefinition<T extends Slick.SlickData> extends Slick.Column<T> {
	iconCssClassField?: string;
}

export interface TextWithIconColumnOptions<T extends Slick.SlickData> {
	iconCssClassField?: string;
	field?: string;
	width?: number;
	id?: string;
	resizable?: boolean;
	name?: string;
	headerCssClass?: string;
	formatter?: Slick.Formatter<T>
}

export class TextWithIconColumn<T extends Slick.SlickData> {

	private _definition: TextWithIconColumnDefinition<T>;

	constructor(options: TextWithIconColumnOptions<T>) {
		this._definition = {
			id: options.id,
			field: options.field,
			resizable: options.resizable,
			formatter: options.formatter ?? this.formatter,
			width: options.width,
			name: options.name,
			iconCssClassField: options.iconCssClassField,
			cssClass: 'slick-icon-cell',
			headerCssClass: options.headerCssClass
		};
	}
	private formatter(row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string {
		const iconColumn = columnDef as TextWithIconColumnDefinition<T>;
		return `<div class="icon codicon slick-icon-cell-content ${iconColumn.iconCssClassField ? dataContext[iconColumn.iconCssClassField] : ''}">${escape(value)}</div>`;
	}

	public get definition(): TextWithIconColumnDefinition<T> {
		return this._definition;
	}
}
