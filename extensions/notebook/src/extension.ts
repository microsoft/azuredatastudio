/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as os from 'os';
import * as nls from 'vscode-nls';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { ApiWrapper } from './common/apiWrapper';
import { IExtensionApi } from './types';
import { CellType } from './contracts/content';
import { getErrorMessage, isEditorTitleFree } from './common/utils';
import { NotebookUriHandler } from './protocol/notebookUriHandler';
import { BookTreeViewProvider } from './book/bookTreeView';

const localize = nls.loadMessageBundle();

const JUPYTER_NOTEBOOK_PROVIDER = 'jupyter';
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");
const noNotebookVisible = localize('noNotebookVisible', "No notebook editor is active");

let controller: JupyterController;
type ChooseCellType = { label: string, id: CellType };

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	const bookTreeViewProvider = new BookTreeViewProvider(vscode.workspace.workspaceFolders || [], extensionContext);
	extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider('bookTreeView', bookTreeViewProvider));
	extensionContext.subscriptions.push(azdata.nb.registerNavigationProvider(bookTreeViewProvider));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openBook', (bookPath: string, openAsUntitled: boolean, urlToOpen?: string) => bookTreeViewProvider.openBook(bookPath, openAsUntitled, urlToOpen)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebookAsUntitled', (resource: string) => bookTreeViewProvider.openNotebookAsUntitled(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebook', (resource: string) => bookTreeViewProvider.openNotebook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openMarkdown', (resource: string) => bookTreeViewProvider.openMarkdown(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openExternalLink', (resource: string) => bookTreeViewProvider.openExternalLink(resource)));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('_notebook.command.new', (context?: azdata.ConnectedContext) => {
		let connectionProfile: azdata.IConnectionProfile = undefined;
		if (context && context.connectionProfile) {
			connectionProfile = context.connectionProfile;
		}
		newNotebook(connectionProfile);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', () => {
		openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', () => {
		runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runallcells', () => {
		runAllCells();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.clearactivecellresult', () => {
		clearActiveCellOutput();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcell', async () => {
		let cellType: CellType;
		try {
			let cellTypes: ChooseCellType[] = [{
				label: localize('codeCellName', "Code"),
				id: 'code'
			},
			{
				label: localize('textCellName', "Text"),
				id: 'markdown'
			}];
			let selection = await vscode.window.showQuickPick(cellTypes, {
				placeHolder: localize('selectCellType', "What type of cell do you want to add?")
			});
			if (selection) {
				cellType = selection.id;
			}
		} catch (err) {
			return;
		}
		if (cellType) {
			addCell(cellType);
		}
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', () => {
		addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', () => {
		addCell('markdown');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', (explorerContext: azdata.ObjectExplorerContext) => {
		analyzeNotebook(explorerContext);
	}));
	extensionContext.subscriptions.push(vscode.window.registerUriHandler(new NotebookUriHandler()));


	let appContext = new AppContext(extensionContext, new ApiWrapper());
	controller = new JupyterController(appContext);
	let result = await controller.activate();
	if (!result) {
		return undefined;
	}

	return {
		getJupyterController() {
			return controller;
		}
	};
}

function newNotebook(connectionProfile: azdata.IConnectionProfile) {
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);
	let options: azdata.nb.NotebookShowOptions = connectionProfile ? {
		viewColumn: null,
		preserveFocus: true,
		preview: null,
		providerId: null,
		connectionProfile: connectionProfile,
		defaultKernel: null
	} : null;
	azdata.nb.showNotebookDocument(untitledUri, options).then(success => {

	}, (err: Error) => {
		vscode.window.showErrorMessage(err.message);
	});
}

function findNextUntitledEditorName(): string {
	let nextVal = 0;
	// Note: this will go forever if it's coded wrong, or you have infinite Untitled notebooks!
	while (true) {
		let title = `Notebook-${nextVal}`;
		if (isEditorTitleFree(title)) {
			return title;
		}
		nextVal++;
	}
}

async function openNotebook(): Promise<void> {
	try {
		let filter: { [key: string]: Array<string> } = {};
		// TODO support querying valid notebook file types
		filter[localize('notebookFiles', "Notebooks")] = ['ipynb'];
		let file = await vscode.window.showOpenDialog({
			filters: filter
		});
		if (file) {
			let doc = await vscode.workspace.openTextDocument(file[0]);
			vscode.window.showTextDocument(doc);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

async function runActiveCell(): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runCell();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

async function clearActiveCellOutput(): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.clearOutput();
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

async function runAllCells(startCell?: azdata.nb.NotebookCell, endCell?: azdata.nb.NotebookCell): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.runAllCells(startCell, endCell);
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

async function addCell(cellType: azdata.nb.CellType): Promise<void> {
	try {
		let notebook = azdata.nb.activeNotebookEditor;
		if (notebook) {
			await notebook.edit((editBuilder: azdata.nb.NotebookEditorEdit) => {
				// TODO should prompt and handle cell placement
				editBuilder.insertCell({
					cell_type: cellType,
					source: ''
				});
			});
		} else {
			throw new Error(noNotebookVisible);
		}
	} catch (err) {
		vscode.window.showErrorMessage(getErrorMessage(err));
	}
}

async function analyzeNotebook(oeContext?: azdata.ObjectExplorerContext): Promise<void> {
	// Ensure we get a unique ID for the notebook. For now we're using a different prefix to the built-in untitled files
	// to handle this. We should look into improving this in the future
	let title = findNextUntitledEditorName();
	let untitledUri = vscode.Uri.parse(`untitled:${title}`);

	let editor = await azdata.nb.showNotebookDocument(untitledUri, {
		connectionProfile: oeContext ? oeContext.connectionProfile : undefined,
		providerId: JUPYTER_NOTEBOOK_PROVIDER,
		preview: false,
		defaultKernel: {
			name: 'pysparkkernel',
			display_name: 'PySpark',
			language: 'python'
		}
	});
	if (oeContext && oeContext.nodeInfo && oeContext.nodeInfo.nodePath) {
		// Get the file path after '/HDFS'
		let hdfsPath: string = oeContext.nodeInfo.nodePath.substring(oeContext.nodeInfo.nodePath.indexOf('/HDFS') + '/HDFS'.length);
		if (hdfsPath.length > 0) {
			let analyzeCommand = '#' + msgSampleCodeDataFrame + os.EOL + 'df = (spark.read.option("inferSchema", "true")'
				+ os.EOL + '.option("header", "true")' + os.EOL + '.csv("{0}"))' + os.EOL + 'df.show(10)';

			editor.edit(editBuilder => {
				editBuilder.insertCell({
					cell_type: 'code',
					source: analyzeCommand.replace('{0}', hdfsPath)
				}, 0);
			});
		}
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (controller) {
		controller.deactivate();
	}
}
