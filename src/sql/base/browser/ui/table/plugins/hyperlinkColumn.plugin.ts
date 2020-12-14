/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/hyperlinkColumn.plugin';
import 'vs/css!./media/iconColumn';
import { BaseClickableColumn, getIconCellValue, IconColumnOptions } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { escape } from 'sql/base/common/strings';

export interface HyperlinkCellValue {
	iconCssClass?: string;
	title: string;
	url?: string;
}

export interface HyperlinkColumnOptions extends IconColumnOptions {
}

export class HyperlinkColumn<T extends Slick.SlickData> extends BaseClickableColumn<T> {
	constructor(private options: HyperlinkColumnOptions) {
		super();
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.id || this.options.title || this.options.field,
			width: this.options.width,
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string => {
				const iconValue = getIconCellValue(this.options, dataContext);
				const escapedTitle = escape(iconValue.title ?? '');
				const cellValue = dataContext[this.options.field] as HyperlinkCellValue;
				const cssClasses = iconValue.iconCssClass ? `codicon icon slick-plugin-icon ${iconValue.iconCssClass}` : '';
				const urlPart = cellValue?.url ? `href="${encodeURI(cellValue.url)}" target="blank"` : '';
				return `<a ${urlPart} class="slick-hyperlink-cell ${cssClasses}" tabindex=-1 title="${escapedTitle}" aria-label="${escapedTitle}">${escapedTitle}</a>`;
			},
			name: this.options.name,
			resizable: true,
			selectable: false
		};
	}
}
