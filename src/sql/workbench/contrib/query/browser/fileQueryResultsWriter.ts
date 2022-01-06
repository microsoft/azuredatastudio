/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { IQueryMessage, ResultSetSummary, IQueryResultsWriter } from 'sql/workbench/services/query/common/query';
import QueryRunner, { QueryGridDataProvider } from 'sql/workbench/services/query/common/queryRunner';
import { asArray } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Disposable } from 'vs/base/common/lifecycle';
import { isArray } from 'vs/base/common/types';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import * as nls from 'vs/nls';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { Progress } from 'vs/platform/progress/common/progress';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';

export class FileQueryResultsWriter implements IQueryResultsWriter {
	private messages: Array<IQueryMessage> = [];
	private formattedQueryResults: Array<string> = [];
	private tables: Array<Table<any>> = [];
	private numQueriesToFormat: number = 0;
	private queryContainsError: boolean = false;
	private closingMessageIncluded: boolean = false;
	private hasCreatedResultsFile: boolean = false;

	private readonly startedExecutingQueryMessage: string;
	private readonly totalExecutionTimeMessage: string;
	private readonly rowAffectedMessage: string;
	private readonly rowsAffectedMessage: string;
	private readonly newLineEscapeSequence: string = this.textResourcePropertiesService.getEOL(undefined);

	constructor(
		private runner: QueryRunner,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IUntitledTextEditorService private readonly untitledEditorService: IUntitledTextEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		this.startedExecutingQueryMessage = nls.localize('query.message.startingExecutionQuery', 'Started executing query');
		this.totalExecutionTimeMessage = nls.localize('query.message.totalExecutionTime', 'Total execution time');
		this.rowAffectedMessage = nls.localize('query.message.rowAffected', 'row affected');
		this.rowsAffectedMessage = nls.localize('query.message.rowsAffected', 'rows affected');
	}

	public onQueryStart() {
		this.reset();
	}

	public onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		this.numQueriesToFormat++;
		let resultsToAdd = asArray(resultSet);

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			this.addResultSet(resultsToAdd);
		} else {
			resultsToAdd = resultsToAdd.filter(e => e.complete);
			if (resultsToAdd.length > 0) {
				this.addResultSet(resultsToAdd);
			}
		}
	}

	public async updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultSetSummaries = asArray(resultSet);

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			for (let resultSetSummary of resultSetSummaries) {
				let table = this.tables.find(t => t.resultSet.batchId === resultSetSummary.batchId && t.resultSet.id === resultSetSummary.id);
				if (table) {
					await table.updateResult(resultSetSummary);
				} else {
					this.logService.warn('Got result set update request for non-existant table');
				}
			}
		} else {
			resultSetSummaries = resultSetSummaries.filter(e => e.complete);
			if (resultSetSummaries.length > 0) {
				this.addResultSet(resultSetSummaries);
			}
		}
	}

	public async onMessage(incomingMessage: IQueryMessage | IQueryMessage[]) {
		if (isArray(incomingMessage)) {
			incomingMessage.forEach(m => {
				if (m.message.includes(this.startedExecutingQueryMessage)) {
					return;
				}

				if (m.isError) {
					this.queryContainsError = true;
				}

				if (m.message.includes(this.totalExecutionTimeMessage)) {
					this.closingMessageIncluded = true;
				}

				this.messages.push(m);
			});
		}
		else {
			this.messages.push(incomingMessage);
		}

		if (!this.hasCreatedResultsFile && this.closingMessageIncluded && this.queryContainsError && this.numQueriesToFormat === 0) {
			await this.createResultsFile();
		}
	}

	public reset() {
		this.messages = [];
		this.formattedQueryResults = [];
		this.tables = [];
		this.numQueriesToFormat = 0;
		this.queryContainsError = false;
		this.closingMessageIncluded = false;
		this.hasCreatedResultsFile = false;
	}

	private addResultSet(resultSetSummaries: ResultSetSummary[]) {
		for (const resultSetSummary of resultSetSummaries) {
			// ensure we aren't adding a resultSet that has already been added
			if (this.tables.find(t => t.resultSet.batchId === resultSetSummary.batchId && t.resultSet.id === resultSetSummary.id)) {
				continue;
			}

			const table = this.instantiationService.createInstance(Table, this.runner, resultSetSummary, this.textResourcePropertiesService, this);
			this.tables.push(table);
		}
	}

	public async aggregateQueryResults(results: string) {
		this.numQueriesToFormat--;
		this.formattedQueryResults.push(results);

		if (this.numQueriesToFormat === 0 && !this.hasCreatedResultsFile) {
			await this.createResultsFile();
		}
	}

	private async createResultsFile() {
		let fileContent = this.mergeQueryResultsWithMessages();

		let fileData = fileContent.map(m => {
			if (m.includes(this.rowsAffectedMessage) || m.includes(this.rowAffectedMessage)) {
				return this.newLineEscapeSequence + m + this.newLineEscapeSequence;
			}
			else if (m.includes(this.totalExecutionTimeMessage)) {
				return this.newLineEscapeSequence + m;
			}

			return m;
		}).join(this.newLineEscapeSequence);

		const input = this.untitledEditorService.create({ initialValue: fileData });
		await input.resolve();
		input.setDirty(false);
		await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
		this.hasCreatedResultsFile = true;

		return this.editorService.openEditor(input);
	}

	private mergeQueryResultsWithMessages() {
		let content: Array<string> = [];
		let extractedMessages = this.messages.map(m => m.message);

		// Merges query result set before respective '# row(s) affected' message
		while (extractedMessages.length > 0 && this.formattedQueryResults.length > 0) {
			if (extractedMessages[0]?.includes(this.rowsAffectedMessage) || extractedMessages[0]?.includes(this.rowAffectedMessage)) {
				content.push(this.newLineEscapeSequence + this.formattedQueryResults.shift());
			}

			content.push(extractedMessages.shift());
		}

		// append any remaining query results and messages.
		return [...content, ...this.formattedQueryResults, ...extractedMessages];
	}
}

