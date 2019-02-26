
/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

// This code is based on @jupyterlab/packages/apputils/src/clientsession.tsx

'use strict';

import { nb } from 'sqlops';
import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { INotificationService } from 'vs/platform/notification/common/notification';

import { CellType, NotebookChangeType } from 'sql/parts/notebook/models/contracts';
import { INotebookManager } from 'sql/workbench/services/notebook/common/notebookService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IStandardKernelWithProvider } from 'sql/parts/notebook/notebookUtils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export interface IClientSessionOptions {
	notebookUri: URI;
	notebookManager: INotebookManager;
	notificationService: INotificationService;
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
		options: nb.IKernelSpec
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
	 * Save the model to its backing content manager.
	 * Serializes the model and then calls through to save it
	 */
	saveModel(): Promise<boolean>;

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

	/** Event fired once we get call back from ConfigureConnection method in sqlops extension */
	readonly onValidConnectionSelected: Event<boolean>;
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
	 *
	 * @type {boolean}
	 * @memberof NotebookContentChange
	 */
	isDirty?: boolean;
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

export interface ICellModel {
	cellUri: URI;
	id: string;
	readonly language: string;
	source: string;
	cellType: CellType;
	trustedMode: boolean;
	active: boolean;
	hover: boolean;
	executionCount: number | undefined;
	readonly future: FutureInternal;
	readonly outputs: ReadonlyArray<nb.ICellOutput>;
	readonly onOutputsChanged: Event<ReadonlyArray<nb.ICellOutput>>;
	readonly onExecutionStateChange: Event<CellExecutionState>;
	setFuture(future: FutureInternal): void;
	readonly executionState: CellExecutionState;
	runCell(notificationService?: INotificationService): Promise<boolean>;
	setOverrideLanguage(language: string);
	equals(cellModel: ICellModel): boolean;
	toJSON(): nb.ICellContents;
}

export interface FutureInternal extends nb.IFuture {
	inProgress: boolean;
}

export interface IModelFactory {

	createCell(cell: nb.ICellContents, options: ICellModelOptions): ICellModel;
	createClientSession(options: IClientSessionOptions): IClientSession;
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

	notebookManagers: INotebookManager[];
	providerId: string;
	standardKernels: IStandardKernelWithProvider[];
	defaultKernel: nb.IKernelSpec;
	cellMagicMapper: ICellMagicMapper;

	layoutChanged: Event<void>;

	notificationService: INotificationService;
	connectionService: IConnectionManagementService;
	capabilitiesService: ICapabilitiesService;
}

export interface ILanguageMagic {
	magic: string;
	language: string;
	kernels?: string[];
	executionTarget?: string;
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
}