/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hyperLinkFormatter, textFormatter } from 'sql/base/browser/ui/table/formatters';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { GetLocalizedXMLShowPlanColumnName } from 'sql/workbench/contrib/query/browser/gridPanel';
import { IResultMessageIntern, Model } from 'sql/workbench/contrib/query/browser/messagePanel';
import { IGridDataProvider } from 'sql/workbench/services/query/common/gridDataProvider';
import { IQueryMessage, ResultSetSummary, MessageType, IQueryResultsWriter } from 'sql/workbench/services/query/common/query';
import QueryRunner, { QueryGridDataProvider } from 'sql/workbench/services/query/common/queryRunner';
import { IDataTreeViewState } from 'vs/base/browser/ui/tree/dataTree';
import { asArray } from 'vs/base/common/arrays';
import { CancellationToken } from 'vs/base/common/cancellation';
import { FuzzyScore } from 'vs/base/common/filters';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { isArray } from 'vs/base/common/types';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { formatDocumentWithSelectedProvider, FormattingMode } from 'vs/editor/contrib/format/format';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { WorkbenchDataTree } from 'vs/platform/list/browser/listService';
import { ILogService } from 'vs/platform/log/common/log';
import { Progress } from 'vs/platform/progress/common/progress';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';

export class FileQueryResultsWriter extends Disposable implements IQueryResultsWriter {
	protected queryRunnerDisposables = this._register(new DisposableStore());
	private runner: QueryRunner;
	private messages: Array<IQueryMessage> = [];
	private formattedQueryResults: Array<string> = [];
	private tables: Array<Table> = [];
	private numQueriesToFormat: number = 0;
	private queryContainsError: boolean = false;
	private closingMessageIncluded: boolean = false;
	private hasCreatedResultsFile: boolean = false;

	private readonly newLineEscapeSequence: string = this.textResourcePropertiesService.getEOL(undefined);

	constructor(
		@IInstantiationService private instantiationService: IInstantiationService,
		@IUntitledTextEditorService private readonly untitledEditorService: IUntitledTextEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super();
	}

	public subscribeToQueryRunner(): void {
		this.queryRunnerDisposables.add(this.runner.onQueryStart(() => {
			this.clear();
		}));

		this.queryRunnerDisposables.add(this.runner.onMessage(async (message) => {
			await this.onMessage(message);
		}));

		this.queryRunnerDisposables.add(this.runner.onResultSet((resultSet) => {
			this.onResultSet(resultSet);
		}));

		this.queryRunnerDisposables.add(this.runner.onResultSetUpdate(async (resultSet) => {
			await this.updateResultSet(resultSet);
		}));
	}

	public override dispose() {
		this.clear();
		this.queryRunnerDisposables.dispose();

		super.dispose();
	}

	public set queryRunner(runner: QueryRunner) {
		this.runner = runner;
	}

	public clear() {
		this.messages = [];
		this.formattedQueryResults = [];
		this.tables = [];
		this.numQueriesToFormat = 0;
		this.queryContainsError = false;
		this.closingMessageIncluded = false;
		this.hasCreatedResultsFile = false;
	}

	private onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
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

	private async updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
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

