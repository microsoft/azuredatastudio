/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'path';
import * as vscode from 'vscode';

import { ExtHostNotebookEditor } from 'sql/workbench/api/common/extHostNotebookEditor';
import { INotebookShowOptions } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { URI, UriComponents } from 'vs/base/common/uri';
import { ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { Schemas } from 'vs/base/common/network';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { IUntitledTextEditorService } from 'vs/workbench/services/untitled/common/untitledTextEditorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { viewColumnToEditorGroup } from 'vs/workbench/api/common/shared/editor';
import { IEditorGroupsService } from 'vs/workbench/services/editor/common/editorGroupsService';
import { MainThreadNotebookEditor } from 'sql/workbench/api/browser/mainThreadNotebookDocumentsAndEditors';


//#region Extension accessible methods
export class ShowNotebook {
	// private _capabilitiesService: ICapabilitiesService;
	constructor(
		@IUntitledTextEditorService private _untitledEditorService: IUntitledTextEditorService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IEditorGroupsService private _editorGroupService: IEditorGroupsService,
	) {
	}
	private readonly _editors = new Map<string, ExtHostNotebookEditor>();
	private _notebookEditors = new Map<string, MainThreadNotebookEditor>();


	showNotebookDocument(uri: vscode.Uri, showOptions: azdata.nb.NotebookShowOptions): Thenable<azdata.nb.NotebookEditor> {
		return this.doShowNotebookDocument(uri, showOptions);
	}

	private async doShowNotebookDocument(uri: vscode.Uri, showOptions: azdata.nb.NotebookShowOptions): Promise<azdata.nb.NotebookEditor> {
		let options: INotebookShowOptions = {};
		if (showOptions) {
			options.preserveFocus = showOptions.preserveFocus;
			options.preview = showOptions.preview;
			options.position = showOptions.viewColumn;
			options.providerId = showOptions.providerId;
			options.connectionProfile = showOptions.connectionProfile;
			options.defaultKernel = showOptions.defaultKernel;
			if (showOptions.initialContent) {
				if (typeof (showOptions.initialContent) !== 'string') {
					options.initialContent = JSON.stringify(showOptions.initialContent);
				} else {
					options.initialContent = showOptions.initialContent;
				}
			}
			options.initialDirtyState = showOptions.initialDirtyState;
		}
		let id = await this.$tryShowNotebookDocument(uri, options);
		let editor = this.getEditor(id);
		if (editor) {
			return editor;
		} else {
			throw new Error(`Failed to show notebook document ${uri.toString()}, should show in editor #${id}`);
		}
	}

	getEditor(id: string): ExtHostNotebookEditor {
		return this._editors.get(id);
	}

	$tryShowNotebookDocument(resource: UriComponents, options: INotebookShowOptions): Promise<string> {
		return Promise.resolve(this.doOpenEditor(resource, options));
	}


	private async doOpenEditor(resource: UriComponents, options: INotebookShowOptions): Promise<string> {

		const uri = URI.revive(resource);

		const editorOptions: ITextEditorOptions = {
			preserveFocus: options.preserveFocus,
			pinned: !options.preview
		};
		let isUntitled: boolean = uri.scheme === Schemas.untitled;

		let fileInput: UntitledTextEditorInput | FileEditorInput;
		if (isUntitled && path.isAbsolute(uri.fsPath)) {
			const model = this._untitledEditorService.create({ associatedResource: uri, mode: 'notebook', initialValue: options.initialContent });
			fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
		} else {
			if (isUntitled) {
				const model = this._untitledEditorService.create({ untitledResource: uri, mode: 'notebook', initialValue: options.initialContent });
				fileInput = this._instantiationService.createInstance(UntitledTextEditorInput, model);
			} else {
				fileInput = this._editorService.createEditorInput({ forceFile: true, resource: uri, mode: 'notebook' }) as FileEditorInput;
			}
		}
		let input: NotebookInput;
		if (isUntitled) {
			input = this._instantiationService.createInstance(UntitledNotebookInput, path.basename(uri.fsPath), uri, fileInput as UntitledTextEditorInput);
		} else {
			input = this._instantiationService.createInstance(FileNotebookInput, path.basename(uri.fsPath), uri, fileInput as FileEditorInput);
		}
		input.defaultKernel = options.defaultKernel;
		input.connectionProfile = new ConnectionProfile(this._capabilitiesService, options.connectionProfile);
		if (isUntitled) {
			let untitledModel = await (input as UntitledNotebookInput).textInput.resolve();
			await untitledModel.load();
			input.untitledEditorModel = untitledModel;
			if (options.initialDirtyState === false) {
				(input.untitledEditorModel as UntitledTextEditorModel).setDirty(false);
			}
		}
		let editor = await this._editorService.openEditor(input, editorOptions, viewColumnToEditorGroup(this._editorGroupService, options.position));
		if (!editor) {
			return undefined;
		}
		return this.waitOnEditor(input);
	}

	private async waitOnEditor(input: NotebookInput): Promise<string> {
		let id: string = undefined;
		let attemptsLeft = 10;
		let timeoutMs = 20;
		while (!id && attemptsLeft > 0) {
			id = this.findNotebookEditorIdFor(input);
			if (!id) {
				await this.wait(timeoutMs);
			}
		}
		return id;
	}

	findNotebookEditorIdFor(input: NotebookInput): string {
		let foundId: string = undefined;
		this._notebookEditors.forEach(e => {
			if (e.matches(input)) {
				foundId = e.id;
			}
		});
		return foundId;
	}

	wait(timeMs: number): Promise<void> {
		return new Promise((resolve: Function) => setTimeout(resolve, timeMs));
	}
}
