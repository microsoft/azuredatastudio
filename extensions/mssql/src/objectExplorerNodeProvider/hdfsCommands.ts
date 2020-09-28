/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { promises as fs } from 'fs';
import * as fspath from 'path';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { Command, ICommandViewContext, ProgressCommand, ICommandObjectExplorerContext } from './command';
import { File, IFile, joinHdfsPath, FileType } from './fileSources';
import { FolderNode, FileNode, HdfsFileSourceNode } from './hdfsProvider';
import { IPrompter, IQuestion, QuestionTypes } from '../prompts/question';
import * as constants from '../constants';
import * as LocalizedConstants from '../localizedConstants';
import * as utils from '../utils';
import { AppContext } from '../appContext';
import { TreeNode } from './treeNodes';
import { MssqlObjectExplorerNodeProvider } from './objectExplorerNodeProvider';
import { ManageAccessDialog } from '../hdfs/ui/hdfsManageAccessDialog';

async function getSaveableUri(fileName: string, isPreview?: boolean): Promise<vscode.Uri> {
	let root = utils.getUserHome();
	let workspaceFolders = vscode.workspace.workspaceFolders;
	if (workspaceFolders && workspaceFolders.length > 0) {
		root = workspaceFolders[0].uri.fsPath;
	}
	// Cannot preview with a file path that already exists, so keep looking for a valid path that does not exist
	if (isPreview) {
		let fileNum = 1;
		let fileNameWithoutExtension = fspath.parse(fileName).name;
		let fileExtension = fspath.parse(fileName).ext;
		while (await utils.exists(fspath.join(root, fileName))) {
			fileName = `${fileNameWithoutExtension}-${fileNum}${fileExtension}`;
			fileNum++;
		}
	}
	return vscode.Uri.file(fspath.join(root, fileName));
}

export async function getNode<T extends TreeNode>(context: ICommandViewContext | ICommandObjectExplorerContext, appContext: AppContext): Promise<T> {
	let node: T = undefined;
	if (context && context.type === constants.ViewType && context.node) {
		node = context.node as T;
	} else if (context && context.type === constants.ObjectExplorerService) {
		let oeNodeProvider = appContext.getService<MssqlObjectExplorerNodeProvider>(constants.ObjectExplorerService);
		if (oeNodeProvider) {
			node = await oeNodeProvider.findSqlClusterNodeByContext<T>(context);
		}
	} else {
		throw new Error(LocalizedConstants.msgMissingNodeContext);
	}
	return node;
}

export class UploadFilesCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.uploadFiles', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let folderNode = await getNode<FolderNode>(context, this.appContext);
			const allFilesFilter = localize('allFiles', "All Files");
			let filter: { [key: string]: string[] } = {};
			filter[allFilesFilter] = ['*'];
			if (folderNode) {
				let options: vscode.OpenDialogOptions = {
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: true,
					openLabel: localize('lblUploadFiles', "Upload"),
					filters: filter
				};
				let fileUris: vscode.Uri[] = await vscode.window.showOpenDialog(options);
				if (fileUris) {
					let files: IFile[] = await Promise.all(fileUris.map(uri => uri.fsPath).map(this.mapPathsToFiles()));
					await this.executeWithProgress(
						(cancelToken: vscode.CancellationTokenSource) => this.writeFiles(files, folderNode, cancelToken),
						localize('uploading', "Uploading files to HDFS"), true,
						() => vscode.window.showInformationMessage(localize('uploadCanceled', "Upload operation was canceled")));
					if (context.type === constants.ObjectExplorerService) {
						let objectExplorerNode = await azdata.objectexplorer.getNode(context.explorerContext.connectionProfile.id, folderNode.getNodeInfo().nodePath);
						await objectExplorerNode.refresh();
					}
				}
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('uploadError', "Error uploading files: {0}", utils.getErrorMessage(err, true)));
		}
	}

	private mapPathsToFiles(): (value: string, index: number, array: string[]) => Promise<File> {
		return async (path: string) => {
			const stats = (await fs.lstat(path));
			if (stats.isDirectory()) {
				return new File(path, FileType.Directory);
			} else if (stats.isSymbolicLink()) {
				return new File(path, FileType.Symlink);
			} else {
				return new File(path, FileType.File);
			}

		};
	}

	private async writeFiles(files: IFile[], folderNode: FolderNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		for (let file of files) {
			if (cancelToken.token.isCancellationRequested) {
				// Throw here so that all recursion is ended
				throw new Error('Upload canceled');
			}
			if (file.fileType === FileType.Directory) {
				let dirName = fspath.basename(file.path);
				let subFolder = await folderNode.mkdir(dirName);
				let children: IFile[] = await Promise.all((await fs.readdir(file.path))
					.map(childFileName => joinHdfsPath(file.path, childFileName))
					.map(this.mapPathsToFiles()));
				this.writeFiles(children, subFolder, cancelToken);
			} else {
				await folderNode.writeFile(file);
			}
		}
	}
}
export class MkDirCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.mkdir', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let folderNode = await getNode<FolderNode>(context, this.appContext);

			if (folderNode) {
				let fileName: string = await this.getDirName();
				if (fileName && fileName.length > 0) {
					await this.executeWithProgress(
						async (cancelToken: vscode.CancellationTokenSource) => this.mkDir(fileName, folderNode, cancelToken),
						localize('makingDir', "Creating directory"), true,
						() => vscode.window.showInformationMessage(localize('mkdirCanceled', "Operation was canceled")));
					if (context.type === constants.ObjectExplorerService) {
						let objectExplorerNode = await azdata.objectexplorer.getNode(context.explorerContext.connectionProfile.id, folderNode.getNodeInfo().nodePath);
						await objectExplorerNode.refresh();
					}
				}
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('mkDirError', "Error on making directory: {0}", utils.getErrorMessage(err, true)));
		}
	}

	private async getDirName(): Promise<string> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.input,
			name: 'enterDirName',
			message: localize('enterDirName', "Enter directory name"),
			default: ''
		}).then(confirmed => <string>confirmed);
	}

	private async mkDir(fileName: string, folderNode: FolderNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		await folderNode.mkdir(fileName);
	}
}

