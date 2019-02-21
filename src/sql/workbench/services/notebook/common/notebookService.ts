/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI } from 'vs/base/common/uri';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { RenderMimeRegistry } from 'sql/parts/notebook/outputs/registry';
import { ModelFactory } from 'sql/parts/notebook/models/modelFactory';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { NotebookInput } from 'sql/parts/notebook/notebookInput';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ICellModel, INotebookModel, ILanguageMagic } from 'sql/parts/notebook/models/modelInterfaces';

export const SERVICE_ID = 'notebookService';
export const INotebookService = createDecorator<INotebookService>(SERVICE_ID);

export const DEFAULT_NOTEBOOK_PROVIDER = 'builtin';
export const DEFAULT_NOTEBOOK_FILETYPE = 'IPYNB';
export const SQL_NOTEBOOK_PROVIDER = 'sql';
export const OVERRIDE_EDITOR_THEMING_SETTING = 'notebook.overrideEditorTheming';

export interface INotebookService {
	_serviceBrand: any;

	readonly onNotebookEditorAdd: Event<INotebookEditor>;
	readonly onNotebookEditorRemove: Event<INotebookEditor>;
	onNotebookEditorRename: Event<INotebookEditor>;

	readonly isRegistrationComplete: boolean;
	readonly registrationComplete: Promise<void>;
	readonly languageMagics: ILanguageMagic[];
	/**
	 * Register a metadata provider
	 */
	registerProvider(providerId: string, provider: INotebookProvider): void;

	/**
	 * Register a metadata provider
	 */
	unregisterProvider(providerId: string): void;

	getSupportedFileExtensions(): string[];

	getProvidersForFileType(fileType: string): string[];

	getStandardKernelsForProvider(provider: string): sqlops.nb.IStandardKernel[];

	/**
	 * Initializes and returns a Notebook manager that can handle all important calls to open, display, and
	 * run cells in a notebook.
	 * @param providerId ID for the provider to be used to instantiate a backend notebook service
	 * @param uri URI for a notebook that is to be opened. Based on this an existing manager may be used, or
	 * a new one may need to be created
	 */
	getOrCreateNotebookManager(providerId: string, uri: URI): Thenable<INotebookManager>;

	addNotebookEditor(editor: INotebookEditor): void;

	removeNotebookEditor(editor: INotebookEditor): void;

	listNotebookEditors(): INotebookEditor[];

	shutdown(): void;

	getMimeRegistry(): RenderMimeRegistry;

	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void;
}

export interface INotebookProvider {
	readonly providerId: string;
	getNotebookManager(notebookUri: URI): Thenable<INotebookManager>;
	handleNotebookClosed(notebookUri: URI): void;
}

export interface INotebookManager {
	providerId: string;
	readonly contentManager: sqlops.nb.ContentManager;
	readonly sessionManager: sqlops.nb.SessionManager;
	readonly serverManager: sqlops.nb.ServerManager;
}

export interface INotebookParams extends IBootstrapParams {
	notebookUri: URI;
	input: NotebookInput;
	providerId: string;
	providers: string[];
	isTrusted: boolean;
	profile?: IConnectionProfile;
	modelFactory?: ModelFactory;
	connectionProfileId?: string;
}

export interface INotebookEditor {
	readonly notebookParams: INotebookParams;
	readonly id: string;
	readonly cells?: ICellModel[];
	readonly modelReady: Promise<INotebookModel>;
	readonly model: INotebookModel | null;
	isDirty(): boolean;
	isActive(): boolean;
	isVisible(): boolean;
	save(): Promise<boolean>;
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean;
	runCell(cell: ICellModel): Promise<boolean>;
}