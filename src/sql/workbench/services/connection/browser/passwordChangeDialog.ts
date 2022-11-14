/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/profilerFilterDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachButtonStyler, attachSelectBoxStyler } from 'vs/platform/theme/common/styler';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ProfilerFilter, ProfilerFilterClause, ProfilerFilterClauseOperator, IProfilerService } from 'sql/workbench/services/profiler/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';


const ClearText: string = localize('profilerFilterDialog.clear', "Clear all");
const OkText: string = localize('profilerFilterDialog.ok', "OK");
const CancelText: string = localize('profilerFilterDialog.cancel', "Cancel");
const DialogTitle: string = localize('profilerFilterDialog.title', "Change Password");
const TitleIconClass: string = 'icon filterLabel';

const FieldText: string = localize('profilerFilterDialog.fieldColumn', "Field");
const OperatorText: string = localize('profilerFilterDialog.operatorColumn', "Operator");
const ValueText: string = localize('profilerFilterDialog.valueColumn', "Value");

const Equals: string = '=';
const NotEquals: string = '<>';
const LessThan: string = '<';
const LessThanOrEquals: string = '<=';
const GreaterThan: string = '>';
const GreaterThanOrEquals: string = '>=';
const IsNull: string = localize('profilerFilterDialog.isNullOperator', "Is Null");
const IsNotNull: string = localize('profilerFilterDialog.isNotNullOperator', "Is Not Null");
const Contains: string = localize('profilerFilterDialog.containsOperator', "Contains");
const NotContains: string = localize('profilerFilterDialog.notContainsOperator', "Not Contains");
const StartsWith: string = localize('profilerFilterDialog.startsWithOperator', "Starts With");
const NotStartsWith: string = localize('profilerFilterDialog.notStartsWithOperator', "Not Starts With");

export class PasswordChangeDialog extends Modal {

