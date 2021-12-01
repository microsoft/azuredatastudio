/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { URI, UriComponents } from 'vs/base/common/uri';
import { RenderMimeRegistry } from 'sql/workbench/services/notebook/browser/outputs/registry';
import { ModelFactory } from 'sql/workbench/services/notebook/browser/models/modelFactory';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookChangeType, CellType } from 'sql/workbench/services/notebook/common/contracts';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { Range } from 'vs/editor/common/core/range';
import { IEditorPane } from 'vs/workbench/common/editor';
import { INotebookInput } from 'sql/workbench/services/notebook/browser/interface';
import { INotebookShowOptions } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';

export const SERVICE_ID = 'sqlNotebookService';
export const INotebookService = createDecorator<INotebookService>(SERVICE_ID);

export const DEFAULT_NOTEBOOK_PROVIDER = 'builtin';
export const DEFAULT_NOTEBOOK_FILETYPE = '.ipynb';
export const SQL_NOTEBOOK_PROVIDER = 'sql';
export const OVERRIDE_EDITOR_THEMING_SETTING = 'notebook.overrideEditorTheming';

export interface ILanguageMagic {
	magic: string;
	language: string;
	kernels?: string[];
	executionTarget?: string;
}

/**
*  Valid navigation providers.
*/
export enum NavigationProviders {
	NotebooksNavigator = 'BookNavigator.Notebooks',
	ProvidedBooksNavigator = 'BookNavigator.ProvidedBooks'
}

export const unsavedBooksContextKey = 'unsavedBooks';

export interface INotebookService {
	_serviceBrand: undefined;

	readonly onNotebookEditorAdd: Event<INotebookEditor>;
	readonly onNotebookEditorRemove: Event<INotebookEditor>;
	onNotebookEditorRename: Event<INotebookEditor>;

	readonly isRegistrationComplete: boolean;
	readonly registrationComplete: Promise<void>;
	readonly languageMagics: ILanguageMagic[];

	registerSerializationProvider(providerId: string, provider: ISerializationProvider): void;

	registerExecuteProvider(providerId: string, provider: IExecuteProvider): void;

	unregisterSerializationProvider(providerId: string): void;

	unregisterExecuteProvider(providerId: string): void;

	registerNavigationProvider(provider: INavigationProvider): void;

	getNavigationProvider(notebookUri: URI): INavigationProvider;

	getSupportedFileExtensions(): string[];

	getProvidersForFileType(fileType: string): string[] | undefined;

	getStandardKernelsForProvider(provider: string): azdata.nb.IStandardKernel[] | undefined;

	getOrCreateSerializationManager(providerId: string, uri: URI): Promise<ISerializationManager>;

	getOrCreateExecuteManager(providerId: string, uri: URI): Thenable<IExecuteManager>;

	addNotebookEditor(editor: INotebookEditor): void;

	removeNotebookEditor(editor: INotebookEditor): void;

	listNotebookEditors(): INotebookEditor[];

	findNotebookEditor(notebookUri: URI): INotebookEditor | undefined;

	getMimeRegistry(): RenderMimeRegistry;

	renameNotebookEditor(oldUri: URI, newUri: URI, currentEditor: INotebookEditor): void;

	/**
	 * Checks if a notebook has previously been marked as trusted, and that
	 * the notebook has not changed on disk since that time. If the notebook
	 * is currently dirty in the app, the previous trusted state will be used even
	 * if it's altered on disk since the version in our UI is based on previously trusted
	 * content.
	 * @param notebookUri the URI identifying a notebook
	 * @param isDirty is the notebook marked as dirty in by the text model trackers?
	 */
	isNotebookTrustCached(notebookUri: URI, isDirty: boolean): Promise<boolean>;
	/**
	 * Serializes an impactful Notebook state change. This will result
	 * in trusted state being serialized if needed, and notifications being
	 * sent to listeners that can act on the point-in-time notebook state
	 * @param notebookUri The URI identifying a notebook.
	 * @param changeType The type of notebook state change to serialize.
	 * @param cell (Optional) The notebook cell associated with the state change.
	 * @param isTrusted (Optional) A manual override for the notebook's trusted state.
	 */
	serializeNotebookStateChange(notebookUri: URI, changeType: NotebookChangeType, cell?: ICellModel, isTrusted?: boolean): Promise<void>;

