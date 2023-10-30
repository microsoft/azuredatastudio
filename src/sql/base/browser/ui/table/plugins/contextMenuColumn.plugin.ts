/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseClickableColumn, ClickableColumnOptions, IconColumnOptions } from 'sql/base/browser/ui/table/plugins/tableColumn';
import { localize } from 'vs/nls';

export interface ContextMenuCellValue {
	/**
	 * The title of the hyperlink. By default, the title is 'Show Actions'
	 */
	title?: string;
	/**
	 * commands for the menu. Use an array for a group and menu separators will be added.
	 */
	commands: (string | string[])[];
	/**
	 * context that will be passed to the commands.
	 */
	context: { [key: string]: string | boolean | number } | string | boolean | number | undefined
}

export interface ContextMenuColumnOptions extends IconColumnOptions, ClickableColumnOptions {
}

export class ContextMenuColumn<T extends Slick.SlickData> extends BaseClickableColumn<T> {
	constructor(private options: ContextMenuColumnOptions) {
		super(options);
	}

	public get definition(): Slick.Column<T> {
		return {
			id: this.options.id || this.options.title || this.options.field,
			width: this.options.width ?? 26,
			formatter: (row: number, cell: number, value: any, columnDef: Slick.Column<T>, dataContext: T):
				string => {
				const escapedTitle = escape(this.options.title ?? localize('table.showActions', "Show Actions"));
				return `
				<button tabIndex=0 title="${escapedTitle}" aria-label="${escapedTitle}" class="codicon toggle-more context-menu-button">
				</button>
				`;
			},
			name: this.options.name,
			resizable: this.options.resizable,
			selectable: false,
			focusable: true
		};
	}
}
