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
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';
import { getErrorMessage } from 'vs/base/common/errors';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IFindNotebookController } from 'sql/workbench/contrib/notebook/browser/find/notebookFindWidget';
import { INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { find, firstIndex } from 'vs/base/common/arrays';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { URI } from 'vs/base/common/uri';

const msgLoading = localize('loading', "Loading kernels...");
export const msgChanging = localize('changing', "Changing kernel...");
const attachToLabel: string = localize('AttachTo', "Attach to ");
const kernelLabel: string = localize('Kernel', "Kernel ");
const msgLoadingContexts = localize('loadingContexts', "Loading contexts...");
const msgChangeConnection = localize('changeConnection', "Change Connection");
const msgSelectConnection = localize('selectConnection', "Select Connection");
const msgLocalHost = localize('localhost', "localhost");

export const noKernel: string = localize('noKernel', "No Kernel");

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
	}
	public async run(context: URI | CellContext): Promise<void> {
		let index = 0;
		if (context instanceof CellContext) {
			if (context?.model?.cells) {
				let activeCellId = context.model.activeCell.id;
				if (activeCellId) {
					index = context.model.cells.findIndex(cell => cell.id === activeCellId) + 1;
				}
			}
			if (context?.model) {
				context.model.addCell(this.cellType, index);
			}
		} else {
			//Add Cell after current selected cell.
			const editor = this._notebookService.findNotebookEditor(context);
			const index = editor.cells?.findIndex(cell => cell.active) ?? 0;
			editor.addCell(this.cellType, index);
		}
	}
}

export interface ITooltipState {
	label: string;
	baseClass: string;
	iconClass: string;
	maskedIconClass: string;
	shouldToggleTooltip?: boolean;
}
export abstract class TooltipFromLabelAction extends Action {

	constructor(id: string, protected state: ITooltipState) {
		super(id, '');
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon() {
		if (this.state.shouldToggleTooltip) {
			this.tooltip = this.state.label;
		} else {
			this.label = this.state.label;
		}
		let classes = this.state.baseClass ? `${this.state.baseClass} ${this.state.iconClass} ` : '';
		if (this.state.shouldToggleTooltip) {
			classes += this.state.maskedIconClass;
		}
		this.class = classes;
	}
}
// Action to clear outputs of all code cells.
export class ClearAllOutputsAction extends TooltipFromLabelAction {
	private static readonly label = localize('clearResults', "Clear Results");
	private static readonly baseClass = 'notebook-button';
	private static readonly iconClass = 'icon-clear-results';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService) {
		super(id, {
			label: ClearAllOutputsAction.label,
			baseClass: ClearAllOutputsAction.baseClass,
			iconClass: ClearAllOutputsAction.iconClass,
			maskedIconClass: ClearAllOutputsAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip
		});
	}

	public run(context: URI): Promise<boolean> {
		const editor = this._notebookService.findNotebookEditor(context);
		return editor.clearAllOutputs();
	}
}

export interface IToggleableState {
	baseClass?: string;
	shouldToggleTooltip?: boolean;
	toggleOnClass: string;
	toggleOnLabel: string;
	toggleOffLabel: string;
	toggleOffClass: string;
	maskedIconClass?: string;
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

		let classes: string = '';

		if (this.state.shouldToggleTooltip && this.state.maskedIconClass) {
			//mask
			classes = this.state.baseClass ? `${this.state.baseClass} ${this.state.maskedIconClass} ` : '';
		} else {
			//no mask
			classes = this.state.baseClass ? `${this.state.baseClass} ` : '';
		}
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
	private static readonly previewTrustedCssClass = 'icon-shield';
	private static readonly trustedCssClass = 'icon-trusted';
	private static readonly previewNotTrustedCssClass = 'icon-shield-x';
	private static readonly notTrustedCssClass = 'icon-notTrusted';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(
		id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, {
			baseClass: TrustedAction.baseClass,
			toggleOnLabel: TrustedAction.trustedLabel,
			toggleOnClass: toggleTooltip === true ? TrustedAction.previewTrustedCssClass : TrustedAction.trustedCssClass,
			toggleOffLabel: TrustedAction.notTrustedLabel,
			toggleOffClass: toggleTooltip === true ? TrustedAction.previewNotTrustedCssClass : TrustedAction.notTrustedCssClass,
			maskedIconClass: TrustedAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: false
		});
	}

	public get trusted(): boolean {
		return this.state.isOn;
	}
	public set trusted(value: boolean) {
		this.toggle(value);
	}

	public async run(context: URI): Promise<boolean> {
		const editor = this._notebookService.findNotebookEditor(context);
		this.trusted = !this.trusted;
		editor.model.trustedMode = this.trusted;
		return true;
	}
}

