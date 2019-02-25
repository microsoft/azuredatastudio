/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

const localize = nls.loadMessageBundle();

export class SchemaCompareResult {
	private differencesTable: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;
	private editor: sqlops.workspace.ModelViewEditor;
	private diffEditor: sqlops.DiffEditorComponent;
	private flexModel: sqlops.FlexContainer;
	private sourceLabel: sqlops.TextComponent;
	private targetLabel: sqlops.TextComponent;
	private noDifferencesLabel: sqlops.TextComponent;
	public dialogName: string;
	private SchemaCompareActionMap: Map<Number, string>;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: sqlops.SchemaCompareEndpointInfo, private targetEndpointInfo: sqlops.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[0] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[1] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[2] = localize('schemaCompare.addAction', 'Add');

		this.editor = sqlops.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });

		this.editor.registerContent(async view => {
			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: '\n',
				contentRight: '\n',
			}).component();

			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 400
			}).component();

			this.loader = view.modelBuilder.loadingComponent().component();
			this.sourceLabel = view.modelBuilder.text().component();
			this.targetLabel = view.modelBuilder.text().component();
			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(this.loader);
			this.flexModel.setLayout({
				flexFlow: 'column',
				alignItems: 'stretch',
				height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public async start() {
		let service = await SchemaCompareResult.getService('MSSQL');
		this.editor.openEditor();

		let result = await service.schemaCompare(this.sourceEndpointInfo, this.targetEndpointInfo, sqlops.TaskExecutionMode.execute);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('schemaCompare.compareErrorMessage', "Schema Compare failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}

		let data = this.getAllDifferences(result.differences);

		this.differencesTable.updateProperties({
			data: data,
			columns: [
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header'
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header'
				}]
		});

		this.sourceLabel.updateProperties({
			value: localize('schemaCompare.source', 'Source: {0}', this.sourceName)
		});
		this.targetLabel.updateProperties({
			value: localize('schemaCompare.target', 'Target: {0}', this.targetName)
		});

		this.loader.loading = false;
		this.flexModel.removeItem(this.loader);
		if (result.differences.length > 0) {
			this.flexModel.addItem(this.sourceLabel, { flex: '1' });
			this.flexModel.addItem(this.targetLabel, { flex: '1' });
			this.flexModel.addItem(this.differencesTable, { flex: '1 1' });
			this.flexModel.addItem(this.diffEditor, { flex: '1 1' });
		} else {
			this.flexModel.addItem(this.noDifferencesLabel);
		}

		this.differencesTable.onRowSelected(e => {
			let difference = result.differences[this.differencesTable.selectedRows[0]];
			sourceText = difference.sourceScript === null ? '' : difference.sourceScript;
			targetText = difference.targetScript === null ? '' : difference.targetScript;
			this.diffEditor.contentLeft = sourceText;
			this.diffEditor.contentRight = targetText;
		});

		let sourceText = '';
		let targetText = '';

		vscode.workspace.registerTextDocumentContentProvider('source', {
			provideTextDocumentContent() {
				return sourceText;
			}
		});

		vscode.workspace.registerTextDocumentContentProvider('target', {
			provideTextDocumentContent() {
				return targetText;
			}
		});
	}

	private getAllDifferences(differences: sqlops.DiffEntry[]): string[][] {
		let data = [];
		differences.forEach(difference => {
			if (difference.differenceType === sqlops.SchemaDifferenceType.Object) {
				if (difference.sourceValue !== null || difference.targetValue !== null) {
					data.push([this.SchemaCompareActionMap[difference.updateAction], difference.name, difference.sourceValue, difference.targetValue]);
				}
			}
		});

		return data;
	}

	private static async getService(providerName: string): Promise<sqlops.DacFxServicesProvider> {
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}
}