/*-----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { textFormatter } from 'sql/base/browser/ui/table/formatters';
import { RowNumberColumn } from 'sql/base/browser/ui/table/plugins/rowNumberColumn.plugin';
import { escape } from 'sql/base/common/strings';
import { IDataResource, IDataResourceRow, rowHasColumnNameKeys } from 'sql/workbench/services/notebook/browser/sql/sqlSessionManager';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { MouseWheelSupport } from 'sql/base/browser/ui/table/plugins/mousewheelTableScroll.plugin';
import { AutoColumnSize } from 'sql/base/browser/ui/table/plugins/autoSizeColumns.plugin';
import { AdditionalKeyBindings } from 'sql/base/browser/ui/table/plugins/additionalKeyBindings.plugin';
import { RESULTS_GRID_DEFAULTS } from 'sql/workbench/common/constants';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { defaultTableStyles } from 'sql/platform/theme/browser/defaultStyles';

/**
 * Render DataResource as a grid into a host node.
 *
 * @params options - The options for rendering.
 *
 * @returns A promise which resolves when rendering is complete.
 */
export function renderDataResource(
	options: renderDataResource.IRenderOptions
): Promise<void> {
	// Unpack the options.
	let { host, source } = options;
	let sourceObject: IDataResource = JSON.parse(source);

	// Before doing anything, avoid re-rendering the table multiple
	// times (as can be the case when going untrusted -> trusted)
	while (host.firstChild) {
		host.removeChild(host.firstChild);
	}

	// Now create the table container
	let tableContainer = document.createElement('div');
	tableContainer.className = 'notebook-cellTable';

	const BOTTOM_PADDING_AND_SCROLLBAR = 14;
	let tableResultsData = new TableDataView();
	let columns: string[] = sourceObject.schema.fields.map(val => val.name);
	// Table object requires passed in columns to be of datatype Slick.Column
	let columnsTransformed = transformColumns(columns);

	// In order to show row numbers, we need to put the row number column
	// ahead of all of the other columns, and register the plugin below
	let rowNumberColumn = new RowNumberColumn();
	columnsTransformed.unshift(rowNumberColumn.getColumnDefinition());

	let transformedData = transformData(sourceObject.data, columnsTransformed);
	tableResultsData.push(transformedData);

	let detailTable = new Table(tableContainer, options.accessibilityService, options.quickInputService, defaultTableStyles, {
		dataProvider: tableResultsData, columns: columnsTransformed
	}, {
		rowHeight: RESULTS_GRID_DEFAULTS.rowHeight,
		forceFitColumns: false,
		defaultColumnWidth: 120
	});
	detailTable.registerPlugin(rowNumberColumn);
	detailTable.registerPlugin(new MouseWheelSupport());
	detailTable.registerPlugin(new AutoColumnSize({ autoSizeOnRender: true }));
	detailTable.registerPlugin(new AdditionalKeyBindings());
	let numRows = detailTable.grid.getDataLength();
	// Need to include column headers and scrollbar, so that's why 1 needs to be added
	let rowsHeight = (numRows + 1) * RESULTS_GRID_DEFAULTS.rowHeight + BOTTOM_PADDING_AND_SCROLLBAR + numRows;
	// if no rows are in the grid, set height to 100% of the container's height
	if (numRows === 0) {
		tableContainer.style.height = '100%';
	} else {
		// Set the height dynamically if the grid's height is < 500px high; otherwise, set height to 500px
		tableContainer.style.height = rowsHeight >= 500 ? '500px' : rowsHeight.toString() + 'px';
	}
	host.appendChild(tableContainer);
	detailTable.resizeCanvas();

	// Return the rendered promise.
	return Promise.resolve(undefined);
}

// SlickGrid requires columns and data to be in a very specific format; this code was adapted from tableInsight.component.ts
function transformData(rows: IDataResourceRow[], columns: Slick.Column<any>[]): IDataResourceRow[] {
	// Rows are either indexed by column name or ordinal number, so check for one column name to see if it uses that format
	let useColumnNameKey = rowHasColumnNameKeys(rows[0], columns.map(column => column.name));
	return rows.map(row => {
		let dataWithSchema = {};
		Object.keys(row).forEach((val, index) => {
			// Since the columns[0] represents the row number, start at 1
			let columnName = columns[index + 1].field;
			let sourceKey = useColumnNameKey ? columnName : index + 1;
			let displayValue = String(row[sourceKey]);
			dataWithSchema[columnName] = {
				displayValue: displayValue,
				ariaLabel: escape(displayValue),
				isNull: false
			};
		});
		return dataWithSchema;
	});
}

function transformColumns(columns: string[]): Slick.Column<any>[] {
	return columns.map((col, index) => {
		return <Slick.Column<any>>{
			name: col,
			id: col,
			field: index.toString(),
			formatter: textFormatter
		};
	});
}

/**
 * The namespace for the `renderDataResource` function statics.
 */
export namespace renderDataResource {
	/**
	 * The options for the `renderDataResource` function.
	 */
	export interface IRenderOptions {
		/**
		 * The host node for the rendered LaTeX.
		 */
		host: HTMLElement;

		/**
		 * The DataResource source to render.
		 */
		source: string;

		/**
		 * Theme service used to react to theme change events
		 */
		themeService?: IThemeService;

		/**
		 * Accessibility service used to get screen reader optimization flag state
		 */
		accessibilityService: IAccessibilityService;

		/**
		 * quickInput service is used to get user's input in column resizing.
		 */
		quickInputService?: IQuickInputService;
	}
}
