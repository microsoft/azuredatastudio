/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as path from 'path';
import * as url from 'url';
import * as utils from '../../utils';

import { ImportDataModel } from './api/models';
import { ImportPage } from './api/importPage';
import { FileConfigPage } from './pages/fileConfigPage';
import { ProsePreviewPage } from './pages/prosePreviewPage';
import { ModifyColumnsPage } from './pages/modifyColumnsPage';
import { SummaryPage } from './pages/summaryPage';
import { DataSourceWizardService, VirtualizeDataInput } from '../../services/contracts';
import { HdfsFileSourceNode, FileNode } from '../../hdfsProvider';
import { AppContext } from '../../appContext';
import { TreeNode } from '../../treeNodes';
import { HdfsItems, MssqlClusterItems, DataSourceType, delimitedTextFileType } from '../../constants';

const localize = nls.loadMessageBundle();

export class TableFromFileWizard {
	private readonly connection: azdata.connection.ConnectionProfile;
	private readonly appContext: AppContext;
	private readonly provider: DataSourceWizardService;
	private wizard: azdata.window.Wizard;
	private model: ImportDataModel;

	constructor(connection: azdata.connection.ConnectionProfile, appContext: AppContext, provider: DataSourceWizardService) {
		this.connection = connection;
		this.appContext = appContext;
		this.provider = provider;
	}

	public async start(hdfsFileNode: HdfsFileSourceNode, ...args: any[]) {
		if (!hdfsFileNode) {
			vscode.window.showErrorMessage(localize('import.needFile', 'Please select a source file or folder before using this wizard.'));
			return;
		}

		let noCsvError = localize('tableFromFileImport.onlyCsvSupported', 'Currently only csv files are supported for this wizard.');
		let proseParsingFile: FileNode;
		let parentIsFolder = false;

		let isFolder = (node: TreeNode): boolean => {
			let nodeType = node.getNodeInfo().nodeType;
			return nodeType === HdfsItems.Folder || nodeType === MssqlClusterItems.Folder;
		};
		if (isFolder(hdfsFileNode)) {
			let visibleFilesFilter = node => {
				// Polybase excludes files that start with '.' or '_', so skip these
				// files when trying to find a file to run prose discovery on
				if (node.hdfsPath) {
					let baseName = path.basename(node.hdfsPath);
					return baseName.length > 0 && baseName[0] !== '.' && baseName[0] !== '_';
				}
				return false;
			};
			let nodeSearch = async (condition) => TreeNode.findNode(hdfsFileNode, condition, visibleFilesFilter, true);

			let nonCsvFile = await nodeSearch(node => {
				return !isFolder(node) && path.extname(node.hdfsPath).toLowerCase() !== '.csv';
			});

			if (nonCsvFile) {
				vscode.window.showErrorMessage(noCsvError);
				return;
			}

			let csvFile = await nodeSearch(node => {
				return !isFolder(node) && path.extname(node.hdfsPath).toLowerCase() === '.csv';
			}) as FileNode;

			if (!csvFile) {
				vscode.window.showErrorMessage(localize('tableFromFileImport.noCsvFileFound', 'No csv files were found in the specified folder.'));
				return;
			}

			parentIsFolder = true;
			proseParsingFile = csvFile;
		} else {
			if (path.extname(hdfsFileNode.hdfsPath).toLowerCase() !== '.csv') {
				vscode.window.showErrorMessage(noCsvError);
				return;
			}

			proseParsingFile = hdfsFileNode as FileNode;
		}

		this.model = <ImportDataModel>{
			parentFile: {
				isFolder: parentIsFolder,
				filePath: hdfsFileNode.hdfsPath
			},
			proseParsingFile: proseParsingFile,
			serverConn: this.connection
		};

		let pages: Map<number, ImportPage> = new Map<number, ImportPage>();

		this.wizard = azdata.window.createWizard(localize('tableFromFileImport.wizardName', 'Virtualize Data From CSV'));
		let page0 = azdata.window.createWizardPage(localize('tableFromFileImport.page0Name', 'Select the destination database for your external table'));
		let page1 = azdata.window.createWizardPage(localize('tableFromFileImport.page1Name', 'Preview Data'));
		let page2 = azdata.window.createWizardPage(localize('tableFromFileImport.page2Name', 'Modify Columns'));
		let page3 = azdata.window.createWizardPage(localize('tableFromFileImport.page3Name', 'Summary'));

		let fileConfigPage: FileConfigPage;
		page0.registerContent(async (view) => {
			fileConfigPage = new FileConfigPage(this, page0, this.model, view, this.provider);
			pages.set(0, fileConfigPage);
			await fileConfigPage.start().then(() => {
				fileConfigPage.onPageEnter();
			});
		});

		let prosePreviewPage: ProsePreviewPage;
		page1.registerContent(async (view) => {
			prosePreviewPage = new ProsePreviewPage(this, page1, this.model, view, this.provider);
			pages.set(1, prosePreviewPage);
			await prosePreviewPage.start();
		});

		let modifyColumnsPage: ModifyColumnsPage;
		page2.registerContent(async (view) => {
			modifyColumnsPage = new ModifyColumnsPage(this, page2, this.model, view, this.provider);
			pages.set(2, modifyColumnsPage);
			await modifyColumnsPage.start();
		});

		let summaryPage: SummaryPage;
		page3.registerContent(async (view) => {
			summaryPage = new SummaryPage(this, page3, this.model, view, this.provider);
			pages.set(3, summaryPage);
			await summaryPage.start();
		});

		this.wizard.onPageChanged(async info => {
			let newPage = pages.get(info.newPage);
			if (newPage) {
				await newPage.onPageEnter();
			}
		});

		this.wizard.registerNavigationValidator(async (info) => {
			let lastPage = pages.get(info.lastPage);
			let newPage = pages.get(info.newPage);

			// Hit "next" on last page, so handle submit
			let nextOnLastPage = !newPage && lastPage instanceof SummaryPage;
			if (nextOnLastPage) {
				let createSuccess = await this.handleVirtualizeData();
				if (createSuccess) {
					this.showTaskComplete();
				}
				return createSuccess;
			}

			if (lastPage) {
				let clickedNext = nextOnLastPage || info.newPage > info.lastPage;
				let pageValid = await lastPage.onPageLeave(clickedNext);
				if (!pageValid) {
					return false;
				}
			}

			this.clearStatusMessage();
			return true;
		});

		let cleanupSession = async () => {
			try {
				if (this.model.sessionId) {
					await this.provider.disposeWizardSession(this.model.sessionId);
					delete this.model.sessionId;
					delete this.model.allDatabases;
				}
			} catch (error) {
				this.appContext.apiWrapper.showErrorMessage(error.toString());
			}
		};
		this.wizard.cancelButton.onClick(() => {
			cleanupSession();
		});
		this.wizard.doneButton.onClick(() => {
			cleanupSession();
		});

		this.wizard.generateScriptButton.hidden = true;
		this.wizard.generateScriptButton.onClick(async () => {
			let input = TableFromFileWizard.generateInputFromModel(this.model);
			let generateScriptResponse = await this.provider.generateScript(input);
			if (generateScriptResponse.isSuccess) {
				let doc = await this.appContext.apiWrapper.openTextDocument({ language: 'sql', content: generateScriptResponse.script });
				await this.appContext.apiWrapper.showDocument(doc);
				this.showInfoMessage(
					localize('tableFromFileImport.openScriptMsg',
						'The script has opened in a document window. You can view it once the wizard is closed.'));
			} else {
				this.showErrorMessage(generateScriptResponse.errorMessages.join('\n'));
			}
		});

		this.wizard.pages = [page0, page1, page2, page3];

		this.wizard.open();
	}

