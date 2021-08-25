/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { SqlAssessmentTab } from './sqlAssessmentTab';
import { AssessmentEngine, AssessmentType } from '../engine';
import { AssessmentResultGrid } from '../assessmentResultGrid';
import { LocalizedStrings } from '../localized';
import { TelemetryReporter, SqlAssessmentTelemetryView, SqlTelemetryActions } from '../telemetry';

const localize = nls.loadMessageBundle();

export class SqlAssessmentHistoryTab extends SqlAssessmentTab {
	private engine: AssessmentEngine;
	private toDispose: vscode.Disposable[] = [];
	private summaryTable!: azdata.TableComponent;
	private resultGrid!: AssessmentResultGrid;

	public constructor(extensionContext: vscode.ExtensionContext, engine: AssessmentEngine) {
		super(extensionContext, LocalizedStrings.HISTORY_TAB_NAME, 'HistoryTab', {
			dark: extensionContext.asAbsolutePath('resources/dark/history.svg'),
			light: extensionContext.asAbsolutePath('resources/light/history.svg')
		});

		this.engine = engine;
	}

	public override dispose() {
		this.toDispose.forEach(disposable => disposable.dispose());
	}

	async tabContent(view: azdata.ModelView): Promise<azdata.Component> {
		TelemetryReporter.sendActionEvent(SqlAssessmentTelemetryView, SqlTelemetryActions.OpenHistory);
		this.summaryTable = await this.createHistorySummaryTable(view);

		const root = view.modelBuilder.flexContainer()
			.withItems([this.summaryTable])
			.withLayout({
				flexFlow: 'column',
				width: '100%',
				height: '100%'
			}).component();

		const title = view.modelBuilder.text().withProps({
			value: '',
			CSSStyles: { 'font-weight': 'bold', 'margin-block-start': '0px', 'margin-block-end': '0px', 'font-size': '20px', 'padding-left': '20px', 'padding-bottom': '20px' }
		}).component();

		const backLink = view.modelBuilder.hyperlink().withProps({
			label: localize('asmt.history.back', "<< Back"),
			url: '',
			CSSStyles: { 'text-decoration': 'none', 'width': '150px' }
		}).component();
		backLink.onDidClick(async () => {
			this.resultGrid.dispose();

			root.clearItems();
			root.addItem(this.summaryTable, { flex: '1 1 auto' });
		});

		const infoPanel = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row'
			}).withProps({
				CSSStyles: {
					'padding-left': '15px'
				}
			}).component();
		infoPanel.addItem(backLink, { flex: '0 0 auto' });
		infoPanel.addItem(title);

		this.toDispose.push(this.summaryTable.onRowSelected(async () => {
			if (this.summaryTable.selectedRows?.length === 1) {
				let rowNumber: number = this.summaryTable.selectedRows[0];
				const historyResult = (await this.engine.readHistory())[rowNumber];

				root.clearItems();

				this.resultGrid = new AssessmentResultGrid(view, this.extensionContext);
				this.toDispose.push(this.resultGrid);
				await view.initializeModel(title);


				this.resultGrid.displayResult(historyResult.result, AssessmentType.InvokeAssessment);
				title.value = localize('asmt.history.resultsTitle', "Assessment Results from {0}", new Date(historyResult.dateUpdated).toLocaleString());
				root.addItem(infoPanel, { flex: `0 0 50px` });
				root.addItem(this.resultGrid.component, {
					flex: '1 1 auto', CSSStyles: {
						'padding-bottom': '10px'
					}
				});
				this.summaryTable.selectedRows = [];
			}

		}));

		return root;
	}

	public async refresh() {
		const historicalRecords = await this.engine.readHistory();
		this.summaryTable.data = historicalRecords.map(item => [
			new Date(item.dateUpdated).toLocaleString(),
			item.result.items.filter(i => i.level === 'Error')?.length,
			item.result.items.filter(i => i.level === 'Warning')?.length,
			item.result.items.filter(i => i.level === 'Information')?.length
		]);
	}

	private async createHistorySummaryTable(view: azdata.ModelView): Promise<azdata.TableComponent> {
		const cssHeader = 'no-borders align-with-header';
		return view.modelBuilder.table()
			.withProps({
				data: [],
				columns: [
					{ value: localize('asmt.history.summaryAsmtDate', "Assessment Date"), headerCssClass: cssHeader, width: 125 },
					{ value: localize('asmt.history.summaryError', "Error"), headerCssClass: cssHeader, width: 100 },
					{ value: localize('asmt.history.summaryWarning', "Warning"), headerCssClass: cssHeader, width: 100 },
					{ value: localize('asmt.history.summaryInfo', "Information"), headerCssClass: cssHeader, width: 100 }
				],
				height: '100%',
				width: '100%'
			}).component();
	}
}
