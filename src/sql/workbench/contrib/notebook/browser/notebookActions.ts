/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as path from 'vs/base/common/path';

import { Action, IAction, Separator } from 'vs/base/common/actions';
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
import { CellType, NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { getErrorMessage } from 'vs/base/common/errors';
import { IEditorAction } from 'vs/editor/common/editorCommon';
import { IFindNotebookController } from 'sql/workbench/contrib/notebook/browser/find/notebookFindWidget';
import { INotebookModel, ViewMode } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { URI } from 'vs/base/common/uri';
import { Emitter, Event } from 'vs/base/common/event';
import { IActionProvider } from 'vs/base/browser/ui/dropdown/dropdown';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { KernelsLanguage } from 'sql/workbench/services/notebook/common/notebookConstants';
import { INotebookViews } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

const msgLoading = localize('loading', "Loading kernels...");
export const msgChanging = localize('changing', "Changing kernel...");
const attachToLabel: string = localize('AttachTo', "Attach to ");
const kernelLabel: string = localize('Kernel', "Kernel ");
const msgLoadingContexts = localize('loadingContexts', "Loading contexts...");
const msgChangeConnection = localize('changeConnection', "Change Connection");
const msgSelectConnection = localize('selectConnection', "Select Connection");
const msgLocalHost = localize('localhost', "localhost");

export const noKernel: string = localize('noKernel', "No Kernel");
const baseIconClass = 'codicon';
const maskedIconClass = 'masked-icon';
export const kernelNotSupported: string = localize('kernelNotSupported', "This notebook cannot run with parameters as the kernel is not supported. Please use the supported kernels and format. [Learn more](https://docs.microsoft.com/sql/azure-data-studio/notebooks/notebooks-parameterization).");
export const noParameterCell: string = localize('noParametersCell', "This notebook cannot run with parameters until a parameter cell is added. [Learn more](https://docs.microsoft.com/sql/azure-data-studio/notebooks/notebooks-parameterization).");
export const noParametersInCell: string = localize('noParametersInCell', "This notebook cannot run with parameters until there are parameters added to the parameter cell. [Learn more](https://docs.microsoft.com/sql/azure-data-studio/notebooks/notebooks-parameterization).");

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string,
		@INotebookService private _notebookService: INotebookService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
	) {
		super(id, label, cssClass);
	}
	public override async run(context: URI | CellContext): Promise<void> {
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
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.NbTelemetryAction.AddCell)
			.withAdditionalProperties({ cell_type: this.cellType })
			.send();
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
	private static readonly iconClass = 'icon-clear-results';

	constructor(id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService) {
		super(id, {
			label: ClearAllOutputsAction.label,
			baseClass: baseIconClass,
			iconClass: ClearAllOutputsAction.iconClass,
			maskedIconClass: maskedIconClass,
			shouldToggleTooltip: toggleTooltip
		});
	}

	public override async run(context: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(context);
		await editor.clearAllOutputs();
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

export class NotebookViewsActionProvider implements IActionProvider {
	private _options: Action[] = [];
	private views: INotebookViews;
	private viewMode: ViewMode;
	private readonly _optionsUpdated = new Emitter<boolean>();

	constructor(
		container: HTMLElement,
		views: INotebookViews,
		modelReady: Promise<INotebookModel>,
		@INotebookService private _notebookService: INotebookService,
		@INotificationService private _notificationService: INotificationService,
		@IInstantiationService private instantiationService: IInstantiationService) {

		modelReady?.then((model) => {
			this.views = views;
			this.viewMode = model.viewMode;
			this.updateView();
		})
			.catch((err) => {
				this._notificationService.error(getErrorMessage(err));
			});
	}

	getActions(): IAction[] {
		return this._options;
	}

	public get options(): Action[] {
		return this._options;
	}

	/**
	 * Update SelectBox values
	 */
	public updateView() {
		const backToNotebookButton = this.instantiationService.createInstance(NotebookViewAction, 'notebookView.backToNotebook', localize('notebookViewLabel', 'Editor'), 'notebook-button');
		const newViewButton = this.instantiationService.createInstance(CreateNotebookViewAction, 'notebookView.newView', localize('newViewLabel', 'Create New View'), 'notebook-button notebook-button-newview');

		const views = this.views.getViews();
		this._options = [];

		this._options.push(backToNotebookButton);
		this._options.push(newViewButton);

		if (views.length) {
			this._options.push(this.instantiationService.createInstance(Separator));
		}

		views.forEach((view) => {
			const option = new DashboardViewAction(view.guid, view.name, 'button', this._notebookService, this._notificationService);
			this._options.push(option);

			if (this.viewMode === ViewMode.Views && this.views.getActiveView() === view) {
				option.checked = true;
				option.enabled = false;
			}
		});

		if (this.viewMode === ViewMode.Notebook) {
			backToNotebookButton.checked = true;
			backToNotebookButton.enabled = false;
		}

		this._optionsUpdated.fire(true);
	}

	public get onUpdated(): Event<boolean> {
		return this._optionsUpdated.event;
	}

	public optionSelected(displayName: string): void {
		const view = this.views.getViews().find(view => view.name === displayName);
		this.views.setActiveView(view);
	}
}

/**
 * Action to open a Notebook View
 */
export class DashboardViewAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotebookService private _notebookService: INotebookService,
		@INotificationService private _notificationService: INotificationService,
	) {
		super(id, label, cssClass);
	}

	public override async run(context: URI): Promise<void> {
		if (context) {
			const editor = this._notebookService.findNotebookEditor(context);
			let views = editor.views;
			const view = views.getViews().find(view => view.guid === this.id);

			if (view) {
				views.setActiveView(view);
				editor.model.viewMode = ViewMode.Views;
			} else {
				this._notificationService.error(localize('viewNotFound', "Unable to find view: {0}", this.id));
			}
		}
	}
}

