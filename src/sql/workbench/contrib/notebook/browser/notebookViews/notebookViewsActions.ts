/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { ViewOptionsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/viewOptionsModal';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { localize } from 'vs/nls';
import { InsertCellsModal } from 'sql/workbench/contrib/notebook/browser/notebookViews/insertCellsModal';
import { ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IDisposable } from 'vs/base/common/lifecycle';
import { CellExecutionState, ICellModel, ViewMode } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { CellActionBase, CellContext, IMultiStateData, MultiStateAction } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILogService } from 'vs/platform/log/common/log';
import { getErrorMessage } from 'vs/base/common/errors';
import * as types from 'vs/base/common/types';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { Separator } from 'sql/base/browser/ui/separator/separator';
import { ToggleMoreActions } from 'sql/workbench/contrib/notebook/browser/cellToolbarActions';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

export class ViewSettingsAction extends Action {
	private static readonly ID = 'notebookView.viewSettings';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button settings masked-icon';

	constructor(
		private _context: NotebookViewsExtension,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(ViewSettingsAction.ID, ViewSettingsAction.LABEL, ViewSettingsAction.ICON);
	}

	override async run(): Promise<void> {
		const optionsModal = this._instantiationService.createInstance(ViewOptionsModal, this._context.getActiveView());
		optionsModal.render();
		optionsModal.open();
	}
}

export class DeleteViewAction extends Action {
	private static readonly ID = 'notebookView.deleteView';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button delete masked-icon';

	constructor(
		private _notebookViews: NotebookViewsExtension,
		@IDialogService private readonly dialogService: IDialogService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(DeleteViewAction.ID, DeleteViewAction.LABEL, DeleteViewAction.ICON);
	}

	override async run(): Promise<void> {
		const activeView = this._notebookViews.getActiveView();
		if (activeView) {
			const confirmDelete = await this.confirmDelete(activeView);
			if (confirmDelete) {
				this._notebookViews.removeView(activeView.guid);
				this._notebookViews.notebook.viewMode = ViewMode.Notebook;
			}
		} else {
			this.notificationService.error(localize('viewsUnableToRemove', "Unable to remove view"));
		}
	}

	private async confirmDelete(view: INotebookView): Promise<boolean> {
		const result = await this.dialogService.confirm({
			message: localize('confirmDelete', "Are you sure you want to delete view \"{0}\"?", view.name),
			primaryButton: localize('delete', "&&Delete"),
			type: 'question'
		});

		if (result.confirmed) {
			return true;
		}
		return false;
	}
}

export class InsertCellAction extends Action {
	private static readonly ID = 'notebookView.insertCell';
	private static readonly LABEL = localize('insertCells', "Insert Cells");
	private static readonly ICON = 'notebook-button masked-pseudo add-new';

	constructor(
		private onInsert: (cell: ICellModel) => void,
		private _context: NotebookViewsExtension,
		private _containerRef: ViewContainerRef,
		private _componentFactoryResolver: ComponentFactoryResolver,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		super(InsertCellAction.ID, InsertCellAction.LABEL, InsertCellAction.ICON);
	}

	override async run(): Promise<void> {
		const optionsModal = this._instantiationService.createInstance(InsertCellsModal, this.onInsert, this._context, this._containerRef, this._componentFactoryResolver);
		optionsModal.render();
		optionsModal.open();
	}
}

export class RunCellAction extends MultiStateAction<CellExecutionState> {
	public static ID = 'notebookView.runCell';
	public static LABEL = localize('runCell', "Run cell");
	private _executionChangedDisposable: IDisposable;
	private _context: CellContext;
	constructor(context: CellContext, @INotificationService private notificationService: INotificationService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ILogService logService: ILogService
	) {
		super(RunCellAction.ID, new IMultiStateData<CellExecutionState>([
			{ key: CellExecutionState.Hidden, value: { label: '', className: '', tooltip: '', hideIcon: true } },
			{ key: CellExecutionState.Stopped, value: { label: '', className: 'action-label notebook-button masked-pseudo start-outline masked-icon', tooltip: localize('runCell', "Run cell"), commandId: 'notebook.command.runactivecell' } },
			{ key: CellExecutionState.Running, value: { label: '', className: 'action-label codicon notebook-button toolbarIconStop', tooltip: localize('stopCell', "Cancel execution") } },
			{ key: CellExecutionState.Error, value: { label: '', className: 'toolbarIconRunError', tooltip: localize('errorRunCell', "Error on last run. Click to run again") } },
		], CellExecutionState.Hidden), keybindingService, logService);
		this.ensureContextIsUpdated(context);
	}