	private async onMessage(incomingMessage: IQueryMessage | IQueryMessage[]) {
		if (isArray(incomingMessage)) {
			incomingMessage.forEach(m => {
				if (m.isError) {
					this.queryContainsError = true;
				}

				if (m?.messageType === MessageType.queryEnd) {
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
		this.messages = this.messages.filter(m => m?.messageType !== MessageType.queryStart);
		this.messages.forEach(m => {
			if (m?.hasRowCount) {
				m.message = this.newLineEscapeSequence + m.message + this.newLineEscapeSequence;
			}
			else if (m?.messageType === MessageType.queryEnd) {
				m.message = this.newLineEscapeSequence + m.message;
			}
		});

		let fileData = this.mergeQueryResultsWithMessages().join(this.newLineEscapeSequence);

		const input = this.untitledEditorService.create({ initialValue: fileData });
		await input.resolve();
		input.setDirty(false);
		await this.instantiationService.invokeFunction(formatDocumentWithSelectedProvider, input.textEditorModel, FormattingMode.Explicit, Progress.None, CancellationToken.None);
		this.hasCreatedResultsFile = true;

		return this.editorService.openEditor(input);
	}

	private mergeQueryResultsWithMessages(): string[] {
		let content: Array<string> = [];

		// Merges query result set before respective '# row(s) affected' message
		while (this.messages.length > 0 && this.formattedQueryResults.length > 0) {
			if (this.messages[0]?.hasRowCount) {
				content.push(this.newLineEscapeSequence + this.formattedQueryResults.shift());
			}

			let queryMessage = this.messages.shift();
			content.push(queryMessage.message);
		}

		let remainingMessages = this.messages.map(m => m.message);
		// append any remaining query results and messages.
		return [...content, ...this.formattedQueryResults, ...remainingMessages];
	}
}

class Table extends Disposable {
	private gridDataProvider: IGridDataProvider;
	private columns: IColumn[];
	private readonly maxColWidthForJsonOrXml = 257;

	constructor(
		private runner: QueryRunner,
		public resultSet: ResultSetSummary,
		private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		private fileQueryResultsWriter: FileQueryResultsWriter,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		this.columns = this.resultSet.columnInfo.map((col, index) => {
			let isLinked = col.isXml || col.isJson;

			return <IColumn>{
				id: index.toString(),
				name: GetLocalizedXMLShowPlanColumnName(col),
				field: index.toString(),
				formatter: isLinked ? hyperLinkFormatter : textFormatter,
				width: col.columnSize,
				dataTypeName: col.dataTypeName
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
			return dataWithSchema;
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
			let colWidth = this.calculateColumnWidth(column);

			if (column?.formatter?.name === 'hyperLinkFormatter') {
				colWidth = this.maxColWidthForJsonOrXml;
			}

			columnWidths.push(colWidth);
		}

		return columnWidths;
	}

	private calculateColumnWidth(column: IColumn): number {
		let columnWidth = 0;
		let nameLength = column?.name ? column.name.length : 0;

		switch (column.dataTypeName.toUpperCase()) {
			case 'BIT':
				columnWidth = Math.max(1, nameLength);
				break;
			case 'TINYINT':
				columnWidth = Math.max(3, nameLength);
				break;
			case 'SMALLINT':
				columnWidth = Math.max(6, nameLength);
				break;
			case 'INT':
				columnWidth = Math.max(11, nameLength);
				break;
			case 'BIGINT':
				columnWidth = Math.max(21, nameLength);
				break;
			case 'REAL':
				columnWidth = Math.max(14, nameLength);
				break;
			case 'FLOAT':
				columnWidth = Math.max(24, nameLength);
				break;
			case 'DECIMAL':
				columnWidth = Math.max(26, nameLength, column.width);
			case 'DATE':
				columnWidth = Math.max(16, nameLength);
				break;
			case 'DATETIME':
				columnWidth = Math.max(23, nameLength);
				break;
			case 'SMALLDATETIME':
				columnWidth = Math.max(19, nameLength);
				break;
			case 'DATETIME2':
				columnWidth = Math.max(38, nameLength);
				break;
			case 'DATETIMEOFFSET':
				columnWidth = Math.max(45, nameLength);
				break;
			case 'UNIQUEIDENTIFIER':
				columnWidth = Math.max(36, nameLength);
				break;
			case 'VARCHAR':
			case 'NVARCHAR':
				columnWidth = Math.max(column.width, nameLength);
				break;
			case 'VARBINARY':
				columnWidth = Math.max(column.width, nameLength);
				break;
			case 'CHAR':
			case 'NCHAR':
			case 'VARIANT':
				columnWidth = Math.max(column.width, nameLength);
				break;
			case 'XML':
			case 'TEXT':
			case 'NTEXT':
			case 'IMAGE':
			case 'BINARY':
				columnWidth = Math.max(column.width, nameLength);
				break;
			default:
				columnWidth = Math.max(column.width, nameLength);
		}

		if (column.dataTypeName.toUpperCase().includes('GEOGRAPHY')) {
			columnWidth = Math.max(257, nameLength);
		}

		return columnWidth;
	}

	private formatTableHeader(columnWidths: number[]): string[] {
		let tableHeader: string[] = [];

		let columnNames = '';
		for (let curCol = 0; curCol < this.columns.length; curCol++) {
			columnNames += (this.columns[curCol].name !== undefined) ? this.columns[curCol].name : '';

			// Padding every column name before the last one to fill it's width and including extra space to separate each column.
			if (curCol < this.columns.length - 1) {
				try {
					columnNames += ' '.repeat((columnWidths[curCol] - this.columns[curCol].name.length) + 1);
				}
				catch (err) {
					this.logService.error(`Invalid string length error encountered while formatting type: ${this.columns[curCol].dataTypeName} with width of: ${columnWidths[curCol]}`, err);
					throw err;
				}
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
				if (this.columns[curCol]?.formatter?.name === 'hyperLinkFormatter') {
					row += r[curCol].displayValue.substring(0, this.maxColWidthForJsonOrXml);
				}
				else {
					row += r[curCol].displayValue;
				}

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

interface IColumn {
	id: string,
	name: string,
	field: string,
	formatter: (row: number | undefined, cell: any | undefined, value: any, columnDef: any | undefined, dataContext: any | undefined) => string,
	width: number,
	dataTypeName: string
}
