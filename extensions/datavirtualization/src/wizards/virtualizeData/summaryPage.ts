/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IWizardPageWrapper } from '../wizardPageWrapper';
import { VirtualizeDataModel } from './virtualizeDataModel';
import { VirtualizeDataInput } from '../../services/contracts';
import { VDIManager } from './virtualizeDataInputManager';
import { AppContext } from '../../appContext';

export class SummaryUiElements {
	public destDBLabel: azdata.TextComponent;
	public summaryTable: azdata.DeclarativeTableComponent;
}

export class SummaryPage implements IWizardPageWrapper {
	private _page: azdata.window.WizardPage;

	private _uiElements: SummaryUiElements;

	private readonly _taskLabel = localize('virtualizeTaskLabel', 'Virtualize Data');

	constructor(private _dataModel: VirtualizeDataModel, private _vdiManager: VDIManager, private _appContext: AppContext) {
		this._page = this._appContext.apiWrapper.createWizardPage(localize('summaryPageTitle', 'Summary'));
		this._page.registerContent(async (modelView) => {
			let ui = new SummaryUiElements();
			let builder = modelView.modelBuilder;
			let components: azdata.FormComponent[] = [];

			ui.destDBLabel = builder.text().withProperties({
				value: ''
			}).component();
			components.push({
				component: ui.destDBLabel,
				title: localize('summaryDestDb', 'Destination Database:')
			});

			let tableData = [['', '']];
			ui.summaryTable = builder.declarativeTable()
				.withProperties({
					columns: [{
						displayName: localize('summaryObjTypeLabel', 'Object type'),
						valueType: azdata.DeclarativeDataType.string,
						width: '300px',
						isReadOnly: true
					}, {
						displayName: localize('summaryObjNameLabel', 'Name'),
						valueType: azdata.DeclarativeDataType.string,
						width: '300px',
						isReadOnly: true
					}
					],
					data: tableData
				}).component();
			components.push({
				component: ui.summaryTable,
				title: localize('summaryTitle', 'The following objects will be created in the destination database:')
			});

			let form = builder.formContainer()
				.withFormItems(components, {
					horizontal: false
				})
				.withLayout({
					width: '800px'
				}).component();

			this.setUi(ui);
			await modelView.initializeModel(form);
		});
	}

	public setUi(ui: SummaryUiElements): void {
		this._uiElements = ui;
	}

	public async validate(): Promise<boolean> {
		this._dataModel.wizard.registerOperation({
			connection: undefined,
			displayName: this._taskLabel,
			description: this._taskLabel,
			isCancelable: false,
			operation: op => {
				op.updateStatus(azdata.TaskStatus.InProgress, localize('virtualizeTaskStart', 'Executing script...'));

				let inputValues = this._vdiManager.getVirtualizeDataInput();
				this._dataModel.processInput(inputValues).then(response => {
					if (!response.isSuccess) {
						op.updateStatus(azdata.TaskStatus.Failed, localize('createSourceError', 'External Table creation failed'));
						if (response.errorMessages) {
							this._appContext.apiWrapper.showErrorMessage(response.errorMessages.join('\n'));
						}
					} else {
						op.updateStatus(azdata.TaskStatus.Succeeded, localize('createSourceInfo', 'External Table creation completed successfully'));
						let serverName = this._dataModel.connection.serverName;
						let databaseName = inputValues.destDatabaseName;
						let nodePath = `${serverName}/Databases/${databaseName}/Tables`;
						let username = this._dataModel.connection.userName;
						SummaryPage.refreshExplorerNode(nodePath, '/', username);
					}
				});
			}
		});

		// Always return true, so that wizard closes.
		return true;
	}

	private static async refreshExplorerNode(nodePath: string, delimiter: string, username?: string): Promise<boolean> {
		if (!nodePath || !delimiter) { return false; }
		let refreshNodePath = nodePath.split(delimiter);
		if (!refreshNodePath || refreshNodePath.length === 0) { return false; }

		let isSuccess: boolean = false;
		try {
			let targetNodes: azdata.objectexplorer.ObjectExplorerNode[] = undefined;
			let nodes = await azdata.objectexplorer.getActiveConnectionNodes();
			if (nodes && username) {
				nodes = nodes.filter(n => n.label.endsWith(` - ${username})`));
			}
			let currentNodePath: string = undefined;
			for (let i = 0; i < refreshNodePath.length; ++i) {
				if (nodes && nodes.length > 0) {
					currentNodePath = currentNodePath ? `${currentNodePath}/${refreshNodePath[i]}` : refreshNodePath[i];
					let currentNodes = nodes.filter(node => node.nodePath === currentNodePath);
					if (currentNodes && currentNodes.length > 0) {
						targetNodes = currentNodes;
						let newNodes = [];
						for (let n of targetNodes) { newNodes = newNodes.concat(await n.getChildren()); }
						nodes = newNodes;
					} else {
						nodes = undefined;
					}
				} else {
					break;
				}
			}

			if (targetNodes && targetNodes.length > 0) {
				for (let n of targetNodes) { await n.refresh(); }
				isSuccess = true;
			}
		} catch { }
		return isSuccess;
	}

	public getPage(): azdata.window.WizardPage {
		return this._page;
	}

	public async updatePage(): Promise<void> {
		let summary = this._vdiManager.getVirtualizeDataInput();
		if (summary) {
			await this._uiElements.destDBLabel.updateProperties({
				value: summary.destDatabaseName
			});

			let tableData = this.getTableData(summary);
			await this._uiElements.summaryTable.updateProperties({
				data: tableData
			});
		}
	}

	private getTableData(summary: VirtualizeDataInput): string[][] {
		let data = [];
		if (summary.destDbMasterKeyPwd) {
			let mdash = '\u2014';
			data.push([localize('summaryMasterKeyLabel', 'Database Master Key'), mdash]);
		}
		if (summary.newCredentialName) {
			data.push([localize('summaryCredLabel', 'Database Scoped Credential'), summary.newCredentialName]);
		}
		if (summary.newDataSourceName) {
			data.push([localize('summaryDataSrcLabel', 'External Data Source'), summary.newDataSourceName]);
		}
		if (summary.newSchemas) {
			for (let schemaName of summary.newSchemas) {
				data.push([localize('summaryNewSchemaLabel', 'Schema'), schemaName]);
			}
		}
		if (summary.externalTableInfoList) {
			let labelText: string = localize('summaryExternalTableLabel', 'External Table');
			for (let tableInfo of summary.externalTableInfoList) {
				data.push([labelText, tableInfo.externalTableName.join('.')]);
			}
		}

		return data;
	}

	public getInputValues(existingInput: VirtualizeDataInput): void {
		return;
	}
}
