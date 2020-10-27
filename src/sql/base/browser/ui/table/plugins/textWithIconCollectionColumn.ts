/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Definition for column with one of collection of icons on the left of text.
 */
export interface TextWithIconCollectionColumnDefinition<T extends Slick.SlickData> extends Slick.Column<T> {
	iconCssCollection: string[],
	iconCssIndexField?: string;
}

export interface TextWithIconCollectionColumnOptions {
	iconCssClassField?: string;
	field?: string;
	width?: number;
	id?: string;
	resizable?: boolean;
	name?: string;
	headerCssClass?: string;
	formatter?: Slick.Formatter<any>,
	iconCssCollection: string[],
	iconCssIndexField: string
}

export class TextWithIconCollectionColumn<T extends Slick.SlickData> {

	private _definition: TextWithIconCollectionColumnDefinition<T>;

	constructor(options: TextWithIconCollectionColumnOptions) {
		this._definition = {
			id: options.id,
			field: options.field,
			resizable: options.resizable,
			formatter: options.formatter,
			width: options.width,
			name: options.name,
			cssClass: 'slick-icon-cell',
			headerCssClass: options.headerCssClass,
			iconCssCollection: options.iconCssCollection,
			iconCssIndexField: options.iconCssIndexField

		};
	}

	public get definition(): TextWithIconCollectionColumnDefinition<T> {
		return this._definition;
	}
}
