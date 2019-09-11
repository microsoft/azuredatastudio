/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This code is based on @jupyterlab/packages/apputils/src/clientsession.tsx

import { nb } from 'azdata';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { INotificationService } from 'vs/platform/notification/common/notification';

import { CellType, NotebookChangeType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { INotebookManager, ILanguageMagic } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IStandardKernelWithProvider } from 'sql/workbench/parts/notebook/browser/models/notebookUtils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { localize } from 'vs/nls';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IModelContentChangedEvent } from 'vs/editor/common/model/textModelEvents';

export interface IClientSessionOptions {
	notebookUri: URI;
	notebookManager: INotebookManager;
	notificationService: INotificationService;
	kernelSpec: nb.IKernelSpec;
}

/**
 * The interface of client session object.
 *
 * The client session represents the link between
 * a path and its kernel for the duration of the lifetime
 * of the session object.  The session can have no current
 * kernel, and can start a new kernel at any time.
 */
export interface IClientSession extends IDisposable {
	/**
	 * A signal emitted when the session is shut down.
	 */
	readonly terminated: Event<void>;

	/**
	 * A signal emitted when the kernel changes.
	 */
	readonly kernelChanged: Event<nb.IKernelChangedArgs>;

	/**
	 * A signal emitted when the kernel status changes.
	 */
	readonly statusChanged: Event<nb.ISession>;

	/**
	 * A signal emitted for a kernel messages.
	 */
	readonly iopubMessage: Event<nb.IMessage>;

	/**
	 * A signal emitted for an unhandled kernel message.
	 */
	readonly unhandledMessage: Event<nb.IMessage>;

	/**
	 * A signal emitted when a session property changes.
	 */
	readonly propertyChanged: Event<'path' | 'name' | 'type'>;

	/**
	 * The current kernel associated with the document.
	 */
	readonly kernel: nb.IKernel | null;

	/**
	 * The current path associated with the client session.
	 */
	readonly notebookUri: URI;

	/**
	 * The current name associated with the client session.
	 */
	readonly name: string;

	/**
	 * The type of the client session.
	 */
	readonly type: string;

	/**
	 * The current status of the client session.
	 */
	readonly status: nb.KernelStatus;

	/**
	 * Whether the session is ready.
	 */
	readonly isReady: boolean;

	/**
	 * Whether the session is in an unusable state
	 */
	readonly isInErrorState: boolean;
	/**
	 * The error information, if this session is in an error state
	 */
	readonly errorMessage: string;

	/**
	 * A promise that is fulfilled when the session is ready.
	 */
	readonly ready: Promise<void>;

	/**
	 * A promise that is fulfilled when the session completes a kernel change.
	 */
	readonly kernelChangeCompleted: Promise<void>;

	/**
	 * The kernel preference.
	 */
	kernelPreference: IKernelPreference;

	/**
	 * The display name of the kernel.
	 */
	readonly kernelDisplayName: string;

	readonly cachedKernelSpec: nb.IKernelSpec;

	/**
	 * Initializes the ClientSession, by starting the server and
	 * connecting to the SessionManager.
	 * This will optionally start a session if the kernel preferences
	 * indicate this is desired
	 */
	initialize(): Promise<void>;

	/**
	 * Change the current kernel associated with the document.
	 */
	changeKernel(
		options: nb.IKernelSpec,
		oldKernel?: nb.IKernel
	): Promise<nb.IKernel>;

	/**
	 * Configure the current kernel associated with the document.
	 */
	configureKernel(
		options: nb.IKernelSpec
	): Promise<void>;

	/**
	 * Kill the kernel and shutdown the session.
	 *
	 * @returns A promise that resolves when the session is shut down.
	 */
	shutdown(): Promise<void>;

	/**
	 * Select a kernel for the session.
	 */
	selectKernel(): Promise<void>;

	/**
	 * Restart the session.
	 *
	 * @returns A promise that resolves with whether the kernel has restarted.
	 *
	 * #### Notes
	 * If there is a running kernel, present a dialog.
	 * If there is no kernel, we start a kernel with the last run
	 * kernel name and resolves with `true`. If no kernel has been started,
	 * this is a no-op, and resolves with `false`.
	 */
	restart(): Promise<boolean>;

	/**
	 * Change the session path.
	 *
	 * @param path - The new session path.
	 *
	 * @returns A promise that resolves when the session has renamed.
	 *
	 * #### Notes
	 * This uses the Jupyter REST API, and the response is validated.
	 * The promise is fulfilled on a valid response and rejected otherwise.
	 */
	setPath(path: string): Promise<void>;

	/**
	 * Change the session name.
	 */
	setName(name: string): Promise<void>;

	/**
	 * Change the session type.
	 */
	setType(type: string): Promise<void>;