class Table<T> extends Disposable {
	private gridDataProvider: IGridDataProvider;
	private columns: Slick.Column<T>[];

	constructor(
		private runner: QueryRunner,
		public resultSet: ResultSetSummary,
		private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		private fileQueryResultsWriter: FileQueryResultsWriter,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();

		this.columns = this.resultSet.columnInfo.map((col, index) => {
			let isLinked = col.isXml || col.isJson;

			return <Slick.Column<T>>{
				id: index.toString(),
				name: col.columnName === 'Microsoft SQL Server 2005 XML Showplan'
					? nls.localize('xmlShowplanColumnName', "XML Showplan")
					: escape(col.columnName),
				field: index.toString(),
				formatter: isLinked ? hyperLinkFormatter : textFormatter,
				width: col.columnSize
			};
		});

		this.gridDataProvider = this.instantiationService.createInstance(QueryGridDataProvider, this.runner, resultSet.batchId, resultSet.id);
	}

	public async updateResult(resultSet: ResultSetSummary) {
		this.resultSet = resultSet;

		if (this.resultSet.complete) {
			let offset = 0;
			await this.getData(offset, resultSet.rowCount);
		}
	}

	private async getData(offset: number, count: number): Promise<void> {
		let response = await this.gridDataProvider.getRowData(offset, count);
		if (!response) {
			return;
		}

		let unformattedData = response.rows.map(row => {
			let dataWithSchema = {};

			let numColumns = this.resultSet.columnInfo.length;
			for (let curCol = 0; curCol < numColumns; curCol++) {
				dataWithSchema[this.columns[curCol].field] = {
					displayValue: row[curCol].displayValue,
					ariaLabel: escape(row[curCol].displayValue),
					isNull: row[curCol].isNull,
					invariantCultureDisplayValue: row[curCol].invariantCultureDisplayValue
				};
			}
			return dataWithSchema as T;
		});

		let formattedResults = this.formatQueryResults(unformattedData);
		await this.fileQueryResultsWriter.aggregateQueryResults(formattedResults);
	}

	private formatQueryResults(unformattedData: any[]): string {
		let columnWidths = this.calculateColumnWidths();
		let formattedTable = this.formatTableHeader(columnWidths);
		formattedTable = formattedTable.concat(this.formatData(unformattedData, columnWidths));

		return formattedTable.join(this.textResourcePropertiesService.getEOL(undefined));
	}

	private calculateColumnWidths(): number[] {
		let columnWidths: number[] = [];

		for (const column of this.columns) {
			let colWidth = column.width;
			if (column.name && column.name.length > colWidth) {
				colWidth = column.name.length;
			}

			columnWidths.push(colWidth);
		}

		return columnWidths;
	}

	private formatTableHeader(columnWidths: number[]): string[] {
		let tableHeader: string[] = [];

		let columnNames = '';
		for (let curCol = 0; curCol < this.columns.length; curCol++) {
			columnNames += (this.columns[curCol].name !== undefined) ? this.columns[curCol].name : '';

			// Padding every column name before the last one to fill it's width and including extra space to separate each column.
			if (curCol < this.columns.length - 1) {
				columnNames += ' '.repeat((columnWidths[curCol] - this.columns[curCol].name.length) + 1);
			}
		}
		tableHeader.push(columnNames);

		let headingDivider = columnWidths.map((colWidth, index) => {
			let columnUnderline = '-'.repeat(colWidth);

			if (index < this.columns.length - 1) {
				columnUnderline += ' ';
			}

			return columnUnderline;
		}).join('');
		tableHeader.push(headingDivider);

		return tableHeader;
	}

	private formatData(unformattedRows: IRow[], columnSizes: number[]): string[] {
		let formattedRows: string[] = [];

		unformattedRows.forEach(r => {
			let row = '';
			for (let curCol = 0; curCol < this.columns.length; curCol++) {
				row += r[curCol].displayValue;

				if (curCol < this.columns.length - 1) {
					row += ' '.repeat((columnSizes[curCol] - r[curCol].displayValue.length) + 1);
				}
			}

			formattedRows.push(row);
		});

		return formattedRows;
	}
}

interface IRow {
	displayValue: string;
	ariaLabel: string;
	isNull: boolean;
	invariantCultureDisplayValue: string;
}
