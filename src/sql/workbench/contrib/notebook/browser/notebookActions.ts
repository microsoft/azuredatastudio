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
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';
import { getErrorMessage } from 'vs/base/common/errors';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IFindNotebookController } from 'sql/workbench/contrib/notebook/find/notebookFindWidget';
import { INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { find, firstIndex } from 'vs/base/common/arrays';
import { INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';

const msgLoading = localize('loading', "Loading kernels...");
const msgChanging = localize('changing', "Changing kernel...");
const kernelLabel: string = localize('Kernel', "Kernel: ");
const attachToLabel: string = localize('AttachTo', "Attach To: ");
const msgLoadingContexts = localize('loadingContexts', "Loading contexts...");
const msgChangeConnection = localize('changeConnection', "Change Connection");
const msgSelectConnection = localize('selectConnection', "Select Connection");
const msgLocalHost = localize('localhost', "localhost");

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: INotebookEditor): Promise<boolean> {
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
	public run(context: INotebookEditor): Promise<boolean> {
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

export class TrustedAction extends ToggleableAction {
	// Constants
	private static readonly trustedLabel = localize('trustLabel', "Trusted");
	private static readonly notTrustedLabel = localize('untrustLabel', "Not Trusted");
	private static readonly baseClass = 'notebook-button';
	private static readonly trustedCssClass = 'icon-trusted';
	private static readonly notTrustedCssClass = 'icon-notTrusted';

	// Properties

	constructor(
		id: string
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

	public run(context: INotebookEditor): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				self.trusted = !self.trusted;
				context.model.trustedMode = self.trusted;
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
	public async run(context: INotebookEditor): Promise<boolean> {
		try {
			await context.runAllCells();
			return true;
		} catch (e) {
			this.notificationService.error(getErrorMessage(e));
			return false;
		}
	}
}

export class CollapseCellsAction extends ToggleableAction {
	private static readonly collapseCells = localize('collapseAllCells', "Collapse Cells");
	private static readonly expandCells = localize('expandAllCells', "Expand Cells");
	private static readonly baseClass = 'notebook-button';
	private static readonly collapseCssClass = 'icon-hide-cells';
	private static readonly expandCssClass = 'icon-show-cells';

	constructor(id: string) {
		super(id, {
			baseClass: CollapseCellsAction.baseClass,
			toggleOnLabel: CollapseCellsAction.expandCells,
			toggleOnClass: CollapseCellsAction.expandCssClass,
			toggleOffLabel: CollapseCellsAction.collapseCells,
			toggleOffClass: CollapseCellsAction.collapseCssClass,
			isOn: false
		});
	}

	public get isCollapsed(): boolean {
		return this.state.isOn;
	}
	private setCollapsed(value: boolean) {
		this.toggle(value);
	}

	public run(context: INotebookEditor): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				self.setCollapsed(!self.isCollapsed);
				context.cells.forEach(cell => {
					cell.isCollapsed = self.isCollapsed;
				});
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
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
				let index = firstIndex(kernels, kernel => kernel === standardKernel.displayName);
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
	) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false, ariaLabel: attachToLabel } as ISelectBoxOptionsWithLabel);
		if (modelReady) {
			modelReady
				.then(model => {
					this.updateModel(model);
					this._register(model.onValidConnectionSelected(validConnection => {
						this.handleContextsChanged(!validConnection);
					}));
				})
				.catch(err => {
					// No-op for now
				});
		}
		this.onDidSelect(e => {
			this.doChangeContext();
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

	private getKernelDisplayName(): string {
		let kernelDisplayName: string;
		if (this.model.clientSession && this.model.clientSession.kernel && this.model.clientSession.kernel.name) {
			let currentKernelName = this.model.clientSession.kernel.name.toLowerCase();
			let currentKernelSpec = find(this.model.specs.kernels, kernel => kernel.name && kernel.name.toLowerCase() === currentKernelName);
			if (currentKernelSpec) {
				kernelDisplayName = currentKernelSpec.display_name;
			}
		}
		return kernelDisplayName;
	}

	// Load "Attach To" dropdown with the values corresponding to Kernel dropdown
	public loadAttachToDropdown(model: INotebookModel, currentKernel: string, showSelectConnection?: boolean): void {
		let connProviderIds = this.model.getApplicableConnectionProviderIds(currentKernel);
		if ((connProviderIds && connProviderIds.length === 0) || currentKernel === noKernel) {
			this.setOptions([msgLocalHost]);
		}
		else {
			let connections: string[] = model.context && model.context.title ? [model.context.title] : [msgSelectConnection];
			if (!find(connections, x => x === msgChangeConnection)) {
				connections.push(msgChangeConnection);
			}
			this.setOptions(connections, 0);
			this.enable();
		}
	}

	public doChangeContext(connection?: ConnectionProfile, hideErrorMessage?: boolean): void {
		if (this.value === msgChangeConnection || this.value === msgSelectConnection) {
			this.openConnectionDialog().catch(err => this._notificationService.error(getErrorMessage(err)));
		} else {
			this.model.changeContext(this.value, connection, hideErrorMessage).catch(err => this._notificationService.error(getErrorMessage(err)));
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
				// If there is no connection, we should choose the previous connection,
				// which will always be the first item in the list. Either "Select Connection"
				// or a real connection name
				this.select(0);
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

			let index = firstIndex(attachToConnections, connection => connection === connectedServer);
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

	public static readonly INTERNAL_NEW_NOTEBOOK_CMD_ID = '_notebook.command.new';
	constructor(
		id: string,
		label: string,
		@ICommandService private commandService: ICommandService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService
	) {
		super(id, label);
		this.class = 'notebook-action new-notebook';
	}

	async run(context?: azdata.ObjectExplorerContext): Promise<void> {
		let connProfile: azdata.IConnectionProfile;
		if (context && context.nodeInfo) {
			let node = await this.objectExplorerService.getTreeNode(context.connectionProfile.id, context.nodeInfo.nodePath);
			connProfile = TreeUpdateUtils.getConnectionProfile(node).toIConnectionProfile();
		} else if (context && context.connectionProfile) {
			connProfile = context.connectionProfile;
		}
		return this.commandService.executeCommand(NewNotebookAction.INTERNAL_NEW_NOTEBOOK_CMD_ID, { connectionProfile: connProfile });
	}
}

export class NotebookFindNextAction implements IEditorAction {
	public readonly id = 'notebook.findNext';
	public readonly label = localize('notebook.findNext', "Find Next String");
	public readonly alias = '';

	constructor(private notebook: IFindNotebookController) { }

	async run(): Promise<void> {
		await this.notebook.findNext();
	}

	isSupported(): boolean {
		return true;
	}
}

export class NotebookFindPreviousAction implements IEditorAction {
	public readonly id = 'notebook.findPrevious';
	public readonly label = localize('notebook.findPrevious', "Find Previous String");
	public readonly alias = '';

	constructor(private notebook: IFindNotebookController) { }

	async run(): Promise<void> {
		await this.notebook.findPrevious();
	}

	isSupported(): boolean {
		return true;
	}
}