export class DeleteFilesCommand extends Command {

	constructor(private prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.deleteFiles', appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let node = await getNode<TreeNode>(context, this.appContext);
			if (node) {
				// TODO ideally would let node define if it's deletable
				// TODO also, would like to change this to getNodeInfo as OE is the primary use case now
				let treeItem = await node.getTreeItem();
				let oeNodeToRefresh: azdata.objectexplorer.ObjectExplorerNode = undefined;
				if (context.type === constants.ObjectExplorerService) {
					let oeNodeToDelete = await azdata.objectexplorer.getNode(context.explorerContext.connectionProfile.id, node.getNodeInfo().nodePath);
					oeNodeToRefresh = await oeNodeToDelete.getParent();
				}
				switch (treeItem.contextValue) {
					case constants.MssqlClusterItems.Folder:
						await this.deleteFolder(<FolderNode>node);
						break;
					case constants.MssqlClusterItems.File:
						await this.deleteFile(<FileNode>node);
						break;
					default:
						return;
				}
				if (oeNodeToRefresh) {
					await oeNodeToRefresh.refresh();
				}
			} else {
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('deleteError', "Error on deleting files: {0}", utils.getErrorMessage(err, true)));
		}
	}

	private async confirmDelete(deleteMsg: string): Promise<boolean> {
		return await this.prompter.promptSingle(<IQuestion>{
			type: QuestionTypes.confirm,
			message: deleteMsg,
			default: false
		}).then(confirmed => <boolean>confirmed);
	}

	private async deleteFolder(node: FolderNode): Promise<void> {
		if (node) {
			let confirmed = await this.confirmDelete(localize('msgDeleteFolder', "Are you sure you want to delete this folder and its contents?"));
			if (confirmed) {
				// TODO prompt for recursive delete if non-empty?
				await node.delete(true);
			}
		}
	}

	private async deleteFile(node: FileNode): Promise<void> {
		if (node) {
			let confirmed = await this.confirmDelete(localize('msgDeleteFile', "Are you sure you want to delete this file?"));
			if (confirmed) {
				await node.delete();
			}
		}
	}
}

export class SaveFileCommand extends ProgressCommand {

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.saveFile', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let fileNode = await getNode<FileNode>(context, this.appContext);
			if (fileNode) {
				let defaultUri = await getSaveableUri(fspath.basename(fileNode.hdfsPath));
				let fileUri: vscode.Uri = await vscode.window.showSaveDialog({
					defaultUri: defaultUri
				});
				if (fileUri) {
					await this.executeWithProgress(
						(cancelToken: vscode.CancellationTokenSource) => this.doSaveAndOpen(fileUri, fileNode, cancelToken),
						localize('saving', "Saving HDFS Files"), true,
						() => vscode.window.showInformationMessage(localize('saveCanceled', "Save operation was canceled")));
				}
			} else {
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('saveError', "Error on saving file: {0}", utils.getErrorMessage(err, true)));
		}
	}

	private async doSaveAndOpen(fileUri: vscode.Uri, fileNode: FileNode, cancelToken: vscode.CancellationTokenSource): Promise<void> {
		await fileNode.writeFileContentsToDisk(fileUri.fsPath, cancelToken);
		await vscode.commands.executeCommand('vscode.open', fileUri);
	}
}