	/**
	 * Updates the connection
	 */
	updateConnection(connection: IConnectionProfile): Promise<void>;

	/**
	 * Supports registering a handler to run during kernel change and implement any calls needed to configure
	 * the kernel before actions such as run should be allowed
	 */
	onKernelChanging(changeHandler: ((kernel: nb.IKernelChangedArgs) => Promise<void>)): void;
}

export interface IDefaultConnection {
	defaultConnection: ConnectionProfile;
	otherConnections: ConnectionProfile[];
}

/**
 * A kernel preference.
 */
export interface IKernelPreference {
	/**
	 * The name of the kernel.
	 */
	readonly name?: string;

	/**
	 * The preferred kernel language.
	 */
	readonly language?: string;

	/**
	 * The id of an existing kernel.
	 */
	readonly id?: string;

	/**
	 * Whether to prefer starting a kernel.
	 */
	readonly shouldStart?: boolean;

	/**
	 * Whether a kernel can be started.
	 */
	readonly canStart?: boolean;

	/**
	 * Whether to auto-start the default kernel if no matching kernel is found.
	 */
	readonly autoStartDefault?: boolean;
}

export interface INotebookModel {
	/**
	 * Cell List for this model
	 */
	readonly cells: ReadonlyArray<ICellModel>;

	/**
	 * The active cell for this model. May be undefined
	 */
	readonly activeCell: ICellModel;

	/**
	 * Client Session in the notebook, used for sending requests to the notebook service
	 */
	readonly clientSession: IClientSession;
	/**
	 * LanguageInfo saved in the notebook
	 */
	readonly languageInfo: nb.ILanguageInfo;
	/**
	 * Current default language for the notebook
	 */
	readonly language: string;

	/**
	 * All notebook managers applicable for a given notebook
	 */
	readonly notebookManagers: INotebookManager[];

	/**
	 * Event fired on first initialization of the kernel and
	 * on subsequent change events
	 */
	readonly kernelChanged: Event<nb.IKernelChangedArgs>;

	/**
	 * Fired on notifications that notebook components should be re-laid out.
	 */
	readonly layoutChanged: Event<void>;

	/**
	 * Event fired on first initialization of the kernels and
	 * on subsequent change events
	 */
	readonly kernelsChanged: Event<nb.IKernelSpec>;

	/**
	 * Default kernel
	 */
	defaultKernel?: nb.IKernelSpec;

	/**
	 * Event fired on first initialization of the contexts and
	 * on subsequent change events
	 */
	readonly contextsChanged: Event<void>;

	/**
	 * Event fired on when switching kernel and should show loading context
	 */
	readonly contextsLoading: Event<void>;

	/**
	 * The specs for available kernels, or undefined if these have
	 * not been loaded yet
	 */
	readonly specs: nb.IAllKernels | undefined;

	/**
	 * The specs for available contexts, or undefined if these have
	 * not been loaded yet
	 */
	readonly contexts: IDefaultConnection | undefined;

	/**
	 * Event fired on first initialization of the cells and
	 * on subsequent change events
	 */
	readonly contentChanged: Event<NotebookContentChange>;

	/**
	 * Event fired on notebook provider change
	 */
	readonly onProviderIdChange: Event<string>;

	/**
	 * Event fired on active cell change
	 */
	readonly onActiveCellChanged: Event<ICellModel>;

	/**
	 * The trusted mode of the Notebook
	 */
	trustedMode: boolean;

	/**
	 * Current notebook provider id
	 */
	providerId: string;

	/**
	 * Change the current kernel from the Kernel dropdown
	 * @param displayName kernel name (as displayed in Kernel dropdown)
	 */
	changeKernel(displayName: string): void;

	/**
	 * Change the current context (if applicable)
	 */
	changeContext(host: string, connection?: IConnectionProfile, hideErrorMessage?: boolean): Promise<void>;

	/**
	 * Find a cell's index given its model
	 */
	findCellIndex(cellModel: ICellModel): number;

	/**
	 * Adds a cell to the index of the model
	 */
	addCell(cellType: CellType, index?: number): void;

	/**
	 * Deletes a cell
	 */
	deleteCell(cellModel: ICellModel): void;

	/**
	 * Serialize notebook cell content to JSON
	 */
	toJSON(type?: NotebookChangeType): nb.INotebookContents;

	/**
	 * Notifies the notebook of a change in the cell
	 */
	onCellChange(cell: ICellModel, change: NotebookChangeType): void;


	/**
	 * Push edit operations, basically editing the model. This is the preferred way of
	 * editing the model. Long-term, this will ensure edit operations can be added to the undo stack
	 * @param edits The edit operations to perform
	 */
	pushEditOperations(edits: ISingleNotebookEditOperation[]): void;

