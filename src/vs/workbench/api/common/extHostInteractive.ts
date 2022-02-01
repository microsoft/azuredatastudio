/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI, UriComponents } from 'vs/base/common/uri';
import { ExtHostInteractiveShape, IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ApiCommand, ApiCommandArgument, ApiCommandResult, ExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { ExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { ExtHostNotebookController } from 'vs/workbench/api/common/extHostNotebook';
import { NotebookEditor } from 'vscode';

export class ExtHostInteractive implements ExtHostInteractiveShape {
	constructor(
		mainContext: IMainContext,
		private _extHostNotebooks: ExtHostNotebookController,
		private _textDocumentsAndEditors: ExtHostDocumentsAndEditors,
		private _commands: ExtHostCommands
	) {
		const apiCommand = new ApiCommand(
			'interactive.open',
			'_interactive.open',
			'Open interactive window and return notebook editor and input URI',
			[
				new ApiCommandArgument('showOptions', 'Show Options', v => true, v => v),
				new ApiCommandArgument('resource', 'Interactive resource Uri', v => true, v => v),
				new ApiCommandArgument('controllerId', 'Notebook controller Id', v => true, v => v),
				new ApiCommandArgument('title', 'Interactive editor title', v => true, v => v)
			],
			new ApiCommandResult<{ notebookUri: UriComponents, inputUri: UriComponents, notebookEditorId?: string }, { notebookUri: URI, inputUri: URI, notebookEditor?: NotebookEditor }>('Notebook and input URI', (v: { notebookUri: UriComponents, inputUri: UriComponents, notebookEditorId?: string }) => {
				if (v.notebookEditorId !== undefined) {
					const editor = this._extHostNotebooks.getEditorById(v.notebookEditorId);
					return { notebookUri: URI.revive(v.notebookUri), inputUri: URI.revive(v.inputUri), notebookEditor: editor.apiEditor };
				}
				return { notebookUri: URI.revive(v.notebookUri), inputUri: URI.revive(v.inputUri) };
			})
		);
		this._commands.registerApiCommand(apiCommand);
	}

	$willAddInteractiveDocument(uri: UriComponents, eol: string, modeId: string, notebookUri: UriComponents) {
		this._textDocumentsAndEditors.acceptDocumentsAndEditorsDelta({
			addedDocuments: [{
				EOL: eol,
				lines: [''],
				modeId: modeId,
				uri: uri,
				isDirty: false,
				versionId: 1,
				notebook: this._extHostNotebooks.getNotebookDocument(URI.revive(notebookUri))?.apiNotebook
			}]
		});
	}

	$willRemoveInteractiveDocument(uri: UriComponents, notebookUri: UriComponents) {
		this._textDocumentsAndEditors.acceptDocumentsAndEditorsDelta({
			removedDocuments: [uri]
		});
	}
}