	public setGenerateScriptVisibility(visible: boolean) {
		this.wizard.generateScriptButton.hidden = !visible;
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean) {
		this.wizard.registerNavigationValidator(validator);
	}

	public changeDoneButtonLabel(label: string) {
		this.wizard.doneButton.label = label;
	}

	public showErrorMessage(errorMsg: string) {
		this.showStatusMessage(errorMsg, azdata.window.MessageLevel.Error);
	}

	public showInfoMessage(infoMsg: string) {
		this.showStatusMessage(infoMsg, azdata.window.MessageLevel.Information);
	}

	private async getConnectionInfo(): Promise<azdata.connection.ConnectionProfile> {
		let serverConn = await azdata.connection.getCurrentConnection();
		if (serverConn) {
			let credentials = await azdata.connection.getCredentials(serverConn.connectionId);
			if (credentials) {
				Object.assign(serverConn, credentials);
			}
		}

		return serverConn;
	}

	private showStatusMessage(message: string, level: azdata.window.MessageLevel) {
		this.wizard.message = <azdata.window.DialogMessage>{
			text: message,
			level: level
		};
	}

	public clearStatusMessage() {
		this.wizard.message = undefined;
	}

	public static generateInputFromModel(model: ImportDataModel): VirtualizeDataInput {
		if (!model) {
			return undefined;
		}

		let result = <VirtualizeDataInput>{
			sessionId: model.sessionId,
			destDatabaseName: model.database,
			sourceServerType: DataSourceType.SqlHDFS,
			externalTableInfoList: [{
				externalTableName: undefined,
				columnDefinitionList: model.proseColumns,
				sourceTableLocation: [model.parentFile.filePath],
				fileFormat: {
					formatName: model.fileFormat,
					formatType: delimitedTextFileType,
					fieldTerminator: model.columnDelimiter,
					stringDelimiter: model.quoteCharacter,
					firstRow: model.firstRow
				}
			}]
		};

		if (model.newDataSource) {
			result.newDataSourceName = model.newDataSource.name;
			let dataSrcUrl = url.parse(model.newDataSource.location);
			result.sourceServerName = `${dataSrcUrl.host}${dataSrcUrl.pathname}`;
		} else {
			result.existingDataSourceName = model.existingDataSource;
		}

		if (model.newSchema) {
			result.newSchemas = [model.newSchema];
			result.externalTableInfoList[0].externalTableName = [model.newSchema, model.table];
		} else {
			result.externalTableInfoList[0].externalTableName = [model.existingSchema, model.table];
		}

		return result;
	}

	private async handleVirtualizeData(): Promise<boolean> {
		let errorMsg: string;

		try {
			let dataInput = TableFromFileWizard.generateInputFromModel(this.model);
			let createTableResponse = await this.provider.processVirtualizeDataInput(dataInput);
			if (!createTableResponse.isSuccess) {
				errorMsg = createTableResponse.errorMessages.join('\n');
			}
		} catch (err) {
			errorMsg = utils.getErrorMessage(err);
		}

		if (errorMsg) {
			this.showErrorMessage(errorMsg);
			return false;
		}

		return true;
	}

	private showTaskComplete() {
		this.wizard.registerOperation({
			connection: undefined,
			displayName: localize('tableFromFile.taskLabel', 'Virtualize Data'),
			description: undefined,
			isCancelable: false,
			operation: op => {
				op.updateStatus(azdata.TaskStatus.Succeeded);
			}
		});
	}
}