/**
 * Action to open enter the default notebook editor
 */
export class NotebookViewAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
	}
	public override async run(context: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(context);
		editor.model.viewMode = ViewMode.Notebook;
	}
}

export class CreateNotebookViewAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, label, cssClass);
	}
	public override async run(context: URI): Promise<void> {
		if (context) {
			const editor = this._notebookService.findNotebookEditor(context);
			const views = editor.views;

			const newView = views.createNewView();
			views.setActiveView(newView);

			editor.model.viewMode = ViewMode.Views;
			editor.model.serializationStateChanged(NotebookChangeType.MetadataChanged);
		}
	}
}

export class TrustedAction extends ToggleableAction {
	// Constants
	private static readonly trustedLabel = localize('trustLabel', "Trusted");
	private static readonly notTrustedLabel = localize('untrustLabel', "Not Trusted");
	private static readonly previewTrustedCssClass = 'icon-shield';
	private static readonly trustedCssClass = 'icon-trusted';
	private static readonly previewNotTrustedCssClass = 'icon-shield-x';
	private static readonly notTrustedCssClass = 'icon-notTrusted';

	constructor(
		id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService
	) {
		super(id, {
			baseClass: baseIconClass,
			toggleOnLabel: TrustedAction.trustedLabel,
			toggleOnClass: toggleTooltip === true ? TrustedAction.previewTrustedCssClass : TrustedAction.trustedCssClass,
			toggleOffLabel: TrustedAction.notTrustedLabel,
			toggleOffClass: toggleTooltip === true ? TrustedAction.previewNotTrustedCssClass : TrustedAction.notTrustedCssClass,
			maskedIconClass: maskedIconClass,
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

	public override async run(context: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(context);
		this.trusted = !this.trusted;
		editor.model.trustedMode = this.trusted;
	}
}

// Action to run all code cells in a notebook.
export class RunAllCellsAction extends Action {
	constructor(
		id: string, label: string, cssClass: string,
		@INotificationService private notificationService: INotificationService,
		@INotebookService private _notebookService: INotebookService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
	) {
		super(id, label, cssClass);
	}
	public override async run(context: URI): Promise<void> {
		try {
			const editor = this._notebookService.findNotebookEditor(context);
			await editor.runAllCells();

			const azdata_notebook_guid: string = editor.model.getMetaValue('azdata_notebook_guid');
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.NbTelemetryAction.RunAll)
				.withAdditionalProperties({ azdata_notebook_guid })
				.send();
		} catch (e) {
			this.notificationService.error(getErrorMessage(e));
		}
	}
}

export class CollapseCellsAction extends ToggleableAction {
	private static readonly collapseCells = localize('collapseAllCells', "Collapse Cells");
	private static readonly expandCells = localize('expandAllCells', "Expand Cells");
	private static readonly previewCollapseCssClass = 'icon-collapse-cells';
	private static readonly collapseCssClass = 'icon-hide-cells';
	private static readonly previewExpandCssClass = 'icon-expand-cells';
	private static readonly expandCssClass = 'icon-show-cells';

	constructor(id: string, toggleTooltip: boolean,
		@INotebookService private _notebookService: INotebookService) {
		super(id, {
			baseClass: baseIconClass,
			toggleOnLabel: CollapseCellsAction.expandCells,
			toggleOnClass: toggleTooltip === true ? CollapseCellsAction.previewExpandCssClass : CollapseCellsAction.expandCssClass,
			toggleOffLabel: CollapseCellsAction.collapseCells,
			toggleOffClass: toggleTooltip === true ? CollapseCellsAction.previewCollapseCssClass : CollapseCellsAction.collapseCssClass,
			maskedIconClass: maskedIconClass,
			shouldToggleTooltip: toggleTooltip,
			isOn: false
		});
		this.expanded = true;
	}

	public get isCollapsed(): boolean {
		return this.state.isOn;
	}
	private setCollapsed(value: boolean) {
		this.toggle(value);
		this.expanded = !value;
	}

	public override async run(context: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(context);
		this.setCollapsed(!this.isCollapsed);
		editor.cells.forEach(cell => {
			cell.isCollapsed = this.isCollapsed;
		});
	}
}

export class RunParametersAction extends TooltipFromLabelAction {
	private static readonly label = localize('runParameters', "Run with Parameters");
	private static readonly iconClass = 'icon-run-with-parameters';

	constructor(id: string,
		toggleTooltip: boolean,
		context: URI,
		@IQuickInputService private quickInputService: IQuickInputService,
		@INotebookService private _notebookService: INotebookService,
		@INotificationService private notificationService: INotificationService,
	) {
		super(id, {
			label: RunParametersAction.label,
			baseClass: baseIconClass,
			iconClass: RunParametersAction.iconClass,
			maskedIconClass: maskedIconClass,
			shouldToggleTooltip: toggleTooltip
		});
	}

	/**
	 * Gets Default Parameters in Notebook from Parameter Cell
	 * Uses that as Placeholder values for user to inject new values for
	 * Once user enters all values it will open the new parameterized notebook
	 * with injected parameters value from the QuickInput
	*/
	public override async run(context: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(context);
		// Only run action for kernels that are supported (Python, PySpark, PowerShell)
		let supportedKernels: string[] = [KernelsLanguage.Python, KernelsLanguage.PowerShell];
		if (!supportedKernels.includes(editor.model.languageInfo.name)) {
			// If the kernel is not supported indicate to user to use supported kernels
			this.notificationService.notify({
				severity: Severity.Info,
				message: kernelNotSupported,
			});
			return;
		}
		// Set defaultParameters to the parameter values in parameter cell
		let defaultParameters = new Map<string, string>();
		for (let cell of editor?.cells) {
			if (cell.isParameter) {
				// Check if parameter cell is empty
				const cellSource = typeof cell.source === 'string' ? [cell.source] : cell.source;
				// Check to see if every line in the cell is empty or contains whitespace
				const emptyParameterCell = cellSource.every(s => /^\s*$/.test(s));
				if (emptyParameterCell) {
					// If there is no parameters in the cell indicate to user to add them
					this.notificationService.notify({
						severity: Severity.Info,
						message: noParametersInCell,
					});
					return;
				}
				for (let parameter of cell.source) {
					// Only add parameters that contain the proper parameters format (ex. x = 1) shown in the Parameterization Doc.
					if (parameter.includes('=')) {
						let param = parameter.split('=', 2);
						defaultParameters.set(param[0].trim(), param[1].trim());
					}
				}
			}
		}

		// Store new parameters values the user inputs
		let inputParameters = new Map<string, string>();
		let uriParams = new URLSearchParams();
		// Store new parameter values to map based off defaultParameters
		if (defaultParameters.size === 0) {
			// If there is no parameter cell indicate to user to create one
			this.notificationService.notify({
				severity: Severity.Info,
				message: noParameterCell,
			});
			return;
		} else {
			for (let key of defaultParameters.keys()) {
				let newParameterValue = await this.quickInputService.input({ prompt: key, value: defaultParameters.get(key), ignoreFocusLost: true });
				// If user cancels or escapes then it stops the action entirely
				if (newParameterValue === undefined) {
					return;
				}
				inputParameters.set(key, newParameterValue);
			}
			// Format the new parameters to be append to the URI
			for (let key of inputParameters.keys()) {
				// Will only add new injected parameters when the value is not the same as the defaultParameters values
				if (inputParameters.get(key) !== defaultParameters.get(key)) {
					// For empty strings we need to escape the value
					// so that it is kept when adding uriParams.toString() to filePath
					if (inputParameters.get(key) === '') {
						uriParams.append(key, '\'\'');
					} else {
						uriParams.append(key, inputParameters.get(key));
					}
				}
			}
			let stringParams = unescape(uriParams.toString());
			context = context.with({ query: stringParams });
			return this.openParameterizedNotebook(context);
		}
	}

	/**
	 * This function will be used once the showNotebookDocument can be used
	 * TODO - Call Extensibility API for ShowNotebook
	 * (showNotebookDocument to be utilized in Notebook Service)
	**/
	public async openParameterizedNotebook(uri: URI): Promise<void> {
		const editor = this._notebookService.findNotebookEditor(uri);
		let modelContents = editor.model.toJSON();
		modelContents.cells.forEach(cell => {
			cell.outputs = [];
		});
		let untitledUriPath = this._notebookService.getUntitledUriPath(path.basename(uri.fsPath));
		let untitledUri = uri.with({ authority: '', scheme: 'untitled', path: untitledUriPath });
		this._notebookService.openNotebook(untitledUri, {
			initialContent: JSON.stringify(modelContents),
			preserveFocus: true
		});
	}
}

const showAllKernelsConfigName = 'notebook.showAllKernels';
const workbenchPreviewConfigName = 'workbench.enablePreviewFeatures';
export const noKernelName = localize('noKernel', "No Kernel");
const kernelDropdownElementId = 'kernel-dropdown';

export class KernelsDropdown extends SelectBox {
	private model: NotebookModel;
	private _showAllKernels: boolean = false;
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<INotebookModel>, @IConfigurationService private _configurationService: IConfigurationService,
	) {
		super([msgLoading], msgLoading, contextViewProvider, container, { labelText: kernelLabel, labelOnTop: false, ariaLabel: kernelLabel, id: kernelDropdownElementId } as ISelectBoxOptionsWithLabel);

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
			this.updateKernel(changedArgs.newValue, changedArgs.nbKernelAlias);
		}));
		let kernel = this.model.clientSession && this.model.clientSession.kernel;
		this.updateKernel(kernel);
	}

	// Update SelectBox values
	public updateKernel(kernel: azdata.nb.IKernel, nbKernelAlias?: string) {
		let kernels: string[] = this._showAllKernels ? [...new Set(this.model.specs.kernels.map(a => a.display_name).concat(this.model.standardKernelsDisplayName()))]
			: this.model.standardKernelsDisplayName();
		if (this.model.kernelAliases?.length) {
			for (let x in this.model.kernelAliases) {
				kernels.splice(1, 0, this.model.kernelAliases[x]);
			}
		}
		if (kernel && kernel.isReady) {
			let standardKernel = this.model.getStandardKernelFromName(kernel.name);
			if (kernels) {
				let index;
				if (standardKernel) {
					index = kernels.findIndex(kernel => kernel === standardKernel.displayName);
				} else {
					let kernelSpec = this.model.specs.kernels.find(k => k.name === kernel.name);
					index = kernels.findIndex(k => k === kernelSpec?.display_name);
				}
				if (nbKernelAlias) {
					index = kernels.indexOf(nbKernelAlias);
				}
				// This is an error case that should never happen
				// Just in case, setting index to 0
				if (index < 0) {
					index = 0;
				}
				this.setOptions(kernels, index);
				this.model.selectedKernelDisplayName = kernels[index];
			}
		} else if (this.model.clientSession?.isInErrorState) {
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

const attachToDropdownElementId = 'attach-to-dropdown';
const saveConnectionNameConfigName = 'notebook.saveConnectionName';

export class AttachToDropdown extends SelectBox {
	private model: NotebookModel;

	constructor(
		container: HTMLElement, contextViewProvider: IContextViewProvider, modelReady: Promise<INotebookModel>,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@INotificationService private _notificationService: INotificationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false, ariaLabel: attachToLabel, id: attachToDropdownElementId } as ISelectBoxOptionsWithLabel);
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
		} else if (this.model.clientSession?.isInErrorState) {
			this.setOptions([localize('noContextAvailable', "None")], 0);
		}
	}

	private getKernelDisplayName(): string {
		let kernelDisplayName: string;
		if (this.model.clientSession && this.model.clientSession.kernel && this.model.clientSession.kernel.name) {
			let currentKernelName = this.model.clientSession.kernel.name.toLowerCase();
			let currentKernelSpec = this.model.specs.kernels.find(kernel => kernel.name && kernel.name.toLowerCase() === currentKernelName);
			if (currentKernelSpec) {
				//KernelDisplayName should be Kusto when connecting to Kusto connection
				if ((this.model.context?.serverCapabilities.notebookKernelAlias && this.model.currentKernelAlias === this.model.context?.serverCapabilities.notebookKernelAlias) || (this.model.kernelAliases.includes(this.model.selectedKernelDisplayName) && this.model.selectedKernelDisplayName)) {
					kernelDisplayName = this.model.context?.serverCapabilities.notebookKernelAlias || this.model.selectedKernelDisplayName;
				} else {
					kernelDisplayName = currentKernelSpec.display_name;
				}
			}
		}
		return kernelDisplayName;
	}

	// Load "Attach To" dropdown with the values corresponding to Kernel dropdown
	public loadAttachToDropdown(model: INotebookModel, currentKernel: string, showSelectConnection?: boolean): void {
		let connProviderIds = this.model.getApplicableConnectionProviderIds(currentKernel);
		if ((connProviderIds && connProviderIds.length === 0) || currentKernel === noKernel) {
			this.setOptions([msgLocalHost]);
		} else {
			let connections: string[] = [];
			if (model.context && model.context.title && (connProviderIds.includes(this.model.context.providerName))) {
				connections.push(model.context.title);
			} else if (this._configurationService.getValue(saveConnectionNameConfigName) && model.savedConnectionName) {
				connections.push(model.savedConnectionName);
			} else {
				connections.push(msgSelectConnection);
			}
			if (!connections.find(x => x === msgChangeConnection)) {
				connections.push(msgChangeConnection);
			}
			this.setOptions(connections, 0);
			this.enable();

			if (this.model.kernelAliases.includes(currentKernel) && this.model.selectedKernelDisplayName !== currentKernel) {
				this.model.changeKernel(currentKernel);
			}
		}
	}

	public doChangeContext(connection?: ConnectionProfile, hideErrorMessage?: boolean): void {
		if (this.value === msgChangeConnection) {
			this.openConnectionDialog().catch(err => this._notificationService.error(getErrorMessage(err)));
		} else if (this.value === msgSelectConnection) {
			// no-op, select connection is the default option and so shouldn't have any action done when selected (which only happens if a user cancels out of the connection dialog)
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
			// Get all providers to show all available connections in connection dialog
			let providers = this.model.getApplicableConnectionProviderIds(this.model.clientSession.kernel.name);
			// Spark kernels are unable to get providers from above, therefore ensure that we get the
			// correct providers for the selected kernel and load the proper connections for the connection dialog
			// Example Scenario: Spark Kernels should only have MSSQL connections in connection dialog
			if (!this.model.kernelAliases.includes(this.model.selectedKernelDisplayName) && this.model.clientSession.kernel.name !== 'SQL') {
				providers = providers.concat(this.model.getApplicableConnectionProviderIds(this.model.selectedKernelDisplayName));
			} else {
				for (let alias of this.model.kernelAliases) {
					providers = providers.concat(this.model.getApplicableConnectionProviderIds(alias));
				}
			}
			let connection = await this._connectionDialogService.openDialogAndWait(this._connectionManagementService,
				{
					connectionType: ConnectionType.editor,
					providers: providers
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

			let index = attachToConnections.findIndex(connection => connection === connectedServer);
			this.setOptions([]);
			this.setOptions(attachToConnections);
			if (!index || index < 0 || index >= attachToConnections.length) {
				index = 0;
			}
			this.select(index);

			this.model.addAttachToConnectionsToBeDisposed(connectionUri);
			// Call doChangeContext to set the newly chosen connection in the model
			this.doChangeContext(connectionProfile);

			//Changes kernel based on connection attached to
			if (this.model.kernelAliases.includes(connectionProfile.serverCapabilities.notebookKernelAlias)) {
				this.model.changeKernel(connectionProfile.serverCapabilities.notebookKernelAlias);
			} else if (this.model.clientSession.kernel.name === 'SQL') {
				this.model.changeKernel('SQL');
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

export class NewNotebookAction extends Action {

	public static readonly ID = 'notebook.command.new';
	public static readonly LABEL = localize('newNotebookAction', "New Notebook");

	public static readonly INTERNAL_NEW_NOTEBOOK_CMD_ID = '_notebook.command.new';
	constructor(
		id: string,
		label: string,
		@ICommandService private commandService: ICommandService,
		@IObjectExplorerService private objectExplorerService: IObjectExplorerService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
	) {
		super(id, label);
		this.class = 'notebook-action new-notebook';
	}

	override async run(context?: azdata.ObjectExplorerContext): Promise<void> {
		this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.Notebook, TelemetryKeys.NbTelemetryAction.NewNotebookFromConnections)
			.withConnectionInfo(context?.connectionProfile)
			.send();
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
