/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { MessagePanel } from 'sql/workbench/contrib/query/browser/messagePanel';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { IQueryMessage, ResultSetSummary } from 'sql/workbench/services/query/common/query';
import QueryRunner, { QueryGridDataProvider } from 'sql/workbench/services/query/common/queryRunner';
import { Disposable } from 'vs/base/common/lifecycle';
import { isArray } from 'vs/base/common/types';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { localize } from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Progress } from 'vs/platform/progress/common/progress';
import { CancellationToken } from 'vs/base/common/cancellation';



export class ResultsAndMessagesPanel extends MessagePanel {
	private tables: Array<Table<any>> = [];
	private runner: QueryRunner;
	private messages: Array<IQueryMessage> = [];
	private formattedQueryResults: Array<string> = [];
	private resultSetCount: number = 0;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IUntitledTextEditorService private readonly untitledEditorService: IUntitledTextEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IClipboardService clipboardService: IClipboardService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IConfigurationService configurationService: IConfigurationService,
	) {
		super(instantiationService,
			themeService,
			contextMenuService,
			clipboardService,
			textResourcePropertiesService,
			configurationService);
	}

	public override set queryRunner(runner: QueryRunner) {
		super.queryRunner = runner;

		this.runner = runner;

		this.queryRunnerDisposables.add(this.runner.onQueryStart(this.onQueryStart, this));
		this.queryRunnerDisposables.add(this.runner.onResultSet(this.onResultSet, this));
		this.queryRunnerDisposables.add(this.runner.onResultSetUpdate(this.updateResultSet, this));
		this.queryRunnerDisposables.add(this.runner.onMessage(this.onMessage, this));
	}

	private onQueryStart() {
		this.messages = [];
		this.formattedQueryResults = [];
		this.resultSetCount = 0;
	}

	protected override onMessage(incomingMessage: IQueryMessage | IQueryMessage[]) {
		if (isArray(incomingMessage)) {
			incomingMessage.forEach(m => {
				if (m.message.includes('Started executing query')) {
					return;
				}

				if (this.messages.findIndex(queryMessage => queryMessage.message === m.message) < 0) {
					this.messages.push(m);
				}
			});
		}
		else {
			if (this.messages.findIndex(m => m.message === incomingMessage.message) < 0) {
				this.messages.push(incomingMessage);
			}
		}
	}

	private async onQueryEnd() {
		let combinedContents = this.mergeResultsWithMessages();
		let content = combinedContents.map(m => {
			if (m.includes('rows affected') || m.includes('row affected')) {
				return '\r\n' + m + '\r\n';
			}

			return m;
		}).join('\r\n');

		const input = this.untitledEditorService.create({ initialValue: content });
		await input.resolve();
		input.setDirty(false);
		await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);

		return this.editorService.openEditor(input);
	}

	private mergeResultsWithMessages() {
		let content: Array<string> = [];
		let extractedMessages = this.messages.map(m => m.message);

		// Merges query result set before respective '# row(s) affected' message
		while (extractedMessages.length > 0 && this.formattedQueryResults.length > 0) {
			if (extractedMessages[0]?.includes('rows affected') || extractedMessages[0]?.includes('row affected')) {
				content.push(this.formattedQueryResults.shift());
				content.push(extractedMessages.shift());
			}
			else {
				content.push(extractedMessages.shift());
			}
		}

		// merges remaining messages or query results
		return [...content, ...extractedMessages, ...this.formattedQueryResults];
	}

	public async postResults(results: string) {
		this.resultSetCount--;
		this.formattedQueryResults.push(results);

		if (this.resultSetCount === 0) {
			await this.onQueryEnd();
		}
	}

	private onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		this.resultSetCount++;
		let resultsToAdd: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToAdd = [resultSet];
		} else {
			resultsToAdd = resultSet.splice(0);
		}

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			this.addResultSet(resultsToAdd);
		} else {
			resultsToAdd = resultsToAdd.filter(e => e.complete);
			if (resultsToAdd.length > 0) {
				this.addResultSet(resultsToAdd);
			}
		}
	}

	private updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultsToUpdate: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet.splice(0);
		}

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			for (let set of resultsToUpdate) {
				let table = this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id);
				if (table) {
					table.updateResult(set);
				} else {
					this.logService.warn('Got result set update request for non-existant table');
				}
			}
		} else {
			resultsToUpdate = resultsToUpdate.filter(e => e.complete);
			if (resultsToUpdate.length > 0) {
				this.addResultSet(resultsToUpdate);
			}
		}
	}

	private addResultSet(resultSet: ResultSetSummary[]) {
		const tables: Array<Table<any>> = [];

		for (const set of resultSet) {
			// ensure we aren't adding a resultSet that is already visible
			if (this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id)) {
				continue;
			}

			const table = this.instantiationService.createInstance(Table, this.runner, set, this);

			tables.push(table);
		}

		this.tables = this.tables.concat(tables);

		// turn-off special-case process when only a single table is being displayed
		if (this.tables.length > 1) {
			for (let i = 0; i < this.tables.length; ++i) {
				this.tables[i].isOnlyTable = false;
			}
		}
	}
}

