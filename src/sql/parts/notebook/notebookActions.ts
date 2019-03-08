/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { INotificationService, Severity, INotificationActions } from 'vs/platform/notification/common/notification';

import { SelectBox, ISelectBoxOptionsWithLabel } from 'sql/base/browser/ui/selectBox/selectBox';
import { INotebookModel, IDefaultConnection } from 'sql/parts/notebook/models/modelInterfaces';
import { CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookComponent } from 'sql/parts/notebook/notebook.component';
import { getErrorMessage, formatServerNameWithDatabaseNameForAttachTo, getServerFromFormattedAttachToName, getDatabaseFromFormattedAttachToName } from 'sql/parts/notebook/notebookUtils';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { noKernel } from 'sql/workbench/services/notebook/common/sessionManager';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';

const msgLoading = localize('loading', 'Loading kernels...');
const kernelLabel: string = localize('Kernel', 'Kernel: ');
const attachToLabel: string = localize('AttachTo', 'Attach to: ');
const msgLoadingContexts = localize('loadingContexts', 'Loading contexts...');
const msgAddNewConnection = localize('addNewConnection', 'Add new connection');
const msgSelectConnection = localize('selectConnection', 'Select connection');
const msgLocalHost = localize('localhost', 'localhost');
const HIDE_ICON_CLASS = ' hideIcon';

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.addCell(this.cellType);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class SaveNotebookAction extends Action {
	private static readonly notebookSavedMsg = localize('notebookSavedMsg', 'Notebook saved successfully.');
	private static readonly notebookFailedSaveMsg = localize('notebookFailedSaveMsg', 'Failed to save Notebook.');
	constructor(
		id: string, label: string, cssClass: string,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, label, cssClass);
	}

	public async run(context: NotebookComponent): TPromise<boolean> {
		const actions: INotificationActions = { primary: [] };
		let saved = await context.save();
		if (saved) {
			this._notificationService.notify({ severity: Severity.Info, message: SaveNotebookAction.notebookSavedMsg, actions });
		}
		return saved;
	}
}

export interface IToggleableState {
	baseClass?: string;
	shouldToggleTooltip?: boolean;
	toggleOnClass: string;
	toggleOnLabel: string;
	toggleOffLabel: string;
	toggleOffClass: string;
	isOn: boolean;
}

export abstract class ToggleableAction extends Action {

	constructor(id: string, protected state: IToggleableState) {
		super(id, '');
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon() {
		if (this.state.shouldToggleTooltip) {
			this.tooltip = this.state.isOn ? this.state.toggleOnLabel : this.state.toggleOffLabel;
		} else {
			this.label = this.state.isOn ? this.state.toggleOnLabel : this.state.toggleOffLabel;
		}
		let classes = this.state.baseClass ? `${this.state.baseClass} ` : '';
		classes += this.state.isOn ? this.state.toggleOnClass : this.state.toggleOffClass;
		this.class = classes;
	}

	protected toggle(isOn: boolean): void {
		this.state.isOn = isOn;
		this.updateLabelAndIcon();
	}
}


export interface IActionStateData {
	className?: string;
	label?: string;
	tooltip?: string;
	hideIcon?: boolean;
}

export class IMultiStateData<T> {
	private _stateMap = new Map<T, IActionStateData>();
	constructor(mappings: { key: T, value: IActionStateData }[], private _state: T, private _baseClass?: string) {
		if (mappings) {
			mappings.forEach(s => this._stateMap.set(s.key, s.value));
		}
	}

	public set state(value: T) {
		if (!this._stateMap.has(value)) {
			throw new Error('State value must be in stateMap');
		}
		this._state = value;
	}

	public updateStateData(state: T, updater: (data: IActionStateData) => void): void {
		let data = this._stateMap.get(state);
		if (data) {
			updater(data);
		}
	}

	public get classes(): string {
		let classVal = this.getStateValueOrDefault<string>((data) => data.className, '');
		let classes = this._baseClass ? `${this._baseClass} ` : '';
		classes += classVal;
		if (this.getStateValueOrDefault<boolean>((data) => data.hideIcon, false)) {
			classes += HIDE_ICON_CLASS;
		}
		return classes;
	}

	public get label(): string {
		return this.getStateValueOrDefault<string>((data) => data.label, '');
	}

	public get tooltip(): string {
		return this.getStateValueOrDefault<string>((data) => data.tooltip, '');
	}

	private getStateValueOrDefault<U>(getter: (data: IActionStateData) => U, defaultVal?: U): U {
		let data = this._stateMap.get(this._state);
		return data ? getter(data) : defaultVal;
	}
}


export abstract class MultiStateAction<T> extends Action {

	constructor(id: string, protected states: IMultiStateData<T>) {
		super(id, '');
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon() {
		this.label = this.states.label;
		this.tooltip = this.states.tooltip;
		this.class = this.states.classes;
	}

	protected updateState(state: T): void {
		this.states.state = state;
		this.updateLabelAndIcon();
	}
}

export class TrustedAction extends ToggleableAction {
	// Constants
	private static readonly trustedLabel = localize('trustLabel', 'Trusted');
	private static readonly notTrustedLabel = localize('untrustLabel', 'Not Trusted');
	private static readonly alreadyTrustedMsg = localize('alreadyTrustedMsg', 'Notebook is already trusted.');
	private static readonly baseClass = 'notebook-button';
	private static readonly trustedCssClass = 'icon-trusted';
	private static readonly notTrustedCssClass = 'icon-notTrusted';

