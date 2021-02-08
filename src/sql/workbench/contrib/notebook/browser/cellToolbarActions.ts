/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationActions, INotificationService } from 'vs/platform/notification/common/notification';
import { Action, IAction, Separator } from 'vs/base/common/actions';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { CellActionBase, CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { CellModel } from 'sql/workbench/services/notebook/browser/models/cell';
import { CellTypes, CellType } from 'sql/workbench/services/notebook/common/contracts';
import { attachToDropdownElementId, attachToLabel, msgChangeConnection, msgLoadingContexts, msgLocalHost, msgSelectConnection, noKernel, ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { getErrorMessage } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ICellModel, MoveDirection } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ISelectBoxOptionsWithLabel, SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionType, IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';

const moreActionsLabel = localize('moreActionsLabel', "More");

export class EditCellAction extends ToggleableAction {
	// Constants
	private static readonly editLabel = localize('editLabel', "Edit");
	private static readonly closeLabel = localize('closeLabel', "Close");
	private static readonly baseClass = 'codicon';
	private static readonly editCssClass = 'edit';
	private static readonly closeCssClass = 'close';
	private static readonly maskedIconClass = 'masked-icon';

	constructor(
		id: string, toggleTooltip: boolean, isEditMode: boolean
	) {
		super(id, {
			baseClass: EditCellAction.baseClass,
			toggleOnLabel: EditCellAction.closeLabel,
			toggleOnClass: EditCellAction.closeCssClass,
			toggleOffLabel: EditCellAction.editLabel,
			toggleOffClass: EditCellAction.editCssClass,
			maskedIconClass: EditCellAction.maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: isEditMode
		});
	}

	public get editMode(): boolean {
		return this.state.isOn;
	}
	public set editMode(value: boolean) {
		this.toggle(value);
	}

	public run(context: CellContext): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			try {
				self.editMode = !self.editMode;
				context.cell.isEditMode = self.editMode;
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class MoveCellAction extends CellActionBase {
	constructor(
		id: string,
		cssClass: string,
		label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
		this._cssClass = cssClass;
		this._tooltip = label;
		this._label = '';
	}

	doRun(context: CellContext): Promise<void> {
		let moveDirection = this._cssClass.includes('move-down') ? MoveDirection.Down : MoveDirection.Up;
		try {
			context.model.moveCell(context.cell, moveDirection);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class DeleteCellAction extends CellActionBase {
	constructor(
		id: string,
		cssClass: string,
		label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
		this._cssClass = cssClass;
		this._tooltip = label;
		this._label = '';
	}

	doRun(context: CellContext): Promise<void> {
		try {
			context.model.deleteCell(context.cell);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class CellToggleMoreActions {
	private _actions: (Action | CellActionBase)[] = [];
	private _moreActions: ActionBar;
	private _moreActionsElement: HTMLElement;
	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this._actions.push(
			instantiationService.createInstance(ConvertCellAction, 'convertCell', localize('convertCell', "Convert Cell")),
			new Separator(),
			instantiationService.createInstance(RunCellsAction, 'runAllAbove', localize('runAllAbove', "Run Cells Above"), false),
			instantiationService.createInstance(RunCellsAction, 'runAllBelow', localize('runAllBelow', "Run Cells Below"), true),
			new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'codeAbove', localize('codeAbove', "Insert Code Above"), CellTypes.Code, false),
			instantiationService.createInstance(AddCellFromContextAction, 'codeBelow', localize('codeBelow', "Insert Code Below"), CellTypes.Code, true),
			new Separator(),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownAbove', localize('markdownAbove', "Insert Text Above"), CellTypes.Markdown, false),
			instantiationService.createInstance(AddCellFromContextAction, 'markdownBelow', localize('markdownBelow', "Insert Text Below"), CellTypes.Markdown, true),
			new Separator(),
			instantiationService.createInstance(CollapseCellAction, 'collapseCell', localize('collapseCell', "Collapse Cell"), true),
			instantiationService.createInstance(CollapseCellAction, 'expandCell', localize('expandCell', "Expand Cell"), false),
			new Separator(),
			instantiationService.createInstance(ParametersCellAction, 'makeParameterCell', localize('makeParameterCell', "Make parameter cell"), true),
			instantiationService.createInstance(ParametersCellAction, 'removeParameterCell', localize('RemoveParameterCell', "Remove parameter cell"), false),
			new Separator(),
			instantiationService.createInstance(ClearCellOutputAction, 'clear', localize('clear', "Clear Result")),
		);
	}

	public onInit(elementRef: HTMLElement, context: CellContext) {
		this._moreActionsElement = elementRef;
		this._moreActionsElement.setAttribute('aria-haspopup', 'menu');
		if (this._moreActionsElement.childNodes.length > 0) {
			this._moreActionsElement.removeChild(this._moreActionsElement.childNodes[0]);
		}
		this._moreActions = new ActionBar(this._moreActionsElement, { orientation: ActionsOrientation.VERTICAL, ariaLabel: moreActionsLabel });
		this._moreActions.context = { target: this._moreActionsElement };
		let validActions = this._actions.filter(a => a instanceof Separator || a instanceof CellActionBase && a.canRun(context));
		removeDuplicatedAndStartingSeparators(validActions);
		this._moreActions.push(this.instantiationService.createInstance(ToggleMoreActions, validActions, context), { icon: true, label: false });
	}
}

export function removeDuplicatedAndStartingSeparators(actions: (Action | CellActionBase)[]): void {
	let indexesToRemove: number[] = [];
	for (let i = 0; i < actions.length; i++) {
		// Handle multiple separators in a row
		if (i > 0 && actions[i] instanceof Separator && actions[i - 1] instanceof Separator) {
			indexesToRemove.push(i);
		}
	}
	if (indexesToRemove.length > 0) {
		for (let i = indexesToRemove.length - 1; i >= 0; i--) {
			actions.splice(indexesToRemove[i], 1);
		}
	}
	if (actions[0] instanceof Separator) {
		actions.splice(0, 1);
	}
	if (actions[actions.length - 1] instanceof Separator) {
		actions.splice(actions.length - 1, 1);
	}
}

export class ConvertCellAction extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	doRun(context: CellContext): Promise<void> {
		try {
			context?.model?.convertCellType(context?.cell);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class AddCellFromContextAction extends CellActionBase {
	constructor(
		id: string, label: string, private cellType: CellType, private isAfter: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	doRun(context: CellContext): Promise<void> {
		try {
			let model = context.model;
			let index = model.cells.findIndex((cell) => cell.id === context.cell.id);
			if (index !== undefined && this.isAfter) {
				index += 1;
			}
			model.addCell(this.cellType, index);
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class ClearCellOutputAction extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}


	doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				(cell as CellModel).clearOutputs();
			}
		} catch (error) {
			let message = getErrorMessage(error);

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}

}

export class RunCellsAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private isAfter: boolean,
		@INotificationService notificationService: INotificationService,
		@INotebookService private notebookService: INotebookService,
	) {
		super(id, label, undefined, notificationService);
	}

	public canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				let editor = this.notebookService.findNotebookEditor(cell.notebookModel.notebookUri);
				if (editor) {
					if (this.isAfter) {
						await editor.runAllCells(cell, undefined);
					} else {
						await editor.runAllCells(undefined, cell);
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class CollapseCellAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private collapseCell: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public canRun(context: CellContext): boolean {
		return context.cell && context.cell.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				if (this.collapseCell) {
					if (!cell.isCollapsed) {
						cell.isCollapsed = true;
					}
				} else {
					if (cell.isCollapsed) {
						cell.isCollapsed = false;
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class ToggleMoreActions extends Action {

	private static readonly ID = 'toggleMore';
	private static readonly LABEL = moreActionsLabel;
	private static readonly ICON = 'masked-icon more';

	constructor(
		private readonly _actions: Array<IAction>,
		private readonly _context: CellContext,
		@IContextMenuService private readonly _contextMenuService: IContextMenuService
	) {
		super(ToggleMoreActions.ID, ToggleMoreActions.LABEL, ToggleMoreActions.ICON);
	}

	run(context: StandardKeyboardEvent): Promise<boolean> {
		this._contextMenuService.showContextMenu({
			getAnchor: () => context.target,
			getActions: () => this._actions,
			getActionsContext: () => this._context
		});
		return Promise.resolve(true);
	}
}

export class CellAttachToDropdown extends SelectBox {
	private cellModel: CellModel;
	private notebookModel: NotebookModel;

	constructor(
		container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<ICellModel>,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@INotificationService private _notificationService: INotificationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
	) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false, ariaLabel: attachToLabel, id: attachToDropdownElementId } as ISelectBoxOptionsWithLabel);
		if (modelReady) {
			modelReady
				.then(model => {
					this.updateModel(model);
					this._register(model.onValidConnectionSelected(validConnection => {
						this.handleContextsChanged(!validConnection);
					}));
					this._register(this.notebookModel.onConnectionModeChanged(multiConnection => {
						this.handleConnectionModeChanged(multiConnection);
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

	public updateModel(model: ICellModel): void {
		this.cellModel = model as CellModel;
		this.notebookModel = model.notebookModel as NotebookModel;
		this.handleConnectionModeChanged(this.notebookModel.multiConnectionMode);
		this._register(this.cellModel.contextsChanged(() => {
			this.handleContextsChanged();
		}));
		this._register(this.cellModel.contextsLoading(() => {
			this.setOptions([msgLoadingContexts], 0);
		}));
		this.cellModel.requestConnectionHandler = () => this.openConnectionDialog(true);
		this.handleContextsChanged();
	}

	private handleContextsChanged(showSelectConnection?: boolean) {
		let kernelDisplayName: string = this.getKernelDisplayName();
		if (kernelDisplayName) {
			this.loadAttachToDropdown(this.cellModel, kernelDisplayName, showSelectConnection);
		} else if (this.notebookModel.clientSession.isInErrorState) {
			this.setOptions([localize('noContextAvailable', "None")], 0);
		}
	}

	private handleConnectionModeChanged(multiConnection: boolean): void {
		if (multiConnection) {
			this.enable();
		} else {
			this.disable();
		}
	}

	private getKernelDisplayName(): string {
		let kernelDisplayName: string;
		if (this.notebookModel.clientSession && this.notebookModel.clientSession.kernel && this.notebookModel.clientSession.kernel.name) {
			let currentKernelName = this.notebookModel.clientSession.kernel.name.toLowerCase();
			let currentKernelSpec = this.notebookModel.specs.kernels.find(kernel => kernel.name && kernel.name.toLowerCase() === currentKernelName);
			if (currentKernelSpec) {
				//KernelDisplayName should be Kusto when connecting to Kusto connection
				if ((this.notebookModel.context?.serverCapabilities.notebookKernelAlias && this.notebookModel.currentKernelAlias === this.notebookModel.context?.serverCapabilities.notebookKernelAlias) || (this.notebookModel.kernelAliases.includes(this.notebookModel.selectedKernelDisplayName) && this.notebookModel.selectedKernelDisplayName)) {
					kernelDisplayName = this.notebookModel.context?.serverCapabilities.notebookKernelAlias || this.notebookModel.selectedKernelDisplayName;
				} else {
					kernelDisplayName = currentKernelSpec.display_name;
				}
			}
		}
		return kernelDisplayName;
	}

	// // Load "Attach To" dropdown with the values corresponding to Kernel dropdown
	public loadAttachToDropdown(model: ICellModel, currentKernel: string, showSelectConnection?: boolean): void {
		let connProviderIds = this.notebookModel.getApplicableConnectionProviderIds(currentKernel);
		if ((connProviderIds && connProviderIds.length === 0) || currentKernel === noKernel) {
			this.setOptions([msgLocalHost]);
		} else {
			let connections: string[] = [];
			if (model.context && model.context.title && (connProviderIds.includes(model.context.providerName))) {
				connections.push(model.context.title);
			} else if (model.savedConnectionName) {
				connections.push(model.savedConnectionName);
			} else {
				connections.push(msgSelectConnection);
			}
			if (!connections.find(x => x === msgChangeConnection)) {
				connections.push(msgChangeConnection);
			}
			this.setOptions(connections, 0);
			// this.enable();

			if (this.notebookModel.kernelAliases.includes(currentKernel) && this.notebookModel.selectedKernelDisplayName !== currentKernel) {
				this.notebookModel.changeKernel(currentKernel);
			}
		}
	}

	public doChangeContext(connection?: ConnectionProfile, hideErrorMessage?: boolean): void {
		if (this.value === msgChangeConnection || this.value === msgSelectConnection) {
			this.openConnectionDialog().catch(err => this._notificationService.error(getErrorMessage(err)));
		} else {
			this.cellModel.changeContext(this.value, connection).catch(err => this._notificationService.error(getErrorMessage(err)));
		}
	}

	// /**
	//  * Open connection dialog
	//  * Enter server details and connect to a server from the dialog
	//  * Bind the server value to cell 'Attach To' drop down
	//  * Connected server is displayed at the top of cell drop down
	//  **/
	public async openConnectionDialog(useProfile: boolean = false): Promise<boolean> {
		try {
			// Get all providers to show all available connections in connection dialog
			let providers = this.notebookModel.getApplicableConnectionProviderIds(this.notebookModel.clientSession.kernel.name);
			// Spark kernels are unable to get providers from above, therefore ensure that we get the
			// correct providers for the selected kernel and load the proper connections for the connection dialog
			// Example Scenario: Spark Kernels should only have MSSQL connections in connection dialog
			if (!this.notebookModel.kernelAliases.includes(this.notebookModel.selectedKernelDisplayName) && this.notebookModel.clientSession.kernel.name !== 'SQL') {
				providers = providers.concat(this.notebookModel.getApplicableConnectionProviderIds(this.notebookModel.selectedKernelDisplayName));
			} else {
				for (let alias of this.notebookModel.kernelAliases) {
					providers = providers.concat(this.notebookModel.getApplicableConnectionProviderIds(alias));
				}
			}
			let connection = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService,
				{
					connectionType: ConnectionType.temporary,
					providers: providers
				},
				useProfile ? this.notebookModel.connectionProfile : undefined);

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
				this.loadAttachToDropdown(this.cellModel, this.getKernelDisplayName());
				this.doChangeContext();
				return true;
			}
			else {
				attachToConnections.unshift(connectedServer);
			}
			//To ignore n/a after we have at least one valid connection
			attachToConnections = attachToConnections.filter(val => val !== msgSelectConnection);

			let index = attachToConnections.findIndex(connection => connection === connectedServer);
			this.setOptions([]);
			this.setOptions(attachToConnections);
			if (!index || index < 0 || index >= attachToConnections.length) {
				index = 0;
			}
			this.select(index);

			this.notebookModel.addAttachToConnectionsToBeDisposed(connectionUri);
			// Call doChangeContext to set the newly chosen connection in the model
			this.doChangeContext(connectionProfile);

			//Changes kernel based on connection attached to
			if (this.notebookModel.kernelAliases.includes(connectionProfile.serverCapabilities.notebookKernelAlias)) {
				this.notebookModel.changeKernel(connectionProfile.serverCapabilities.notebookKernelAlias);
			} else if (this.notebookModel.clientSession.kernel.name === 'SQL') {
				this.notebookModel.changeKernel('SQL');
			}
			return true;
		}
		catch (error) {
			const actions: INotificationActions = { primary: [] };
			this._notificationService.notify({ severity: Severity.Error, message: getErrorMessage(error), actions });
			return false;
		}
	}
}

export class ParametersCellAction extends CellActionBase {
	constructor(id: string,
		label: string,
		private parametersCell: boolean,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	public canRun(context: CellContext): boolean {
		return context.cell?.cellType === CellTypes.Code;
	}

	async doRun(context: CellContext): Promise<void> {
		try {
			let cell = context.cell || context.model.activeCell;
			if (cell) {
				if (this.parametersCell) {
					if (!cell.isParameter) {
						cell.isParameter = true;
					}
				} else {
					if (cell.isParameter) {
						cell.isParameter = false;
					}
				}
			}
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
	}
}
