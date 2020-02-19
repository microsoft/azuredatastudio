/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as os from 'os';
import * as nls from 'vscode-nls';
import * as path from 'path';

import { JupyterController } from './jupyter/jupyterController';
import { AppContext } from './common/appContext';
import { ApiWrapper } from './common/apiWrapper';
import { IExtensionApi, IPackageManageProvider } from './types';
import { CellType } from './contracts/content';
import { getErrorMessage, isEditorTitleFree } from './common/utils';
import { NotebookUriHandler } from './protocol/notebookUriHandler';
import { BookTreeViewProvider } from './book/bookTreeView';
import { promises as fs } from 'fs';

const localize = nls.loadMessageBundle();

const JUPYTER_NOTEBOOK_PROVIDER = 'jupyter';
const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', "This sample code loads the file into a data frame and shows the first 10 results.");
const noNotebookVisible = localize('noNotebookVisible', "No notebook editor is active");
const BOOKS_VIEWID = 'bookTreeView';
const READONLY_BOOKS_VIEWID = 'unsavedBookTreeView';
let controller: JupyterController;
type ChooseCellType = { label: string, id: CellType };

export async function activate(extensionContext: vscode.ExtensionContext): Promise<IExtensionApi> {
	const createBookPath: string = path.posix.join(extensionContext.extensionPath, 'resources', 'notebooks', 'JupyterBooksCreate.ipynb');
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openBook', (bookPath: string, openAsUntitled: boolean, urlToOpen?: string) => openAsUntitled ? untitledBookTreeViewProvider.openBook(bookPath, urlToOpen) : bookTreeViewProvider.openBook(bookPath, urlToOpen)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openNotebook', (resource) => bookTreeViewProvider.openNotebook(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openUntitledNotebook', (resource) => untitledBookTreeViewProvider.openNotebookAsUntitled(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openMarkdown', (resource) => bookTreeViewProvider.openMarkdown(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('bookTreeView.openExternalLink', (resource) => bookTreeViewProvider.openExternalLink(resource)));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.saveBook', () => untitledBookTreeViewProvider.saveJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchBook', () => bookTreeViewProvider.searchJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.searchUntitledBook', () => untitledBookTreeViewProvider.searchJupyterBooks()));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openBook', () => bookTreeViewProvider.openNewBook()));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.createBook', async () => {
		let untitledFileName: vscode.Uri = vscode.Uri.parse(`untitled:${createBookPath}`);
		vscode.workspace.openTextDocument(createBookPath).then((document) => {
			azdata.nb.showNotebookDocument(untitledFileName, {
				connectionProfile: null,
				initialContent: document.getText(),
				initialDirtyState: false
			});
		});
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('_notebook.command.new', (context?: azdata.ConnectedContext) => {
		let connectionProfile: azdata.IConnectionProfile = undefined;
		if (context && context.connectionProfile) {
			connectionProfile = context.connectionProfile;
		}
		newNotebook(connectionProfile);
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.open', async () => {
		await openNotebook();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runactivecell', async () => {
		await runActiveCell();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.runallcells', async () => {
		await runAllCells();
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.clearactivecellresult', async () => {
		await clearActiveCellOutput();
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
			await addCell(cellType);
		}
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addcode', async () => {
		await addCell('code');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.addtext', async () => {
		await addCell('markdown');
	}));
	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.analyzeNotebook', async (explorerContext: azdata.ObjectExplorerContext) => {
		await analyzeNotebook(explorerContext);
	}));
	extensionContext.subscriptions.push(vscode.window.registerUriHandler(new NotebookUriHandler()));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('books.command.openLocalizedBooks', async () => {
		const urlToOpen: string = 'https://aka.ms/localized-BDC-book';
		await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(urlToOpen));
	}));

	let appContext = new AppContext(extensionContext, new ApiWrapper());
	controller = new JupyterController(appContext);
	let result = await controller.activate();
	if (!result) {
		return undefined;
	}

	let workspaceFolders = vscode.workspace.workspaceFolders?.slice() ?? [];
	const bookTreeViewProvider = new BookTreeViewProvider(workspaceFolders, extensionContext, false, BOOKS_VIEWID);
	await bookTreeViewProvider.initialized;
	const untitledBookTreeViewProvider = new BookTreeViewProvider([], extensionContext, true, READONLY_BOOKS_VIEWID);
	await untitledBookTreeViewProvider.initialized;

	extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(BOOKS_VIEWID, bookTreeViewProvider));
	extensionContext.subscriptions.push(vscode.window.registerTreeDataProvider(READONLY_BOOKS_VIEWID, untitledBookTreeViewProvider));

	extensionContext.subscriptions.push(vscode.commands.registerCommand('notebook.command.openCreatedBook', async (bookPath: string) => {
		await updateBookMetadata(bookPath);
		bookTreeViewProvider.openBook(bookPath, undefined);
	}));

	return {
		getJupyterController() {
			return controller;
		},
		registerPackageManager(providerId: string, packageManagerProvider: IPackageManageProvider): void {
			controller.registerPackageManager(providerId, packageManagerProvider);
		},
		getPackageManagers() {
			return controller.packageManageProviders;
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

async function updateBookMetadata(bookPath: string): Promise<void> {
	try {
		// get the toc file and update the contents
		let tocFilePath: string = path.join(bookPath, '_data', 'toc.yml');
		let result: string;
		await fs.readFile(tocFilePath).then(data => {
			result = data.toString();
			let contentFolders: string[] = [];
			// check if there any lines matching: - header: <headerValue>
			let headers = result.match(/- header: [a-zA-Z0-9\\.\s-]+$/gm);
			// check if there any lines matching: - url: <path to the ipynb or md file>
			let urls = result.match(/- url: [a-zA-Z0-9\\.\s-\/]+$/gm);
			// check the first url in the toc file that comes after all the comments.
			let firstLevelUrls = result.match(/^(?:\s+$[\r\n]+)+(- url: [a-zA-Z0-9\\.\s-\/]+$[\r\n]+)/gm);
			let title: string;
			let replacedString: string;
			if (firstLevelUrls || headers || urls) {
				// there must only be one first level url
				if (firstLevelUrls && firstLevelUrls.length === 1) {
					firstLevelUrls.map(url => {
						title = url.substring(url.lastIndexOf(path.sep) + 1).replace(/(\r\n|\n|\r)/gm, '');
						// if there are sub folders inside content, just add this without sections
						if (!headers) {
							let markdownUrl = urls[urls.length - 1];
							title = markdownUrl.substring(markdownUrl.lastIndexOf(path.sep) + 1).replace(/(\r\n|\n|\r)/gm, '');
							replacedString = `\n- title: ${title}\n  url: /${title}\n  not_numbered: true\n  expand_sections: true\n  sections:\n` + url;
							result = result.replace(markdownUrl, '');
						} else {
							replacedString = `\n- title: ${title}\n  url: /${title}\n  not_numbered: true\n`;
						}
						result = result.replace(url, replacedString);
					});
				}
				if (headers) {
					headers.map(header => {
						title = header.substring(10).replace(/(\r\n|\n|\r)/gm, '');
						// for the url you need to have home page on clicking on the header section
						// check urls that are inside this folder and pick the first one as home
						contentFolders.push(title.toLocaleLowerCase());
						let filtered: string[] = urls.filter(x => x.indexOf(`${path.sep}${title.toLocaleLowerCase()}${path.sep}`) > -1);
						// toc has markdown files listed at the bottom.
						let index: number = urls.findIndex(x => x === filtered[filtered.length - 1]);
						let urlValue: string = urls[index].substring(urls[index].lastIndexOf(path.sep) + 1).replace(/(\r\n|\n|\r)/gm, '');
						replacedString = `- title: ${title}\n  url: /${title}/${urlValue}\n  not_numbered: true\n  expand_sections: true\n  sections:\n`;
						result = result.replace(header, replacedString);
						result = result.replace(urls[index], '');
						urls.splice(index, 1);
					});
				}
				if (urls) {
					urls.map(url => {
						title = url.substring(url.lastIndexOf(path.sep) + 1).replace(/(\r\n|\n|\r)/gm, '');
						let urlValue: string = title;
						// if there are folders inside content, the url will be that foldrname/filename
						if (contentFolders.length > 0) {
							// get each folder from the path bread crumb and check if the last folder is inside content
							let folders: string[] = url.substring(8).split(path.sep);
							let parentFolder: number = contentFolders.findIndex(x => x === folders[folders.length - 2]);
							if (parentFolder > -1) {
								urlValue = `${contentFolders[parentFolder]}/${title}`;
							}
						}
						replacedString = `  - title: ${title}\n    url: /${urlValue}\n`;
						result = result.replace(url, replacedString);
					});
				}
				fs.writeFile(tocFilePath, result);
			} else {
				new ApiWrapper().showErrorMessage('File Name contains unsupported-characters (ex: underscores or spaces) by Jupyter Book');
			}
		});
		// update the book title
		let configFilePath: string = path.join(bookPath, '_config.yml');
		await fs.readFile(configFilePath).then(data => {
			let titleLine = data.toString().match(/title: [a-zA-Z0-9\\.\s-\/]+$/gm);
			let title: string = `title: ${path.basename(bookPath)}`;
			result = data.toString().replace(titleLine[0], title);
			fs.writeFile(configFilePath, result);
		});
	} catch (error) {
		new ApiWrapper().showErrorMessage(error);
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
