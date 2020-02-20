/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as types from 'vs/base/common/types';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';

import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { ICellModel, CellExecutionState } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ILogService } from 'vs/platform/log/common/log';
import { getErrorMessage } from 'vs/base/common/errors';

let notebookMoreActionMsg = localize('notebook.failed', "Please select active cell and try again");
const emptyExecutionCountLabel = '[ ]';
const HIDE_ICON_CLASS = ' hideIcon';

function hasModelAndCell(context: CellContext, notificationService: INotificationService): boolean {
	if (!context || !context.model) {
		return false;
	}
	if (context.cell === undefined) {
		notificationService.notify({
			severity: Severity.Error,
			message: notebookMoreActionMsg
		});
		return false;
	}
	return true;
}

export class CellContext {
	constructor(public model: NotebookModel, private _cell?: ICellModel) {
	}

	public get cell(): ICellModel {
		return this._cell ? this._cell : this.model.activeCell;
	}
}

export abstract class CellActionBase extends Action {

	constructor(id: string, label: string, icon: string, protected notificationService: INotificationService) {
		super(id, label, icon);
	}

	public canRun(context: CellContext): boolean {
		return true;
	}

	public run(context: CellContext): Promise<boolean> {
		if (hasModelAndCell(context, this.notificationService)) {
			return this.doRun(context).then(() => true);
		}
		return Promise.resolve(true);
	}

	abstract doRun(context: CellContext): Promise<void>;
}

interface IActionStateData {
	className?: string;
	label?: string;
	tooltip?: string;
	hideIcon?: boolean;
	commandId?: string;
}

class IMultiStateData<T> {
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

abstract class MultiStateAction<T> extends Action {
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

export class RunCellAction extends MultiStateAction<CellExecutionState> {
	public static ID = 'notebook.runCell';
	public static LABEL = 'Run cell';
	private _executionChangedDisposable: IDisposable;
	private _context: CellContext;
	constructor(context: CellContext, @INotificationService private notificationService: INotificationService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IKeybindingService keybindingService: IKeybindingService,
		@ILogService logService: ILogService
	) {
		super(RunCellAction.ID, new IMultiStateData<CellExecutionState>([
			{ key: CellExecutionState.Hidden, value: { label: emptyExecutionCountLabel, className: '', tooltip: '', hideIcon: true } },
			{ key: CellExecutionState.Stopped, value: { label: '', className: 'toolbarIconRun', tooltip: localize('runCell', "Run cell"), commandId: 'notebook.command.runactivecell' } },
			{ key: CellExecutionState.Running, value: { label: '', className: 'toolbarIconStop', tooltip: localize('stopCell', "Cancel execution") } },
			{ key: CellExecutionState.Error, value: { label: '', className: 'toolbarIconRunError', tooltip: localize('errorRunCell', "Error on last run. Click to run again") } },
		], CellExecutionState.Hidden), keybindingService, logService);
		this.ensureContextIsUpdated(context);
	}

	public run(context?: CellContext): Promise<boolean> {
		return this.doRun(context).then(() => true);
	}

	public async doRun(context: CellContext): Promise<void> {
		this.ensureContextIsUpdated(context);
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
		let label = emptyExecutionCountLabel;
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