	/**
	 *
	 * @param notebookUri URI of the notebook to navigate to
	 * @param sectionId ID of the section to navigate to
	 */
	navigateTo(notebookUri: URI, sectionId: string): void;

	/**
	 * Sets the trusted mode for the specified notebook.
	 * @param notebookUri URI of the notebook to navigate to
	 * @param isTrusted True if notebook is to be set to trusted, false otherwise.
	 */
	setTrusted(notebookUri: URI, isTrusted: boolean): Promise<boolean>;

	/**
	 * Event that gets fired when a cell is executed.
	 */
	onCodeCellExecutionStart: Event<void>;

	/**
	 * Fires the onCodeCellExecutionStart event.
	 */
	notifyCellExecutionStarted(): void;

	openNotebook(resource: UriComponents, options: INotebookShowOptions): Promise<IEditorPane | undefined>;

	getUntitledUriPath(originalTitle: string): string;
}

export interface IExecuteProvider {
	readonly providerId: string;
	getExecuteManager(notebookUri: URI): Thenable<IExecuteManager>;
	handleNotebookClosed(notebookUri: URI): void;
}

export interface ISerializationProvider {
	readonly providerId: string;
	getSerializationManager(notebookUri: URI): Thenable<ISerializationManager>;
}

export interface ISerializationManager {
	providerId: string;
	readonly contentManager: azdata.nb.ContentManager;
}

export interface IExecuteManager {
	providerId: string;
	readonly sessionManager: azdata.nb.SessionManager;
	readonly serverManager: azdata.nb.ServerManager;
}

export interface IProviderInfo {
	providerId: string;
	providers: string[];
}

export interface INotebookParams extends IBootstrapParams {
	notebookUri: URI;
	input: INotebookInput;
	providerInfo: Promise<IProviderInfo>;
	profile?: IConnectionProfile;
	modelFactory?: ModelFactory;
}

/**
 * Defines a section in a notebook as the header text for that section,
 * the relative URI that can be used to link to it inside Notebook documents
 */
export interface INotebookSection {
	header: string;
	relativeUri: string;
}

export interface ICellEditorProvider {
	hasEditor(): boolean;
	cellGuid(): string;
	getEditor(): BaseTextEditor;
	deltaDecorations(newDecorationsRange: NotebookRange | NotebookRange[], oldDecorationsRange: NotebookRange | NotebookRange[]): void;
}

export class NotebookRange extends Range {
	updateActiveCell(cell: ICellModel) {
		this.cell = cell;
	}
	cell: ICellModel;
	isMarkdownSourceCell: boolean;

	constructor(cell: ICellModel, startLineNumber: number, startColumn: number, endLineNumber: number, endColumn: number, markdownEditMode?: boolean) {
		super(startLineNumber, startColumn, endLineNumber, endColumn);
		this.updateActiveCell(cell);
		this.isMarkdownSourceCell = markdownEditMode ? markdownEditMode : false;
	}
}

export interface INotebookEditor {
	readonly notebookParams: INotebookParams;
	readonly id: string;
	readonly cells?: ICellModel[];
	readonly cellEditors: ICellEditorProvider[];
	readonly modelReady: Promise<INotebookModel>;
	readonly model: INotebookModel | null;
	readonly views: NotebookViewsExtension | null;
	isDirty(): boolean;
	isActive(): boolean;
	isVisible(): boolean;
	executeEdits(edits: ISingleNotebookEditOperation[]): boolean;
	runCell(cell: ICellModel): Promise<boolean>;
	runAllCells(startCell?: ICellModel, endCell?: ICellModel): Promise<boolean>;
	clearOutput(cell: ICellModel): Promise<boolean>;
	clearAllOutputs(): Promise<boolean>;
	getSections(): INotebookSection[];
	navigateToSection(sectionId: string): void;
	deltaDecorations(newDecorationsRange: NotebookRange | NotebookRange[], oldDecorationsRange: NotebookRange | NotebookRange[]): void;
	addCell(cellType: CellType, index?: number, event?: UIEvent);
}

export interface INavigationProvider {
	providerId: string;
	hasNavigation: boolean;
	getNavigation(uri: URI): Thenable<azdata.nb.NavigationResult>;
	onNext(uri: URI): void;
	onPrevious(uri: URI): void;
}