	// Properties

	constructor(
		id: string,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, {
			baseClass: TrustedAction.baseClass,
			toggleOnLabel: TrustedAction.trustedLabel,
			toggleOnClass: TrustedAction.trustedCssClass,
			toggleOffLabel: TrustedAction.notTrustedLabel,
			toggleOffClass: TrustedAction.notTrustedCssClass,
			isOn: false
		});
	}

	public get trusted(): boolean {
		return this.state.isOn;
	}
	public set trusted(value: boolean) {
		this.toggle(value);
	}

	public run(context: NotebookComponent): TPromise<boolean> {
		let self = this;
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (self.trusted) {
					const actions: INotificationActions = { primary: [] };
					self._notificationService.notify({ severity: Severity.Info, message: TrustedAction.alreadyTrustedMsg, actions });
				}
				else {
					self.trusted = !self.trusted;
					context.updateModelTrustDetails(self.trusted);
				}
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class KernelsDropdown extends SelectBox {
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, private model: NotebookModel) {
		super([msgLoading], msgLoading, contextViewProvider, container, { labelText: kernelLabel, labelOnTop: false } as ISelectBoxOptionsWithLabel);

		if (this.model) {
			this.model.onClientSessionReady((session) => {
				//model.kernelChanged(undefined).dispose();
				if (session.kernel) {
					console.log('--In kernelDropdown onClientSessionReady');
					this.updateKernel(session.kernel);
				}
				// session.onKernelChanging(async (changedArgs: azdata.nb.IKernelChangedArgs) => {
				// 	if (changedArgs.newValue) {
				// 		this.updateKernel(changedArgs.newValue.name);
				// 	}
				// });

				session.kernelChanged((changedArgs: azdata.nb.IKernelChangedArgs) => {
					this.updateKernel(changedArgs.newValue);
				});
			});
		}

		this.updateKenerlFromDisplayName(this.model.defaultKernel.display_name);

		this.onDidSelect(e => this.doChangeKernel(e.selected));
	}

	// Update SelectBox values
	public updateKernel(kenerl: azdata.nb.IKernel) {
		if (kenerl) {
			let standardKernel = this.model.getStandardKernelFromName(kenerl.name);
			let displayName = standardKernel.displayName;
			this.updateKenerlFromDisplayName(displayName);
		}
	}

	private updateKenerlFromDisplayName(displayName: string) {
		let kernels: string[] = this.model.standardKernelsDisplayName();
		if (kernels) {
			let index = kernels.findIndex((kernel => kernel === displayName));
			this.setOptions(kernels, index);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.setOptions([msgLoading], 0);
		this.model.changeKernel(displayName);
	}
}

export class AttachToDropdown extends SelectBox {
	private model: INotebookModel;

	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@INotificationService private _notificationService: INotificationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false } as ISelectBoxOptionsWithLabel);
		if (modelRegistered) {
			modelRegistered
				.then(model => {
					this.updateModel(model);
					this.updateAttachToDropdown(model);
				})
				.catch(err => {
					// No-op for now
				});
		}
		this.onDidSelect(e => {
			this.doChangeContext(new ConnectionProfile(this._capabilitiesService, this.getConnectionWithServerAndDatabaseNames(e.selected)));
		});
	}

	public updateModel(model: INotebookModel): void {
		this.model = model;
		model.contextsChanged(() => {
			let kernelDisplayName: string = this.getKernelDisplayName();
			if (kernelDisplayName) {
				this.loadAttachToDropdown(this.model, kernelDisplayName);
			}
		});
	}

	private updateAttachToDropdown(model: INotebookModel): void {
		this.model = model;
		model.onValidConnectionSelected(validConnection => {
			let kernelDisplayName: string = this.getKernelDisplayName();
			if (kernelDisplayName) {
				this.loadAttachToDropdown(this.model, kernelDisplayName, !validConnection);
			}
		});
	}

	private getKernelDisplayName(): string {
		let kernelDisplayName: string;
		if (this.model.clientSession && this.model.clientSession.kernel && this.model.clientSession.kernel.name) {
			let currentKernelName = this.model.clientSession.kernel.name.toLowerCase();
			let currentKernelSpec = this.model.specs.kernels.find(kernel => kernel.name && kernel.name.toLowerCase() === currentKernelName);
			if (currentKernelSpec) {
				kernelDisplayName = currentKernelSpec.display_name;
			}
		}
		return kernelDisplayName;
	}

