/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { localize } from 'vs/nls';
import { ToggleableAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { CellActionBase, CellContext } from 'sql/workbench/contrib/notebook/browser/cellViews/codeActions';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { getErrorMessage } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';

/**
 * Not yet implemeneted
 * Goal: show more actions available depending on what cell the toolbar is for.
 * (ie. runAlActions when on code cell.)
 */
export class MoreActions extends Action {

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
}
/**
 * Todo: When a code cell is selected, the cursor focus is already set to the field within it. The below method needs to check for the active state first, then set the icon accordingly.
 */
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
		// Toggle icon
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