// Action to run all code cells in a notebook.
export class RunAllCellsAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotificationService private notificationService: INotificationService,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
	}
	public async run(context: URI): Promise<boolean> {
		try {
			const editor = this._notebookService.findNotebookEditor(context);
			await editor.runAllCells();
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
	private static readonly previewCollapseCssClass = 'icon-collapse-cells';
	private static readonly collapseCssClass = 'icon-hide-cells';
	private static readonly previewExpandCssClass = 'icon-expand-cells';
	private static readonly expandCssClass = 'icon-show-cells';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService) {
		super(id, {
			baseClass: CollapseCellsAction.baseClass,
			toggleOnLabel: CollapseCellsAction.expandCells,
			toggleOnClass: toggleTooltip === true ? CollapseCellsAction.previewExpandCssClass : CollapseCellsAction.expandCssClass,
			toggleOffLabel: CollapseCellsAction.collapseCells,
			toggleOffClass: toggleTooltip === true ? CollapseCellsAction.previewCollapseCssClass : CollapseCellsAction.collapseCssClass,
			maskedIconClass: CollapseCellsAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: false
		});
	}

	public get isCollapsed(): boolean {
		return this.state.isOn;
	}
	private setCollapsed(value: boolean) {
		this.toggle(value);
	}

	public async run(context: URI): Promise<boolean> {
		const editor = this._notebookService.findNotebookEditor(context);
		this.setCollapsed(!this.isCollapsed);
		editor.cells.forEach(cell => {
			cell.isCollapsed = this.isCollapsed;
		});
		return true;
	}
}

const showAllKernelsConfigName = 'notebook.showAllKernels';
const workbenchPreviewConfigName = 'workbench.enablePreviewFeatures';
export const noKernelName = localize('noKernel', "No Kernel");
export class KernelsDropdown extends SelectBox {
	private model: NotebookModel;
	private _showAllKernels: boolean = false;
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<INotebookModel>, @IConfigurationService private _configurationService: IConfigurationService) {
		super([msgLoading], msgLoading, contextViewProvider, container, { labelText: kernelLabel, labelOnTop: false, ariaLabel: kernelLabel } as ISelectBoxOptionsWithLabel);

		if (modelReady) {
			modelReady
				.then((model) => this.updateModel(model))
				.catch((err) => {
					// No-op for now
				});
		}

		this.onDidSelect(e => this.doChangeKernel(e.selected));
		this.getAllKernelConfigValue();
		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(showAllKernelsConfigName) || e.affectsConfiguration(workbenchPreviewConfigName)) {
				this.getAllKernelConfigValue();
			}
		}));
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
		let kernels: string[] = this._showAllKernels ? [...new Set(this.model.specs.kernels.map(a => a.display_name).concat(this.model.standardKernelsDisplayName()))]
			: this.model.standardKernelsDisplayName();
		if (kernel && kernel.isReady) {
			let standardKernel = this.model.getStandardKernelFromName(kernel.name);
			if (kernels) {
				let index;
				if (standardKernel) {
					index = firstIndex(kernels, kernel => kernel === standardKernel.displayName);
				} else {
					let kernelSpec = this.model.specs.kernels.find(k => k.name === kernel.name);
					index = firstIndex(kernels, k => k === kernelSpec?.display_name);
				}
				// This is an error case that should never happen
				// Just in case, setting index to 0
				if (index < 0) {
					index = 0;
				}
				this.setOptions(kernels, index);
			}
		} else if (this.model.clientSession.isInErrorState) {
			kernels.unshift(noKernelName);
			this.setOptions(kernels, 0);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.setOptions([msgChanging], 0);
		this.model.changeKernel(displayName);
	}

	private getAllKernelConfigValue(): void {
		this._showAllKernels = !!this._configurationService.getValue(showAllKernelsConfigName) && !!this._configurationService.getValue(workbenchPreviewConfigName);
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
