/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/buttonColumn.plugin';
import 'vs/css!./media/iconColumn';
import { BaseClickableColumn, getIconCellValue, IconColumnOptions } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { escape } from 'sql/base/common/strings';

export interface ButtonCellValue {
	iconCssClass?: string;
	title: string;
}

export interface ButtonColumnOptions extends IconColumnOptions {
	/**
	 * Whether to show the text.
	 */
	showText?: boolean
}

export class ButtonColumn<T extends Slick.SlickData> extends BaseClickableColumn<T> {

	constructor(private options: ButtonColumnOptions) {
		super();
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.id || this.options.title || this.options.field,
			width: this.options.width ?? 26,
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string => {
				const iconValue = getIconCellValue(this.options, dataContext);
				const escapedTitle = escape(iconValue.title ?? '');
				const iconCssClasses = iconValue.iconCssClass ? `codicon icon slick-plugin-icon ${iconValue.iconCssClass}` : '';
				const buttonTypeCssClass = this.options.showText ? 'slick-plugin-button slick-plugin-text-button' : 'slick-plugin-button slick-plugin-image-only-button';
				const buttonText = this.options.showText ? escapedTitle : '';
				return `<button tabindex=-1 class="${iconCssClasses} ${buttonTypeCssClass}" title="${escapedTitle}" aria-label="${escapedTitle}">${buttonText}</button>`;
			},
			name: this.options.name,
			resizable: this.options.resizable,
			selectable: false
		};
	}
}
