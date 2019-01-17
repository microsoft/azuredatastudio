/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb, connection } from 'sqlops';

import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { Disposable } from 'vs/base/common/lifecycle';

import { CellModel } from './cell';
import { IClientSession, INotebookModel, IDefaultConnection, INotebookModelOptions, ICellModel, notebookConstants, NotebookContentChange } from './modelInterfaces';
import { NotebookChangeType, CellType } from 'sql/parts/notebook/models/contracts';
import { nbversion } from '../notebookConstants';
import * as notebookUtils from '../notebookUtils';
import { INotebookManager, SQL_NOTEBOOK_PROVIDER, DEFAULT_NOTEBOOK_PROVIDER } from 'sql/services/notebook/notebookService';
import { SparkMagicContexts } from 'sql/parts/notebook/models/sparkMagicContexts';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { NotebookConnection } from 'sql/parts/notebook/models/notebookConnection';
import { INotification, Severity } from 'vs/platform/notification/common/notification';
import { Schemas } from 'vs/base/common/network';
import URI from 'vs/base/common/uri';
import { ISingleNotebookEditOperation } from 'sql/workbench/api/common/sqlExtHostTypes';

/*
* Used to control whether a message in a dialog/wizard is displayed as an error,
* warning, or informational message. Default is error.
*/
export enum MessageLevel {
	Error = 0,
	Warning = 1,
	Information = 2
}

export class ErrorInfo {
	constructor(public readonly message: string, public readonly severity: MessageLevel) {
	}
}

export class NotebookModel extends Disposable implements INotebookModel {
	private _contextsChangedEmitter = new Emitter<void>();
	private _contentChangedEmitter = new Emitter<NotebookContentChange>();
	private _kernelsChangedEmitter = new Emitter<nb.IKernelSpec>();
	private _inErrorState: boolean = false;
	private _clientSessions: IClientSession[] = [];
	private _activeClientSession: IClientSession;
	private _sessionLoadFinished: Promise<void>;
	private _onClientSessionReady = new Emitter<IClientSession>();
	private _activeContexts: IDefaultConnection;
	private _trustedMode: boolean;

	private _cells: ICellModel[];
	private _defaultLanguageInfo: nb.ILanguageInfo;
	private onErrorEmitter = new Emitter<INotification>();
	private _savedKernelInfo: nb.IKernelInfo;
	private readonly _nbformat: number = nbversion.MAJOR_VERSION;
	private readonly _nbformatMinor: number = nbversion.MINOR_VERSION;
	private _hadoopConnection: NotebookConnection;
	private _defaultKernel: nb.IKernelSpec;
	private _activeCell: ICellModel;
	private _providerId: string;
	private _isNewNotebook: boolean = true;

	constructor(private notebookOptions: INotebookModelOptions, startSessionImmediately?: boolean, private connectionProfile?: IConnectionProfile) {
		super();
		if (!notebookOptions || !notebookOptions.notebookUri || !notebookOptions.notebookManagers) {
			throw new Error('path or notebook service not defined');
		}
		if (startSessionImmediately) {
			this.backgroundStartSession();
		}
		this._trustedMode = false;
		this._providerId = notebookOptions.providerId;
	}

	public get notebookManagers(): INotebookManager[] {
		let notebookManagers = this.notebookOptions.notebookManagers.filter(manager => manager.providerId !== DEFAULT_NOTEBOOK_PROVIDER);
		if (!notebookManagers.length) {
			return this.notebookOptions.notebookManagers;
		}
		return notebookManagers;
	}

	public get notebookManager(): INotebookManager {
		return this.notebookManagers.find(manager => manager.providerId === this._providerId);
	}

	public get notebookUri(): URI {
		return this.notebookOptions.notebookUri;
	}
	public set notebookUri(value: URI) {
		this.notebookOptions.notebookUri = value;
	}

	public get hasServerManager(): boolean {
		// If the service has a server manager, then we can show the start button
		return !!this.notebookManager.serverManager;
	}

	public get contentChanged(): Event<NotebookContentChange> {
		return this._contentChangedEmitter.event;
	}

	public get isSessionReady(): boolean {
		return !!this._activeClientSession;
	}

