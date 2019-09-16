/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { INotificationService, Severity, INotificationActions } from 'vs/platform/notification/common/notification';

import { SelectBox, ISelectBoxOptionsWithLabel } from 'sql/base/browser/ui/selectBox/selectBox';
import { IConnectionManagementService, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { noKernel } from 'sql/workbench/services/notebook/browser/sessionManager';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { NotebookModel } from 'sql/workbench/parts/notebook/browser/models/notebookModel';
import { generateUri } from 'sql/platform/connection/common/utils';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILogService } from 'vs/platform/log/common/log';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { CellType } from 'sql/workbench/parts/notebook/common/models/contracts';
import { NotebookComponent } from 'sql/workbench/parts/notebook/browser/notebook.component';
import { getErrorMessage } from 'vs/base/common/errors';
import { INotebookModel } from 'sql/workbench/parts/notebook/browser/models/modelInterfaces';

const msgLoading = localize('loading', "Loading kernels...");
const msgChanging = localize('changing', "Changing kernel...");
const kernelLabel: string = localize('Kernel', "Kernel: ");
const attachToLabel: string = localize('AttachTo', "Attach To: ");
const msgLoadingContexts = localize('loadingContexts', "Loading contexts...");
const msgAddNewConnection = localize('addNewConnection', "Add New Connection");
const msgSelectConnection = localize('selectConnection', "Select Connection");
const msgLocalHost = localize('localhost', "localhost");
const HIDE_ICON_CLASS = ' hideIcon';

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			try {
				context.addCell(this.cellType);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}


// Action to clear outputs of all code cells.
export class ClearAllOutputsAction extends Action {
	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): Promise<boolean> {
		return context.clearAllOutputs();
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
	commandId?: string;
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

	public get commandId(): string {
		return this.getStateValueOrDefault<string>((data) => data.commandId, '');
	}

	private getStateValueOrDefault<U>(getter: (data: IActionStateData) => U, defaultVal?: U): U {
		let data = this._stateMap.get(this._state);
		return data ? getter(data) : defaultVal;
	}
}


export abstract class MultiStateAction<T> extends Action {

	constructor(
		id: string,
		protected states: IMultiStateData<T>,
		private _keybindingService: IKeybindingService,
		private readonly logService: ILogService) {
		super(id, '');
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon() {
		let keyboardShortcut: string;
		try {
			// If a keyboard shortcut exists for the command id passed in, append that to the label
			if (this.states.commandId !== '') {
				let binding = this._keybindingService.lookupKeybinding(this.states.commandId);
				keyboardShortcut = binding ? binding.getLabel() : undefined;
			}
		} catch (error) {
			this.logService.error(error);
		}
		this.label = this.states.label;
		this.tooltip = keyboardShortcut ? this.states.tooltip + ` (${keyboardShortcut})` : this.states.tooltip;
		this.class = this.states.classes;
	}

	protected updateState(state: T): void {
		this.states.state = state;
		this.updateLabelAndIcon();
	}
}

export class TrustedAction extends ToggleableAction {
	// Constants
	private static readonly trustedLabel = localize('trustLabel', "Trusted");
	private static readonly notTrustedLabel = localize('untrustLabel', "Not Trusted");
	private static readonly alreadyTrustedMsg = localize('alreadyTrustedMsg', "Notebook is already trusted.");
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

	public run(context: NotebookComponent): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				if (self.trusted) {
					const actions: INotificationActions = { primary: [] };
					self._notificationService.notify({ severity: Severity.Info, message: TrustedAction.alreadyTrustedMsg, actions });
				}
				else {
					self.trusted = !self.trusted;
					context.model.trustedMode = self.trusted;
				}
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

// Action to run all code cells in a notebook.
export class RunAllCellsAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotificationService private notificationService: INotificationService
	) {
		super(id, label, cssClass);
	}
	public async run(context: NotebookComponent): Promise<boolean> {
		try {
			await context.runAllCells();
			return true;
		} catch (e) {
			this.notificationService.error(getErrorMessage(e));
			return false;
		}
	}
}

export class KernelsDropdown extends SelectBox {
	private model: NotebookModel;
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<INotebookModel>) {
		super([msgLoading], msgLoading, contextViewProvider, container, { labelText: kernelLabel, labelOnTop: false, ariaLabel: kernelLabel } as ISelectBoxOptionsWithLabel);

		if (modelReady) {
			modelReady
				.then((model) => this.updateModel(model))
				.catch((err) => {
					// No-op for now
				});
		}

		this.onDidSelect(e => this.doChangeKernel(e.selected));
	}

	updateModel(model: INotebookModel): void {
		this.model = model as NotebookModel;
		this._register(this.model.kernelChanged((changedArgs: azdata.nb.IKernelChangedArgs) => {
			this.updateKernel(changedArgs.newValue);
		}));
		let kernel = this.model.clientSession && this.model.clientSession.kernel;
		this.updateKernel(kernel);
	}

	// Update SelectBox values
	public updateKernel(kernel: azdata.nb.IKernel) {
		let kernels: string[] = this.model.standardKernelsDisplayName();
		if (kernel && kernel.isReady) {
			let standardKernel = this.model.getStandardKernelFromName(kernel.name);

			if (kernels && standardKernel) {
				let index = kernels.findIndex((kernel => kernel === standardKernel.displayName));
				this.setOptions(kernels, index);
			}
		} else if (this.model.clientSession.isInErrorState) {
			let noKernelName = localize('noKernel', "No Kernel");
			kernels.unshift(noKernelName);
			this.setOptions(kernels, 0);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.setOptions([msgChanging], 0);
		this.model.changeKernel(displayName);
	}
}