	private _clauseBuilder?: HTMLElement;
	private _okButton?: Button;
	private _cancelButton?: Button;
	private _profile: IConnectionProfile;
	private _params: INewConnectionParams;
	private _uri: string;
	private _clauseRows: ClauseRowUI[] = [];


	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IProfilerService private profilerService: IProfilerService,
		@IConnectionDialogService private connectionDialogService: IConnectionDialogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', '', telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true });
	}

	public open(profile: IConnectionProfile, params: INewConnectionParams, uri: string) {
		this._profile = profile;
		this._params = params;
		this._uri = uri;
		this.render();
		this.show();
		this._okButton!.focus();
	}

	public override dispose(): void {

	}

	public override render() {
		super.render();
		this.title = DialogTitle;
		this.titleIconClassName = TitleIconClass;
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(OkText, () => this.handleOkButtonClick());
		this._cancelButton = this.addFooterButton(CancelText, () => this.hide('cancel'), 'right', true);
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.profiler-filter-dialog'));
		const clauseTableContainer = DOM.append(body, DOM.$('.clause-table-container'));
		this._clauseBuilder = DOM.append(clauseTableContainer, DOM.$('table.profiler-filter-clause-table'));
		const headerRow = DOM.append(this._clauseBuilder, DOM.$('tr'));
		DOM.append(headerRow, DOM.$('td')).innerText = FieldText;
		DOM.append(headerRow, DOM.$('td')).innerText = OperatorText;
		DOM.append(headerRow, DOM.$('td')).innerText = ValueText;
		DOM.append(headerRow, DOM.$('td')).innerText = '';

		this.createClauseTableActionLink(ClearText, body, () => { this.handleClearButtonClick(); });
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	/* espace key */
	protected override onClose() {
		this.hide('close');
	}

	/* enter key */
	protected override onAccept() {
		this.handleOkButtonClick();
	}

	private handleOkButtonClick(): void {
		//TODO - verify password here before continuing.
		this.connectionDialogService.changePasswordFunction(this._profile, this._params, this._uri, '');
		this.hide('ok');
	}

	private handleClearButtonClick() {
		this._clauseRows.forEach(clause => {
			clause.row.remove();
		});
		this._clauseRows = [];
	}

	private createClauseTableActionLink(text: string, parent: HTMLElement, handler: () => void): void {
		const actionLink = DOM.append(parent, DOM.$('.profiler-filter-clause-table-action', {
			'tabIndex': '0',
			'role': 'button'
		}));
		actionLink.innerText = text;
		DOM.addDisposableListener(actionLink, DOM.EventType.CLICK, handler);
		DOM.addStandardDisposableListener(actionLink, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				handler();
				e.stopPropagation();
			}
		});
	}

	private createSelectBox(container: HTMLElement, options: string[], selectedOption: string, ariaLabel: string): SelectBox {
		const dropdown = new SelectBox(options, selectedOption, this.contextViewService, undefined, { ariaLabel: ariaLabel });
		dropdown.render(container);
		this._register(attachSelectBoxStyler(dropdown, this._themeService));
		return dropdown;
	}

	private saveFilter(): void {
		this.profilerService.saveFilter(this.getFilter()).catch(e => onUnexpectedError(e));
	}

	private loadSavedFilter(): void {
		// for now we only have one saved filter, this is enough for what user asked for so far.
		const savedFilters = this.profilerService.getFilters();
		if (savedFilters && savedFilters.length > 0) {
			const savedFilter = savedFilters[0];
			this._clauseRows.forEach(clause => {
				clause.row.remove();
			});
			this._clauseRows = [];
			savedFilter.clauses.forEach(clause => {
			});
		}
	}

	private getFilter(): ProfilerFilter {
		const clauses: ProfilerFilterClause[] = [];

		this._clauseRows.forEach(row => {
			clauses.push({
				field: row.field.value,
				operator: this.convertToOperatorEnum(row.operator.value),
				value: row.value.value
			});
		});

		return {
			name: 'default',
			clauses: clauses
		};
	}

	private removeRow(clauseId: string) {
		const idx = this._clauseRows.findIndex(entry => { return entry.id === clauseId; });
		if (idx !== -1) {
			this._clauseRows[idx].row.remove();
			this._clauseRows.splice(idx, 1);
		}
	}
	private convertToOperatorEnum(operator: string): ProfilerFilterClauseOperator {
		switch (operator) {
			case Equals:
				return ProfilerFilterClauseOperator.Equals;
			case NotEquals:
				return ProfilerFilterClauseOperator.NotEquals;
			case LessThan:
				return ProfilerFilterClauseOperator.LessThan;
			case LessThanOrEquals:
				return ProfilerFilterClauseOperator.LessThanOrEquals;
			case GreaterThan:
				return ProfilerFilterClauseOperator.GreaterThan;
			case GreaterThanOrEquals:
				return ProfilerFilterClauseOperator.GreaterThanOrEquals;
			case IsNull:
				return ProfilerFilterClauseOperator.IsNull;
			case IsNotNull:
				return ProfilerFilterClauseOperator.IsNotNull;
			case Contains:
				return ProfilerFilterClauseOperator.Contains;
			case NotContains:
				return ProfilerFilterClauseOperator.NotContains;
			case StartsWith:
				return ProfilerFilterClauseOperator.StartsWith;
			case NotStartsWith:
				return ProfilerFilterClauseOperator.NotStartsWith;
			default:
				throw new Error(`Not a valid operator: ${operator}`);
		}
	}

	private convertToOperatorString(operator: ProfilerFilterClauseOperator): string {
		switch (operator) {
			case ProfilerFilterClauseOperator.Equals:
				return Equals;
			case ProfilerFilterClauseOperator.NotEquals:
				return NotEquals;
			case ProfilerFilterClauseOperator.LessThan:
				return LessThan;
			case ProfilerFilterClauseOperator.LessThanOrEquals:
				return LessThanOrEquals;
			case ProfilerFilterClauseOperator.GreaterThan:
				return GreaterThan;
			case ProfilerFilterClauseOperator.GreaterThanOrEquals:
				return GreaterThanOrEquals;
			case ProfilerFilterClauseOperator.IsNull:
				return IsNull;
			case ProfilerFilterClauseOperator.IsNotNull:
				return IsNotNull;
			case ProfilerFilterClauseOperator.Contains:
				return Contains;
			case ProfilerFilterClauseOperator.NotContains:
				return NotContains;
			case ProfilerFilterClauseOperator.StartsWith:
				return StartsWith;
			case ProfilerFilterClauseOperator.NotStartsWith:
				return NotStartsWith;
			default:
				throw new Error(`Not a valid operator: ${operator}`);
		}
	}
}

interface ClauseRowUI {
	id: string;
	row: HTMLElement;
	field: SelectBox;
	operator: SelectBox;
	value: InputBox;
}