	public override run(): Promise<void> {
		return this.doRun();
	}

	public async doRun(): Promise<void> {
		if (!this._context) {
			// TODO should we error?
			return;
		}
		try {
			await this._context.cell.runCell(this.notificationService, this.connectionManagementService);
		} catch (error) {
			let message = getErrorMessage(error);
			this.notificationService.error(message);
		}
	}

	private ensureContextIsUpdated(context: CellContext) {
		if (context && context !== this._context) {
			if (this._executionChangedDisposable) {
				this._executionChangedDisposable.dispose();
			}
			this._context = context;
			this.updateStateAndExecutionCount(context.cell.executionState);
			this._executionChangedDisposable = this._context.cell.onExecutionStateChange((state) => {
				this.updateStateAndExecutionCount(state);
			});
		}
	}

	private updateStateAndExecutionCount(state: CellExecutionState) {
		let label = '';
		let className = '';
		if (!types.isUndefinedOrNull(this._context.cell.executionCount)) {
			label = `[${this._context.cell.executionCount}]`;
			// Heuristic to try and align correctly independent of execution count length. Moving left margin
			// back by a few px seems to make things "work" OK, but isn't a super clean solution
			if (label.length === 4) {
				className = 'execCountTen';
			} else if (label.length > 4) {
				className = 'execCountHundred';
			}
		}
		this.states.updateStateData(CellExecutionState.Hidden, (data) => {
			data.label = label;
			data.className = className;
		});
		this.updateState(state);
	}
}

export class HideCellAction extends Action {
	private static readonly ID = 'notebookView.hideCell';
	private static readonly LABEL = undefined;
	private static readonly ICON = 'notebook-button delete masked-icon';

	constructor(
		private hideFn: () => void,
		private context: any
	) {
		super(HideCellAction.ID, HideCellAction.LABEL, HideCellAction.ICON);
	}

	override async run(): Promise<void> {
		this.hideFn.apply(this.context);
	}
}

export class ViewCellInNotebook extends CellActionBase {
	constructor(id: string, label: string,
		@INotificationService notificationService: INotificationService
	) {
		super(id, label, undefined, notificationService);
	}

	doRun(context: CellContext): Promise<void> {
		try {
			context?.model?.updateActiveCell(context.cell);
			context.model.viewMode = ViewMode.Notebook;
		} catch (error) {
			let message = localize('unableToNavigateToCell', "Unable to navigate to notebook cell.");

			this.notificationService.notify({
				severity: Severity.Error,
				message: message
			});
		}
		return Promise.resolve();
	}
}

export class ViewCellToggleMoreActions {
	private _actions: (Action | CellActionBase)[] = [];
	private _moreActions: ActionBar;
	private _moreActionsElement: HTMLElement;
	constructor(
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		this._actions.push(
			instantiationService.createInstance(ViewCellInNotebook, 'viewCellInNotebook', localize('viewCellInNotebook', "View Cell In Notebook")),
		);
	}

	public onInit(elementRef: HTMLElement, context: CellContext) {
		this._moreActionsElement = elementRef;
		this._moreActionsElement.setAttribute('aria-haspopup', 'menu');
		if (this._moreActionsElement.childNodes.length > 0) {
			this._moreActionsElement.removeChild(this._moreActionsElement.childNodes[0]);
		}
		this._moreActions = new ActionBar(this._moreActionsElement, { orientation: ActionsOrientation.VERTICAL, ariaLabel: localize('moreActionsLabel', "More") });
		this._moreActions.context = { target: this._moreActionsElement };
		let validActions = this._actions.filter(a => a instanceof Separator || a instanceof CellActionBase && a.canRun(context));
		this._moreActions.push(this.instantiationService.createInstance(ToggleMoreActions, validActions, context), { icon: true, label: false });
	}
}