export class AttachToDropdown extends SelectBox {
	private model: NotebookModel;

	constructor(
		container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<INotebookModel>,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@INotificationService private _notificationService: INotificationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@ILogService private readonly logService: ILogService
	) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false, ariaLabel: attachToLabel } as ISelectBoxOptionsWithLabel);
		if (modelReady) {
			modelReady
				.then(model => {
					this.updateModel(model);
					this.updateAttachToDropdown(model);
				})
				.catch(err => {
					// No-op for now
				});
		}
		this.onDidSelect(e => {
			this.doChangeContext(this.getSelectedConnection(e.selected));
		});
	}

	public updateModel(model: INotebookModel): void {
		this.model = model as NotebookModel;
		this._register(model.contextsChanged(() => {
			this.handleContextsChanged();
		}));
		this._register(this.model.contextsLoading(() => {
			this.setOptions([msgLoadingContexts], 0);
		}));
		this.model.requestConnectionHandler = () => this.openConnectionDialog(true);
		this.handleContextsChanged();
	}

	private handleContextsChanged(showSelectConnection?: boolean) {
		let kernelDisplayName: string = this.getKernelDisplayName();
		if (kernelDisplayName) {
			this.loadAttachToDropdown(this.model, kernelDisplayName, showSelectConnection);
		} else if (this.model.clientSession.isInErrorState) {
			this.setOptions([localize('noContextAvailable', "None")], 0);
		}
	}

	private updateAttachToDropdown(model: INotebookModel): void {
		if (this.model.connectionProfile && this.model.connectionProfile.serverName) {
			let connectionUri = generateUri(this.model.connectionProfile, 'notebook');
			this.model.notebookOptions.connectionService.connect(this.model.connectionProfile, connectionUri).then(result => {
				if (result.connected) {
					let connectionProfile = new ConnectionProfile(this._capabilitiesService, result.connectionProfile);
					this.model.addAttachToConnectionsToBeDisposed(connectionUri);
					this.doChangeContext(connectionProfile);
				} else {
					this.openConnectionDialog(true);
				}
			}).catch(err =>
				this.logService.error(err));
		}
		this._register(model.onValidConnectionSelected(validConnection => {
			this.handleContextsChanged(!validConnection);
		}));
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
				}
				else {
					if (!connections.includes(msgAddNewConnection)) {
						connections.push(msgAddNewConnection);
					}
				}
				this.setOptions(connections, 0);
			}
		}
	}

	private loadWithSelectConnection(connections: string[]): string[] {
		if (connections && connections.length > 0) {
			if (!connections.includes(msgSelectConnection)) {
				connections.unshift(msgSelectConnection);
			}

			if (!connections.includes(msgAddNewConnection)) {
				connections.push(msgAddNewConnection);
			}
			this.setOptions(connections, 0);
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
				this.selectWithOptionName(model.contexts.defaultConnection.title ? model.contexts.defaultConnection.title : model.contexts.defaultConnection.serverName);
			} else {
				this.select(0);
			}
		}
		otherConnections = this.setConnectionsList(model.contexts.defaultConnection, model.contexts.otherConnections);
		let connections = otherConnections.map((context) => context.title ? context.title : context.serverName);
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

	public getSelectedConnection(selection: string): ConnectionProfile {
		// Find all connections with the the same server as the selected option
		let connections = this.model.contexts.otherConnections.filter((c) => selection === c.title);
		// If only one connection exists with the same server name, use that one
		if (connections.length === 1) {
			return connections[0];
		} else {
			return this.model.contexts.otherConnections.find((c) => selection === c.title);
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
	public async openConnectionDialog(useProfile: boolean = false): Promise<boolean> {
		try {
			let connection = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService,
				{
					connectionType: ConnectionType.temporary,
					providers: this.model.getApplicableConnectionProviderIds(this.model.clientSession.kernel.name)
				},
				useProfile ? this.model.connectionProfile : undefined);

			let attachToConnections = this.values;
			if (!connection) {
				this.loadAttachToDropdown(this.model, this.getKernelDisplayName());
				this.doChangeContext(undefined, true);
				return false;
			}
			let connectionUri = this._connectionManagementService.getConnectionUri(connection);
			let connectionProfile = new ConnectionProfile(this._capabilitiesService, connection);
			let connectedServer = connectionProfile.title ? connectionProfile.title : connectionProfile.serverName;
			//Check to see if the same server is already there in dropdown. We only have server names in dropdown
			if (attachToConnections.some(val => val === connectedServer)) {
				this.loadAttachToDropdown(this.model, this.getKernelDisplayName());
				this.doChangeContext();
				return true;
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

			this.model.addAttachToConnectionsToBeDisposed(connectionUri);
			// Call doChangeContext to set the newly chosen connection in the model
			this.doChangeContext(connectionProfile);
			return true;
		}
		catch (error) {
			const actions: INotificationActions = { primary: [] };
			this._notificationService.notify({ severity: Severity.Error, message: getErrorMessage(error), actions });
			return false;
		}
	}
}

export class NewNotebookAction extends Action {

	public static readonly ID = 'notebook.command.new';
	public static readonly LABEL = localize('newNotebookAction', "New Notebook");

	private static readonly INTERNAL_NEW_NOTEBOOK_CMD_ID = '_notebook.command.new';
	constructor(
		id: string,
		label: string,
		@ICommandService private commandService: ICommandService
	) {
		super(id, label);
		this.class = 'notebook-action new-notebook';
	}

	run(context?: azdata.ConnectedContext): Promise<void> {
		return this.commandService.executeCommand(NewNotebookAction.INTERNAL_NEW_NOTEBOOK_CMD_ID, context);
	}

}