export class PreviewFileCommand extends ProgressCommand {
	public static readonly DefaultMaxSize = 30 * 1024 * 1024;

	constructor(prompter: IPrompter, appContext: AppContext) {
		super('mssqlCluster.previewFile', prompter, appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let fileNode = await getNode<FileNode>(context, this.appContext);
			if (fileNode) {
				await this.executeWithProgress(
					async (cancelToken: vscode.CancellationTokenSource) => {
						let contents = await fileNode.getFileContentsAsString(PreviewFileCommand.DefaultMaxSize);
						let fileName: string = fspath.basename(fileNode.hdfsPath);
						if (fspath.extname(fileName) !== '.ipynb') {
							const doc = await this.openTextDocument(fileName);
							const options: vscode.TextDocumentShowOptions = {
								viewColumn: vscode.ViewColumn.Active,
								preserveFocus: false
							};
							const editor = await vscode.window.showTextDocument(doc, options);
							await editor.edit(edit => {
								edit.insert(new vscode.Position(0, 0), contents);
							});
						} else {
							let connectionProfile: azdata.IConnectionProfile = undefined;
							if (context.type === constants.ObjectExplorerService) {
								connectionProfile = context.explorerContext.connectionProfile;
							}
							await this.showNotebookDocument(fileName, connectionProfile, contents);
						}
					},
					localize('previewing', "Generating preview"),
					false);
			} else {
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('previewError', "Error on previewing file: {0}", utils.getErrorMessage(err, true)));
		}
	}

	private async showNotebookDocument(fileName: string, connectionProfile?: azdata.IConnectionProfile,
		initialContent?: string
	): Promise<azdata.nb.NotebookEditor> {
		let docUri: vscode.Uri = (await getSaveableUri(fileName, true))
			.with({ scheme: constants.UNTITLED_SCHEMA });
		return await azdata.nb.showNotebookDocument(docUri, {
			connectionProfile: connectionProfile,
			preview: false,
			initialContent: initialContent
		});
	}

	private async openTextDocument(fileName: string): Promise<vscode.TextDocument> {
		let docUri: vscode.Uri = await getSaveableUri(fileName, true);
		if (docUri) {
			docUri = docUri.with({ scheme: constants.UNTITLED_SCHEMA });
			return await vscode.workspace.openTextDocument(docUri);
		} else {
			// Can't reliably create a filename to save as so just use untitled
			let language = fspath.extname(fileName);
			if (language && language.length > 0) {
				// trim the '.'
				language = language.substring(1);
			}
			return await vscode.workspace.openTextDocument({
				language: language
			});
		}
	}
}

export class CopyPathCommand extends Command {
	public static readonly DefaultMaxSize = 30 * 1024 * 1024;

	constructor(appContext: AppContext) {
		super('mssqlCluster.copyPath', appContext);
	}

	protected async preExecute(context: ICommandViewContext | ICommandObjectExplorerContext, args: object = {}): Promise<any> {
		return this.execute(context, args);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let node = await getNode<HdfsFileSourceNode>(context, this.appContext);
			if (node) {
				let path = node.hdfsPath;
				vscode.env.clipboard.writeText(path);
			} else {
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('copyPathError', "Error on copying path: {0}", utils.getErrorMessage(err, true)));
		}
	}
}

export class ManageAccessCommand extends Command {

	constructor(appContext: AppContext) {
		super('mssqlCluster.manageAccess', appContext);
	}

	async execute(context: ICommandViewContext | ICommandObjectExplorerContext, ...args: any[]): Promise<void> {
		try {
			let node = await getNode<HdfsFileSourceNode>(context, this.appContext);
			if (node) {
				new ManageAccessDialog(node.hdfsPath, node.fileSource).openDialog();
			} else {
				vscode.window.showErrorMessage(LocalizedConstants.msgMissingNodeContext);
			}
		} catch (err) {
			vscode.window.showErrorMessage(
				localize('manageAccessError', "An unexpected error occurred while opening the Manage Access dialog: {0}", utils.getErrorMessage(err, true)));
		}
	}
}