class Table<T> extends Disposable {
	public isOnlyTable: boolean = true;
	public gridDataProvider: IGridDataProvider;
	public columns: Slick.Column<T>[];

	constructor(
		private runner: QueryRunner,
		public resultSet: ResultSetSummary,
		private resultsAndMessagesPanel: ResultsAndMessagesPanel,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		this.columns = this.resultSet.columnInfo.map((c, i) => {
			let isLinked = c.isXml || c.isJson;

			return <Slick.Column<T>>{
				id: i.toString(),
				name: c.columnName === 'Microsoft SQL Server 2005 XML Showplan'
					? localize('xmlShowplan', "XML Showplan")
					: escape(c.columnName),
				field: i.toString(),
				formatter: isLinked ? hyperLinkFormatter : textFormatter,
				width: c.columnSize
			};
		});

		this.gridDataProvider = this.instantiationService.createInstance(QueryGridDataProvider, this.runner, resultSet.batchId, resultSet.id);
	}

	public updateResult(resultSet: ResultSetSummary) {
		this.resultSet = resultSet;

		if (this.resultSet.complete) {
			let offset = 0;
			this.getData(offset, resultSet.rowCount);
		}
	}

	private async getData(offset: number, count: number): Promise<void> {
		let response = await this.gridDataProvider.getRowData(offset, count);
		if (!response) {
			return;
		}

		let rawData = response.rows.map(row => {
			let dataWithSchema = {};

			for (let col = 0; col < this.columns.length; col++) {
				dataWithSchema[this.columns[col].field] = {
					displayValue: row[col].displayValue,
					ariaLabel: escape(row[col].displayValue),
					isNull: row[col].isNull,
					invariantCultureDisplayValue: row[col].invariantCultureDisplayValue
				};
			}
			return dataWithSchema as T;
		});

		let formattedResults = this.formatQueryResults(rawData);
		await this.resultsAndMessagesPanel.postResults(formattedResults);
	}

	private calculateColumnWidths(): number[] {
		let columnSizes: number[] = [];

		for (const column of this.columns) {
			let colSize = column.width;
			if (column.name.length > colSize) {
				colSize = column.name.length;
			}

			columnSizes.push(colSize);
		}

		return columnSizes;
	}

	private buildHeader(columnSizes: number[]): string[] {
		let tableHeader: string[] = [];

		let columnNames = '';
		for (let i = 0; i < this.columns.length; ++i) {
			columnNames += (this.columns[i].name !== undefined) ? this.columns[i].name : '';

			if (i < this.columns.length - 1) {
				columnNames += ' '.repeat(columnSizes[i] - this.columns[i].name.length).concat(' ');
			}
		}
		tableHeader.push(columnNames);

		let headingDivider = columnSizes.map((size, i) => {
			let columnUnderline = '-'.repeat(size);

			if (i < this.columns.length - 1) {
				columnUnderline += ' ';
			}

			return columnUnderline;
		}).join('');
		tableHeader.push(headingDivider);

		return tableHeader;
	}

	private formatData(dataRows: any[], columnSizes: number[]): string[] {
		let formattedRows: string[] = [];

		let rows: IRow[] = dataRows;
		rows.forEach(r => {
			let row = '';

			for (let i = 0; i < this.columns.length; ++i) {
				row += r[i].displayValue;

				if (i < this.columns.length - 1) {
					row += ' '.repeat(columnSizes[i] - r[i].displayValue.length).concat(' ');
				}
			}

			formattedRows.push(row);
		});

		return formattedRows;
	}

	private formatQueryResults(dataRows: any[]): string {
		let columnWidths = this.calculateColumnWidths();
		let formattedTable = this.buildHeader(columnWidths);
		formattedTable = formattedTable.concat(this.formatData(dataRows, columnWidths));

		return formattedTable.join('\r\n');
	}
}

interface IRow {
	displayValue: string;
	ariaLabel: string;
	isNull: boolean;
	invariantCultureDisplayValue: string;
}