	/**
	 * ClientSession object which handles management of a session instance,
	 * plus startup of the session manager which can return key metadata about the
	 * notebook environment
	 */
	public get clientSession(): IClientSession {
		return this._activeClientSession;
	}

	public get kernelChanged(): Event<nb.IKernelChangedArgs> {
		return this._activeClientSession.kernelChanged;
	}

	public get kernelsChanged(): Event<nb.IKernelSpec> {
		return this._kernelsChangedEmitter.event;
	}

	public get defaultKernel(): nb.IKernelSpec {
		return this._defaultKernel;
	}

	public get contextsChanged(): Event<void> {
		return this._contextsChangedEmitter.event;
	}

	public get cells(): ICellModel[] {
		return this._cells;
	}

	public get contexts(): IDefaultConnection {
		return this._activeContexts;
	}

	public get specs(): nb.IAllKernels | undefined {
		let specs: nb.IAllKernels = {
			defaultKernel: undefined,
			kernels: []
		};
		this.notebookManagers.forEach(manager => {
			if (manager.sessionManager && manager.sessionManager.specs && manager.sessionManager.specs.kernels) {
				manager.sessionManager.specs.kernels.forEach(kernel => {
					specs.kernels.push(kernel);
				});
				if (!specs.defaultKernel) {
					specs.defaultKernel = manager.sessionManager.specs.defaultKernel;
				}
			}
		});
		return specs;
	}

	public get inErrorState(): boolean {
		return this._inErrorState;
	}

	public get onError(): Event<INotification> {
		return this.onErrorEmitter.event;
	}

	public get trustedMode(): boolean {
		return this._trustedMode;
	}

	public get isNewNotebook(): boolean {
		return this._isNewNotebook;
	}

	public get providerId(): string {
		return this._providerId;
	}

	public set trustedMode(isTrusted: boolean) {
		this._trustedMode = isTrusted;
		if (this._cells) {
			this._cells.forEach(c => {
				c.trustedMode = this._trustedMode;
			});
		}
	}

	public get hadoopConnection(): NotebookConnection {
		return this._hadoopConnection;
	}

	/**
	 * Indicates the server has finished loading. It may have failed to load in
	 * which case the view will be in an error state.
	 */
	public get sessionLoadFinished(): Promise<void> {
		return this._sessionLoadFinished;
	}

	/**
	 * Notifies when the client session is ready for use
	 */
	public get onClientSessionReady(): Event<IClientSession> {
		return this._onClientSessionReady.event;
	}

	public async requestModelLoad(isTrusted: boolean = false): Promise<void> {
		try {
			this._trustedMode = isTrusted;
			let contents = null;
			if (this.notebookOptions.notebookUri.scheme !== Schemas.untitled) {
				// TODO: separate ContentManager from NotebookManager
				contents = await this.notebookManagers[0].contentManager.getNotebookContents(this.notebookOptions.notebookUri);
			}
			let factory = this.notebookOptions.factory;
			// if cells already exist, create them with language info (if it is saved)
			this._cells = [];
			this._defaultLanguageInfo = {
				name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
				version: ''
			};
			if (contents) {
				this._isNewNotebook = false;
				this._defaultLanguageInfo = this.getDefaultLanguageInfo(contents);
				this._savedKernelInfo = this.getSavedKernelInfo(contents);
				if (contents.cells && contents.cells.length > 0) {
					this._cells = contents.cells.map(c => factory.createCell(c, { notebook: this, isTrusted: isTrusted }));
				}
			}
		} catch (error) {
			this._inErrorState = true;
			throw error;
		}
	}

	public findCellIndex(cellModel: CellModel): number {
		return this._cells.findIndex((cell) => cell.equals(cellModel));
	}

