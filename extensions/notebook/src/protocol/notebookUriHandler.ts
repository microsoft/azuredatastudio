/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as request from 'request';
import * as path from 'path';
import * as querystring from 'querystring';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import { IQuestion, confirm } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { getErrorMessage, isEditorTitleFree } from '../common/utils';

export class NotebookUriHandler implements vscode.UriHandler {
	private prompter = new CodeAdapter();

	constructor() {
	}

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		switch (uri.path) {
			case '/new':
				vscode.commands.executeCommand('notebook.command.new');
				break;
			case '/open':
				this.open(uri);
				break;
			default:
				vscode.window.showErrorMessage(localize('notebook.unsupportedAction', "Action {0} is not supported for this handler", uri.path));
		}
	}

	private open(uri: vscode.Uri): void {
		const data = querystring.parse(uri.query);

		if (!data.url) {
			console.warn('Failed to open URI:', uri);
		}

		this.openNotebook(data.url);
	}

	private async openNotebook(url: string | string[]): Promise<void> {
		try {
			if (Array.isArray(url)) {
				url = url[0];
			}
			url = decodeURI(url);
			let uri = vscode.Uri.parse(url);
			switch (uri.scheme) {
				case 'http':
				case 'https':
					break;
				default:
					vscode.window.showErrorMessage(localize('unsupportedScheme', "Cannot open link {0} as only HTTP and HTTPS links are supported", url));
					return;
			}

			let doOpen = await this.prompter.promptSingle<boolean>(<IQuestion>{
				type: confirm,
				message: localize('notebook.confirmOpen', "Download and open '{0}'?", url),
				default: true
			});
			if (!doOpen) {
				return;
			}

			let contents = await this.download(url);
			let untitledUri = this.getUntitledUri(path.basename(uri.fsPath));
			if (path.extname(uri.fsPath) === '.ipynb') {
				await azdata.nb.showNotebookDocument(untitledUri, {
					initialContent: contents,
					preserveFocus: true
				});
			} else {
				let doc = await vscode.workspace.openTextDocument(untitledUri);
				let editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active, true);
				await editor.edit(builder => {
					builder.insert(new vscode.Position(0, 0), contents);
				});
			}
		} catch (err) {
			vscode.window.showErrorMessage(getErrorMessage(err));
		}
	}

	private download(url: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			request.get(url, { timeout: 10000 }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(localize('notebook.fileNotFound', "Could not find the specified file"));
				}

				if (response.statusCode !== 200) {
					return reject(
						localize('notebook.fileDownloadError',
							"File open request failed with error: {0} {1}",
							response.statusCode,
							response.statusMessage));
				}

				resolve(body);
			});
		});
	}

	private getUntitledUri(originalTitle: string): vscode.Uri {
		let title = originalTitle;
		let nextVal = 0;
		let ext = path.extname(title);
		while (!isEditorTitleFree(title)) {
			if (ext) {
				// Need it to be `Readme-0.txt` not `Readme.txt-0`
				let titleStart = originalTitle.slice(0, originalTitle.length - ext.length);
				title = `${titleStart}-${nextVal}${ext}`;
			} else {
				title = `${originalTitle}-${nextVal}`;
			}
			nextVal++;
		}
		return vscode.Uri.parse(`untitled:${title}`);
	}
}
