/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { escape } from 'sql/base/common/strings';
import { getIconCellValue, IconColumnOptions, TableColumn } from 'sql/base/browser/ui/table/plugins/tableColumn';

export interface TextWithIconColumnOptions extends IconColumnOptions {
	editor?: any;
}

export class TextWithIconColumn<T extends Slick.SlickData> implements TableColumn<T> {
	constructor(private options: TextWithIconColumnOptions) {
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.id || this.options.field,
			field: this.options.field,
			resizable: this.options.resizable,
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T): string => {
				const iconValue = getIconCellValue(this.options, dataContext);
				const titleValue = escape(iconValue.title ?? '');
				return `<div class="icon codicon slick-icon-cell-content ${iconValue.iconCssClass ?? ''}" title="${titleValue}">${titleValue}</div>`;
			},
			width: this.options.width,
			name: this.options.name,
			cssClass: 'slick-icon-cell',
			headerCssClass: this.options.headerCssClass,
			editor: this.options.editor
		};
	}
}