	public addCell(cellType: CellType, index?: number): ICellModel {
		if (this.inErrorState) {
			return null;
		}
		let cell = this.createCell(cellType);

		if (index !== undefined && index !== null && index >= 0 && index < this._cells.length) {
			this._cells.splice(index, 0, cell);
		} else {
			this._cells.push(cell);
			index = undefined;
		}
		// Set newly created cell as active cell
		if (this._activeCell) {
			this._activeCell.active = false;
		}
		this._activeCell = cell;
		this._activeCell.active = true;

		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.CellsAdded,
			cells: [cell],
			cellIndex: index
		});

		return cell;
	}

	private createCell(cellType: CellType): ICellModel {
		let singleCell: nb.ICellContents = {
			cell_type: cellType,
			source: '',
			metadata: {},
			execution_count: 1
		};
		return this.notebookOptions.factory.createCell(singleCell, { notebook: this, isTrusted: true });
	}

	deleteCell(cellModel: ICellModel): void {
		if (this.inErrorState || !this._cells) {
			return;
		}
		let index = this._cells.findIndex((cell) => cell.equals(cellModel));
		if (index > -1) {
			this._cells.splice(index, 1);
			this._contentChangedEmitter.fire({
				changeType: NotebookChangeType.CellDeleted,
				cells: [cellModel],
				cellIndex: index
			});
		} else {
			this.notifyError(localize('deleteCellFailed', 'Failed to delete cell.'));
		}
	}

	pushEditOperations(edits: ISingleNotebookEditOperation[]): void {
		if (this.inErrorState || !this._cells) {
			return;
		}

		for (let edit of edits) {
			let newCells: ICellModel[] = [];
			if (edit.cell) {
				// TODO: should we validate and complete required missing parameters?
				let contents: nb.ICellContents = edit.cell as nb.ICellContents;
				newCells.push(this.notebookOptions.factory.createCell(contents, { notebook: this, isTrusted: this._trustedMode }));
			}
			this._cells.splice(edit.range.start, edit.range.end - edit.range.start, ...newCells);
			this._contentChangedEmitter.fire({
				changeType: NotebookChangeType.CellsAdded
			});
		}
	}

	public get activeCell(): ICellModel {
		return this._activeCell;
	}

	public set activeCell(value: ICellModel) {
		this._activeCell = value;
	}

	private notifyError(error: string): void {
		this.onErrorEmitter.fire({ message: error, severity: Severity.Error });
	}

	public backgroundStartSession(): void {
		// TODO: only one session should be active at a time, depending on the current provider
		this.notebookManagers.forEach(manager => {
			let clientSession = this.notebookOptions.factory.createClientSession({
				notebookUri: this.notebookOptions.notebookUri,
				notebookManager: manager,
				notificationService: this.notebookOptions.notificationService
			});
			this._clientSessions.push(clientSession);
			if (!this._activeClientSession) {
				this._activeClientSession = clientSession;
			}
			let profile = this.connectionProfile as IConnectionProfile;

			if (this.isValidKnoxConnection(profile)) {
				this._hadoopConnection = new NotebookConnection(this.connectionProfile);
			} else {
				this._hadoopConnection = undefined;
			}

			clientSession.initialize(this._hadoopConnection);
			this._sessionLoadFinished = clientSession.ready.then(async () => {
				if (clientSession.isInErrorState) {
					this.setErrorState(clientSession.errorMessage);
				} else {
					this._onClientSessionReady.fire(clientSession);
					// Once session is loaded, can use the session manager to retrieve useful info
					this.loadKernelInfo();
					await this.loadActiveContexts(undefined);
				}
			});
		});
	}

	private isValidKnoxConnection(profile: IConnectionProfile | connection.Connection) {
		return profile && profile.providerName === notebookConstants.hadoopKnoxProviderName && profile.options[notebookConstants.hostPropName] !== undefined;
	}

	public get languageInfo(): nb.ILanguageInfo {
		return this._defaultLanguageInfo;
	}

	private updateLanguageInfo(info: nb.ILanguageInfo) {
		if (info) {
			this._defaultLanguageInfo = info;
		}
	}

	public changeKernel(displayName: string): void {
		let spec = this.getSpecNameFromDisplayName(displayName);
		this.doChangeKernel(spec);
	}

	public doChangeKernel(kernelSpec: nb.IKernelSpec): Promise<void> {
		this.findProviderIdForKernel(kernelSpec);
		return this._activeClientSession.changeKernel(kernelSpec)
			.then((kernel) => {
				kernel.ready.then(() => {
					if (kernel.info) {
						this.updateLanguageInfo(kernel.info.language_info);
					}
				}, err => undefined);
				return this.updateKernelInfo(kernel);
			}).catch((err) => {
				this.notifyError(localize('changeKernelFailed', 'Failed to change kernel: {0}', notebookUtils.getErrorMessage(err)));
				// TODO should revert kernels dropdown
			});
	}

	public changeContext(host: string, newConnection?: IConnectionProfile): void {
		try {
			if (!newConnection) {
				newConnection = this._activeContexts.otherConnections.find((connection) => connection.options['host'] === host);
			}
			if (!newConnection && this._activeContexts.defaultConnection.options['host'] === host) {
				newConnection = this._activeContexts.defaultConnection;
			}
			SparkMagicContexts.configureContext();
			this._hadoopConnection = new NotebookConnection(newConnection);
			this.refreshConnections(newConnection);
			this._activeClientSession.updateConnection(this._hadoopConnection);
		} catch (err) {
			let msg = notebookUtils.getErrorMessage(err);
			this.notifyError(localize('changeContextFailed', 'Changing context failed: {0}', msg));
		}
	}

	private refreshConnections(newConnection: IConnectionProfile) {
		if (this.isValidKnoxConnection(newConnection) &&
			this._hadoopConnection.connectionProfile.id !== '-1' &&
			this._hadoopConnection.connectionProfile.id !== this._activeContexts.defaultConnection.id) {
			// Put the defaultConnection to the head of otherConnections
			if (this.isValidKnoxConnection(this._activeContexts.defaultConnection)) {
				this._activeContexts.otherConnections = this._activeContexts.otherConnections.filter(conn => conn.id !== this._activeContexts.defaultConnection.id);
				this._activeContexts.otherConnections.unshift(this._activeContexts.defaultConnection);
			}
			// Change the defaultConnection to newConnection
			this._activeContexts.defaultConnection = newConnection;
		}
	}

	private loadKernelInfo(): void {
		this._clientSessions.forEach(clientSession => {
			clientSession.kernelChanged(async (e) => {
				await this.loadActiveContexts(e);
			});
		});
		if (!this.notebookManager) {
			return;
		}
		try {
			let sessionManager = this.notebookManager.sessionManager;
			if (sessionManager) {
				let defaultKernel = SparkMagicContexts.getDefaultKernel(sessionManager.specs, this.connectionProfile, this._savedKernelInfo, this.notebookOptions.notificationService);
				this._defaultKernel = defaultKernel;
				this._clientSessions.forEach(clientSession => {
					clientSession.statusChanged(async (session) => {
						if (session && session.defaultKernelLoaded === true) {
							this._kernelsChangedEmitter.fire(defaultKernel);
						} else if (session && !session.defaultKernelLoaded) {
							this._kernelsChangedEmitter.fire({ name: notebookConstants.python3, display_name: notebookConstants.python3DisplayName });
						}
					});
				});
				this.doChangeKernel(defaultKernel);
			}
		} catch (err) {
			let msg = notebookUtils.getErrorMessage(err);
			this.notifyError(localize('loadKernelFailed', 'Loading kernel info failed: {0}', msg));
		}
	}

	// Get default language if saved in notebook file
	// Otherwise, default to python
	private getDefaultLanguageInfo(notebook: nb.INotebookContents): nb.ILanguageInfo {
		return notebook!.metadata!.language_info || {
			name: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'sql' : 'python',
			version: '',
			mimetype: this._providerId === SQL_NOTEBOOK_PROVIDER ? 'x-sql' : 'x-python'
		};
	}

	// Get default kernel info if saved in notebook file
	private getSavedKernelInfo(notebook: nb.INotebookContents): nb.IKernelInfo {
		return notebook!.metadata!.kernelspec;
	}

	private getSpecNameFromDisplayName(displayName: string): nb.IKernelSpec {
		displayName = this.sanitizeDisplayName(displayName);
		let kernel: nb.IKernelSpec = this.specs.kernels.find(k => k.display_name.toLowerCase() === displayName.toLowerCase());
		if (!kernel) {
			return undefined; // undefined is handled gracefully in the session to default to the default kernel
		} else if (!kernel.name) {
			kernel.name = this.specs.defaultKernel;
		}
		return kernel;
	}

	private setErrorState(errMsg: string): void {
		this._inErrorState = true;
		let msg = localize('startSessionFailed', 'Could not start session: {0}', errMsg);
		this.notifyError(msg);

	}

	public dispose(): void {
		super.dispose();
		this.handleClosed();
	}

	public async handleClosed(): Promise<void> {
		try {
			if (this._activeClientSession) {
				await this._activeClientSession.shutdown();
				this._clientSessions = undefined;
				this._activeClientSession = undefined;
			}
		} catch (err) {
			this.notifyError(localize('shutdownError', 'An error occurred when closing the notebook: {0}', err));
		}
	}

	private async loadActiveContexts(kernelChangedArgs: nb.IKernelChangedArgs): Promise<void> {
		this._activeContexts = await SparkMagicContexts.getContextsForKernel(this.notebookOptions.connectionService, kernelChangedArgs, this.connectionProfile);
		this._contextsChangedEmitter.fire();
		if (this.contexts.defaultConnection !== undefined && this.contexts.defaultConnection.options !== undefined) {
			let defaultHadoopConnection = new NotebookConnection(this.contexts.defaultConnection);
			this.changeContext(defaultHadoopConnection.host);
		}
	}

	/**
	 * Sanitizes display name to remove IP address in order to fairly compare kernels
	 * In some notebooks, display name is in the format <kernel> (<ip address>)
	 * example: PySpark (25.23.32.4)
	 * @param displayName Display Name for the kernel
	 */
	public sanitizeDisplayName(displayName: string): string {
		let name = displayName;
		if (name) {
			let index = name.indexOf('(');
			name = (index > -1) ? name.substr(0, index - 1).trim() : name;
		}
		return name;
	}

	public async saveModel(): Promise<boolean> {
		let notebook = this.toJSON();
		if (!notebook) {
			return false;
		}
		// TODO: refactor ContentManager out from NotebookManager
		await this.notebookManagers[0].contentManager.save(this.notebookOptions.notebookUri, notebook);
		this._contentChangedEmitter.fire({
			changeType: NotebookChangeType.DirtyStateChanged,
			isDirty: false
		});
		return true;
	}

	private async updateKernelInfo(kernel: nb.IKernel): Promise<void> {
		if (kernel) {
			try {
				let spec = await kernel.getSpec();
				this._savedKernelInfo = {
					name: kernel.name,
					display_name: spec.display_name,
					language: spec.language
				};
			} catch (err) {
				// Don't worry about this for now. Just use saved values
			}
		}
	}

	/**
	 * Set _providerId and _activeClientSession based on a kernelSpec representing new kernel
	 * @param kernelSpec KernelSpec for new kernel
	 */
	private findProviderIdForKernel(kernelSpec: nb.IKernelSpec): void {
		for (let i = 0; i < this.notebookManagers.length; i++) {
			if (this.notebookManagers[i].sessionManager && this.notebookManagers[i].sessionManager.specs && this.notebookManagers[i].sessionManager.specs.kernels) {
				let index = this.notebookManagers[i].sessionManager.specs.kernels.findIndex(kernel => kernel.name === kernelSpec.name);
				if (index >= 0) {
					this._activeClientSession = this._clientSessions[i];
					this._providerId = this.notebookManagers[i].providerId;
					break;
				}
			}
		}
	}
	/**
	 * Serialize the model to JSON.
	 */
	toJSON(): nb.INotebookContents {
		let cells: nb.ICellContents[] = this.cells.map(c => c.toJSON());
		let metadata = Object.create(null) as nb.INotebookMetadata;
		// TODO update language and kernel when these change
		metadata.kernelspec = this._savedKernelInfo;
		metadata.language_info = this.languageInfo;
		return {
			metadata,
			nbformat_minor: this._nbformatMinor,
			nbformat: this._nbformat,
			cells
		};
	}

	onCellChange(cell: CellModel, change: NotebookChangeType): void {
		let changeInfo: NotebookContentChange = {
			changeType: change,
			cells: [cell]
		};
		switch (change) {
			case NotebookChangeType.CellOutputUpdated:
			case NotebookChangeType.CellSourceUpdated:
				changeInfo.changeType = NotebookChangeType.DirtyStateChanged;
				changeInfo.isDirty = true;
				break;
			default:
			// Do nothing for now
		}
		this._contentChangedEmitter.fire(changeInfo);
	}

}
