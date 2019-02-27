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
	private noDifferencesLabel: sqlops.TextComponent;
	private sourceDropdown: sqlops.DropDownComponent;
	private targetDropdown: sqlops.DropDownComponent;
	private sourceTargetFlexLayout: sqlops.FlexContainer;
	private switchButton: sqlops.ButtonComponent;
	private SchemaCompareActionMap: Map<Number, string>;

	constructor(private sourceName: string, private targetName: string, private sourceEndpointInfo: sqlops.SchemaCompareEndpointInfo, private targetEndpointInfo: sqlops.SchemaCompareEndpointInfo) {
		this.SchemaCompareActionMap = new Map<Number, string>();
		this.SchemaCompareActionMap[sqlops.SchemaUpdateAction.Delete] = localize('schemaCompare.deleteAction', 'Delete');
		this.SchemaCompareActionMap[sqlops.SchemaUpdateAction.Change] = localize('schemaCompare.changeAction', 'Change');
		this.SchemaCompareActionMap[sqlops.SchemaUpdateAction.Add] = localize('schemaCompare.addAction', 'Add');

		this.editor = sqlops.workspace.createModelViewEditor(localize('schemaCompare.Title', 'Schema Compare'), { retainContextWhenHidden: true, supportsSave: true });

		this.editor.registerContent(async view => {
			this.diffEditor = view.modelBuilder.diffeditor().withProperties({
				contentLeft: '\n',
				contentRight: '\n',
			}).component();

			this.differencesTable = view.modelBuilder.table().withProperties({
				data: [],
				height: 700
			}).component();

			this.sourceDropdown = view.modelBuilder.dropDown().withProperties({
				values: [sourceName],
				enabled: false
			}).component();

			this.targetDropdown = view.modelBuilder.dropDown().withProperties({
				values: [targetName],
				enabled: false
			}).component();

			this.sourceTargetFlexLayout = view.modelBuilder.flexContainer()
				.withProperties({
					flexFlow: 'column',
					alignItems: 'stretch',
					horizontal: true
				}).component();

			this.switchButton = this.createSwitchButton(view);

			this.sourceTargetFlexLayout.addItem(this.sourceDropdown, { CSSStyles: { 'width': '45%', 'margin': '1em' } });
			this.sourceTargetFlexLayout.addItem(this.switchButton, { CSSStyles: { 'width': '3em', 'margin': '1em' } });
			this.sourceTargetFlexLayout.addItem(this.targetDropdown, { CSSStyles: { 'width': '45%', 'margin': '1em' } });

			this.loader = view.modelBuilder.loadingComponent().component();
			this.noDifferencesLabel = view.modelBuilder.text().withProperties({
				value: localize('schemaCompare.noDifferences', 'No schema differences were found')
			}).component();

			this.flexModel = view.modelBuilder.flexContainer().component();
			this.flexModel.addItem(this.sourceTargetFlexLayout);
			this.flexModel.addItem(this.loader);
			this.flexModel.setLayout({
				flexFlow: 'column',
				// alignItems: 'stretch',
				// height: '100%'
			});

			await view.initializeModel(this.flexModel);
		});
	}

	public async start() {
		this.editor.openEditor();
		this.execute();
	}

	private async execute() {
		let service = await SchemaCompareResult.getService('MSSQL');
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
					value: localize('schemaCompare.typeColumn', 'Type'),
					cssClass: 'align-with-header',
					width: 50
				},
				{
					value: localize('schemaCompare.sourceNameColumn', 'Source Name'),
					cssClass: 'align-with-header'
				},
				{
					value: localize('schemaCompare.actionColumn', 'Action'),
					cssClass: 'align-with-header',
					width: 30
				},
				{
					value: localize('schemaCompare.targetNameColumn', 'Target Name'),
					cssClass: 'align-with-header'
				}]
		});

		this.flexModel.removeItem(this.loader);
		this.switchButton.enabled = true;
		if (result.differences.length > 0) {
			this.flexModel.addItem(this.differencesTable, { flex: '1 1' });
			// this.flexModel.addItem(this.diffEditor, { flex: '1 1' });
		} else {
			this.flexModel.addItem(this.noDifferencesLabel, { CSSStyles: { 'margin': 'auto' } });
		}

		this.differencesTable.onRowSelected(e => {
			let difference = result.differences[this.differencesTable.selectedRows[0]];
			if (difference !== undefined) {
				sourceText = difference.sourceScript === null ? '\n' : difference.sourceScript;
				targetText = difference.targetScript === null ? '\n' : difference.targetScript;

				this.diffEditor.contentLeft = sourceText;
				this.diffEditor.contentRight = targetText;

				let objectName = difference.sourceValue === null ? difference.targetValue : difference.sourceValue;
				const title = localize('schemaCompare.objectDefinitionsTitle', '{0} (Source ⟷ Target)', objectName);
				vscode.commands.executeCommand('vscode.diff', vscode.Uri.parse('source:'), vscode.Uri.parse('target:'), title);
			}
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
					data.push([difference.name, difference.sourceValue, this.SchemaCompareActionMap[difference.updateAction], difference.targetValue]);
				}
			}
		});

		return data;
	}

	private createSwitchButton(view: sqlops.ModelView, ): sqlops.ButtonComponent {
		this.switchButton = view.modelBuilder.button().withProperties({
			label: '⇄',
			enabled: false
		}).component();

		this.switchButton.onDidClick(async (click) => {
			// switch source and target
			[this.sourceDropdown.values, this.targetDropdown.values] = [this.targetDropdown.values, this.sourceDropdown.values];
			[this.sourceEndpointInfo, this.targetEndpointInfo] = [this.targetEndpointInfo, this.sourceEndpointInfo];
			this.flexModel.removeItem(this.differencesTable);
			this.flexModel.removeItem(this.noDifferencesLabel);
			this.flexModel.addItem(this.loader);
			this.switchButton.enabled = false;
			this.execute();
		});

		return this.switchButton;
	}

	private static async getService(providerName: string): Promise<sqlops.DacFxServicesProvider> {
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}
}