	// Load "Attach To" dropdown with the values corresponding to Kernel dropdown
	public async loadAttachToDropdown(model: INotebookModel, currentKernel: string, showSelectConnection?: boolean): Promise<void> {
		let connProviderIds = this.model.getApplicableConnectionProviderIds(currentKernel);
		if ((connProviderIds && connProviderIds.length === 0) || currentKernel === noKernel) {
			this.setOptions([msgLocalHost]);
		}
		else {
			let connections = this.getConnections(model);
			this.enable();
			if (showSelectConnection) {
				connections = this.loadWithSelectConnection(connections);
			}
			else {
				if (connections.length === 1 && connections[0] === msgAddNewConnection) {
					connections.unshift(msgSelectConnection);
					this.selectWithOptionName(msgSelectConnection);
				}
				else {
					connections.push(msgAddNewConnection);
				}
			}
			this.setOptions(connections);
		}
	}

	private loadWithSelectConnection(connections: string[]): string[] {
		if (connections && connections.length > 0) {
			connections.unshift(msgSelectConnection);
			this.selectWithOptionName(msgSelectConnection);
			connections.push(msgAddNewConnection);
			this.setOptions(connections);
		}
		return connections;
	}

	//Get connections from context
	public getConnections(model: INotebookModel): string[] {
		let otherConnections: ConnectionProfile[] = [];
		model.contexts.otherConnections.forEach((conn) => { otherConnections.push(conn); });
		// If current connection connects to master, select the option in the dropdown that doesn't specify a database
		if (!model.contexts.defaultConnection.databaseName) {
			this.selectWithOptionName(model.contexts.defaultConnection.serverName);
		} else {
			if (model.contexts.defaultConnection) {
				this.selectWithOptionName(formatServerNameWithDatabaseNameForAttachTo(model.contexts.defaultConnection));
			} else {
				this.select(0);
			}
		}
		otherConnections = this.setConnectionsList(model.contexts.defaultConnection, model.contexts.otherConnections);
		let connections = otherConnections.map((context) => context.databaseName ? context.serverName + ' (' + context.databaseName + ')' : context.serverName);
		return connections;
	}

	private setConnectionsList(defaultConnection: ConnectionProfile, otherConnections: ConnectionProfile[]) {
		if (defaultConnection.serverName !== msgSelectConnection) {
			otherConnections = otherConnections.filter(conn => conn.id !== defaultConnection.id);
			otherConnections.unshift(defaultConnection);
			if (otherConnections.length > 1) {
				otherConnections = otherConnections.filter(val => val.serverName !== msgSelectConnection);
			}
		}
		return otherConnections;
	}

	public getConnectionWithServerAndDatabaseNames(selection: string): ConnectionProfile {
		// Find all connections with the the same server as the selected option
		let connections = this.model.contexts.otherConnections.filter((c) => selection === c.serverName);
		// If only one connection exists with the same server name, use that one
		if (connections.length === 1) {
			return connections[0];
		} else {
			// Extract server and database name
			let serverName = getServerFromFormattedAttachToName(selection);
			let databaseName = getDatabaseFromFormattedAttachToName(selection);
			return this.model.contexts.otherConnections.find((c) => serverName === c.serverName && databaseName === c.databaseName);
		}
	}

	public doChangeContext(connection?: ConnectionProfile, hideErrorMessage?: boolean): void {
		if (this.value === msgAddNewConnection) {
			this.openConnectionDialog();
		} else {
			this.model.changeContext(this.value, connection, hideErrorMessage).then(ok => undefined, err => this._notificationService.error(getErrorMessage(err)));
		}
	}

	/**
	 * Open connection dialog
	 * Enter server details and connect to a server from the dialog
	 * Bind the server value to 'Attach To' drop down
	 * Connected server is displayed at the top of drop down
	 **/
	public async openConnectionDialog(): Promise<void> {
		try {
			await this._connectionDialogService.openDialogAndWait(this._connectionManagementService, { connectionType: 1, providers: this.model.getApplicableConnectionProviderIds(this.model.clientSession.kernel.name) }).then(connection => {
				let attachToConnections = this.values;
				if (!connection) {
					this.loadAttachToDropdown(this.model, this.getKernelDisplayName());
					this.doChangeContext(undefined, true);
					return;
				}
				let connectionProfile = new ConnectionProfile(this._capabilitiesService, connection);
				let connectedServer = formatServerNameWithDatabaseNameForAttachTo(connectionProfile);
				//Check to see if the same server is already there in dropdown. We only have server names in dropdown
				if (attachToConnections.some(val => val === connectedServer)) {
					this.loadAttachToDropdown(this.model, this.getKernelDisplayName());
					this.doChangeContext();
					return;
				}
				else {
					attachToConnections.unshift(connectedServer);
				}
				//To ignore n/a after we have at least one valid connection
				attachToConnections = attachToConnections.filter(val => val !== msgSelectConnection);

				let index = attachToConnections.findIndex((connection => connection === connectedServer));
				this.setOptions([]);
				this.setOptions(attachToConnections);
				if (!index || index < 0 || index >= attachToConnections.length) {
					index = 0;
				}
				this.select(index);

				// Call doChangeContext to set the newly chosen connection in the model
				this.doChangeContext(connectionProfile);
			});
		}
		catch (error) {
			const actions: INotificationActions = { primary: [] };
			this._notificationService.notify({ severity: Severity.Error, message: getErrorMessage(error), actions });
		}
	}
}