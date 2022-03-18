/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import * as request from 'request';
import * as path from 'path';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();
import { IQuestion, QuestionTypes } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { getErrorMessage, isEditorTitleFree } from '../common/utils';
import * as constants from '../common/constants';
import { readJson } from 'fs-extra';


export class NotebookUriHandler implements vscode.UriHandler {
	private prompter = new CodeAdapter();

	constructor() {
	}

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		switch (uri.path) {
			case '/new':
				return vscode.commands.executeCommand(constants.notebookCommandNew);
			case '/open':
				return this.open(uri);
			default:
				void vscode.window.showErrorMessage(localize('notebook.unsupportedAction', "Action {0} is not supported for this handler", uri.path));
		}
	}
	/**
	 * Our Azure Data Studio URIs follow the standard URI format, and we currently only support https and http URI schemes
	 * azuredatastudio://microsoft.notebook/open?url=https://
	 * azuredatastudio://microsoft.notebook/open?url=http://
	 *
	 * Example of URI (encoded):
	 * azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2Fraw.githubusercontent.com%2FVasuBhog%2FAzureDataStudio-Notebooks%2Fmain%2FDemo_Parameterization%2FInput.ipynb
	 *
	 * We also support parameters added to the URI for parameterization scenarios
	 *
	 * Parameters via the URI are formatted by adding the parameters after the .ipynb with a
	 * query '?' and use '&' to distinguish a new parameter
	 *
	 * Example of Parameters query:
	 * ...Input.ipynb?x=1&y=2'
	 *
	 * Encoded URI with parameters:
	 * azuredatastudio://microsoft.notebook/open?url=https%3A%2F%2Fraw.githubusercontent.com%2FVasuBhog%2FAzureDataStudio-Notebooks%2Fmain%2FDemo_Parameterization%2FInput.ipynb%3Fx%3D1%26y%3D2
	 * Decoded URI with parameters:
	 * azuredatastudio://microsoft.notebook/open?url=https://raw.githubusercontent.com/VasuBhog/AzureDataStudio-Notebooks/main/Demo_Parameterization/Input.ipynb?x=1&y=2
	 */
	private open(uri: vscode.Uri): Promise<void> {
		let data: string;
		// We ensure that the URI is formatted properly
		let urlIndex = uri.query.indexOf('url=');
		if (urlIndex >= 0) {
			// Querystring can not be used as it incorrectly turns parameters attached
			// to the URI query into key/value pairs and would then fail to open the URI
			data = uri.query.substr(urlIndex + 4);
		}

		if (!data) {
			console.warn('Failed to open URI:', uri);
		}

		return this.openNotebook(data);
	}

	private async openNotebook(url: string | string[]): Promise<void> {
		try {
			if (Array.isArray(url)) {
				url = url[0];
			}
			url = decodeURI(url);
			let uri = vscode.Uri.parse(url);
			switch (uri.scheme) {
				case 'file':
				case 'http':
				case 'https':
					break;
				default:
					void vscode.window.showErrorMessage(localize('unsupportedScheme', "Cannot open link {0} as only HTTP, HTTPS, and File links are supported", url));
					return;
			}
			let contents: string;
			if (uri.scheme === 'file') {
				contents = await readJson(uri.fsPath);
			} else {
				let doOpen = await this.prompter.promptSingle<boolean>(<IQuestion>{
					type: QuestionTypes.confirm,
					message: localize('notebook.confirmOpen', "Download and open '{0}'?", url),
					default: true
				});
				if (!doOpen) {
					return;
				}
				contents = await this.download(url);
			}
			let untitledUriPath = this.getUntitledUriPath(path.basename(uri.fsPath));
			let untitledUri = uri.with({ authority: '', scheme: 'untitled', path: untitledUriPath });
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
			void vscode.window.showErrorMessage(getErrorMessage(err));
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

	private getUntitledUriPath(originalTitle: string): string {
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
		return title;
	}
}