	getApplicableConnectionProviderIds(kernelName: string): string[];

	/**
	 * Get the standardKernelWithProvider by name
	 * @param name The kernel name
	 */
	getStandardKernelFromName(name: string): IStandardKernelWithProvider;

	/** Event fired once we get call back from ConfigureConnection method in sqlops extension */
	readonly onValidConnectionSelected: Event<boolean>;

	serializationStateChanged(changeType: NotebookChangeType, cell?: ICellModel): void;

	standardKernels: IStandardKernelWithProvider[];

	/**
	 * Updates the model's view of an active cell to the new active cell
	 * @param cell New active cell
	 */
	updateActiveCell(cell: ICellModel);
}

export interface NotebookContentChange {
	/**
	 * The type of change that occurred
	 */
	changeType: NotebookChangeType;
	/**
	 * Optional cells that were changed
	 */
	cells?: ICellModel | ICellModel[];
	/**
	 * Optional index of the change, indicating the cell at which an insert or
	 * delete occurred
	 */
	cellIndex?: number;
	/**
	 * Optional value indicating if the notebook is in a dirty or clean state after this change
	 */
	isDirty?: boolean;

	/**
	 * Text content changed event for cell edits
	 */
	modelContentChangedEvent?: IModelContentChangedEvent;
}

export interface ICellModelOptions {
	notebook: INotebookModel;
	isTrusted: boolean;
}

export enum CellExecutionState {
	Hidden = 0,
	Stopped = 1,
	Running = 2,
	Error = 3
}

export interface IOutputChangedEvent {
	outputs: ReadonlyArray<nb.ICellOutput>;
	shouldScroll: boolean;
}

export interface ICellModel {
	cellUri: URI;
	id: string;
	readonly language: string;
	readonly cellGuid: string;
	source: string | string[];
	cellType: CellType;
	trustedMode: boolean;
	active: boolean;
	hover: boolean;
	executionCount: number | undefined;
	readonly future: FutureInternal;
	readonly outputs: ReadonlyArray<nb.ICellOutput>;
	readonly onOutputsChanged: Event<IOutputChangedEvent>;
	readonly onExecutionStateChange: Event<CellExecutionState>;
	readonly executionState: CellExecutionState;
	readonly notebookModel: NotebookModel;
	setFuture(future: FutureInternal): void;
	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void;
	runCell(notificationService?: INotificationService, connectionManagementService?: IConnectionManagementService): Promise<boolean>;
	setOverrideLanguage(language: string);
	equals(cellModel: ICellModel): boolean;
	toJSON(): nb.ICellContents;
	loaded: boolean;
	stdInVisible: boolean;
	readonly onLoaded: Event<string>;
	modelContentChangedEvent: IModelContentChangedEvent;
}

export interface FutureInternal extends nb.IFuture {
	inProgress: boolean;
}

export interface IModelFactory {

	createCell(cell: nb.ICellContents, options: ICellModelOptions): ICellModel;
	createClientSession(options: IClientSessionOptions): IClientSession;
}

export interface IContentManager {
	/**
	 * This is a specialized method intended to load for a default context - just the current Notebook's URI
	 */
	loadContent(): Promise<nb.INotebookContents>;
}

export interface INotebookModelOptions {
	/**
	 * Path to the local or remote notebook
	 */
	notebookUri: URI;

	/**
	 * Factory for creating cells and client sessions
	 */
	factory: IModelFactory;

	contentManager: IContentManager;
	notebookManagers: INotebookManager[];
	providerId: string;
	defaultKernel: nb.IKernelSpec;
	cellMagicMapper: ICellMagicMapper;

	layoutChanged: Event<void>;

	notificationService: INotificationService;
	connectionService: IConnectionManagementService;
	capabilitiesService: ICapabilitiesService;
	editorLoadedTimestamp?: number;
}

export interface ICellMagicMapper {
	/**
	 * Tries to find a language mapping for an identified cell magic
	 * @param magic a string defining magic. For example for %%sql the magic text is sql
	 * @param kernelId the name of the current kernel to use when looking up magics
	 */
	toLanguageMagic(magic: string, kernelId: string): ILanguageMagic | undefined;
}

export namespace notebookConstants {
	export const SQL = 'SQL';
	export const SQL_CONNECTION_PROVIDER = mssqlProviderName;
	export const sqlKernel: string = localize('sqlKernel', "SQL");
	export const sqlKernelSpec: nb.IKernelSpec = ({
		name: sqlKernel,
		language: 'sql',
		display_name: sqlKernel
	});
}

export interface INotebookContentsEditable {
	cells: nb.ICellContents[];
	metadata: nb.INotebookMetadata;
	nbformat: number;
	nbformat_minor: number;
}
