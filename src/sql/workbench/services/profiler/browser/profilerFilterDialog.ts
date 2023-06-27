/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/profilerFilterDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { ProfilerInput } from 'sql/workbench/browser/editor/profiler/profilerInput';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachSelectBoxStyler } from 'sql/platform/theme/common/vsstyler';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { generateUuid } from 'vs/base/common/uuid';
import * as DOM from 'vs/base/browser/dom';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { ProfilerFilter, ProfilerFilterClause, ProfilerFilterClauseOperator, IProfilerService } from 'sql/workbench/services/profiler/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import * as aria from 'vs/base/browser/ui/aria/aria';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';

const ClearText: string = localize('profilerFilterDialog.clear', "Clear all");
const ApplyText: string = localize('profilerFilterDialog.apply', "Apply");
const OkText: string = localize('profilerFilterDialog.ok', "OK");
const CancelText: string = localize('profilerFilterDialog.cancel', "Cancel");
const DialogTitle: string = localize('profilerFilterDialog.title', "Filters");
const RemoveText: string = localize('profilerFilterDialog.remove', "Remove this clause");
const SaveFilterText: string = localize('profilerFilterDialog.saveFilter', "Save Filter");
const LoadFilterText: string = localize('profilerFilterDialog.loadFilter', "Load Filter");
const AddClauseText: string = localize('profilerFilterDialog.addClauseText', "Add a clause");
const NewClauseAddedText: string = localize('profilerFilterDialog.newClauseAdded', "A new clause has been added.");
const AllClausesClearedText: string = localize('profilerFilterDialog.allClausesCleared', "All clauses have been cleared.");
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

const Operators = [Equals, NotEquals, LessThan, LessThanOrEquals, GreaterThan, GreaterThanOrEquals, GreaterThan, GreaterThanOrEquals, IsNull, IsNotNull, Contains, NotContains, StartsWith, NotStartsWith];

export class ProfilerFilterDialog extends Modal {

	private _clauseBuilder?: HTMLElement;
	private _okButton?: Button;
	private _cancelButton?: Button;
	private _applyButton?: Button;
	private _loadFilterButton?: Button;
	private _saveFilterButton?: Button;
	private _input?: ProfilerInput;
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
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', TelemetryKeys.ModalDialogName.ProfilerFilter, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true });
	}

	public open(input: ProfilerInput) {
		this._input = input;
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
		this._saveFilterButton = this.addFooterButton(SaveFilterText, () => this.saveFilter(), 'left', true);
		this._loadFilterButton = this.addFooterButton(LoadFilterText, () => this.loadSavedFilter(), 'left', true);
		this._applyButton = this.addFooterButton(ApplyText, () => this.filterSession(), 'right', true);
		this._okButton = this.addFooterButton(OkText, () => this.handleOkButtonClick());
		this._cancelButton = this.addFooterButton(CancelText, () => this.hide('cancel'), 'right', true);
		this._register(this._okButton);
		this._register(this._cancelButton);
		this._register(this._applyButton);
		this._register(this._saveFilterButton);
		this._register(this._loadFilterButton);
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.profiler-filter-dialog'));
		const clauseTableContainer = DOM.append(body, DOM.$('.clause-table-container'));
		const actionsContainer = DOM.append(body, DOM.$('.actions-container'));
		this._clauseBuilder = DOM.append(clauseTableContainer, DOM.$('table.profiler-filter-clause-table'));
		const headerRow = DOM.append(this._clauseBuilder, DOM.$('tr'));
		DOM.append(headerRow, DOM.$('th')).innerText = FieldText;
		DOM.append(headerRow, DOM.$('th')).innerText = OperatorText;
		DOM.append(headerRow, DOM.$('th')).innerText = ValueText;
		DOM.append(headerRow, DOM.$('th')).innerText = '';

		this._input!.filter.clauses.forEach(clause => {
			this.addClauseRow(true, clause.field, this.convertToOperatorString(clause.operator), clause.value);
		});



		this.createClauseTableActionLink(AddClauseText, actionsContainer, () => {
			this.addClauseRow(false);
			// Set keyboard focus to the newly added clause.
			this._clauseRows[this._clauseRows.length - 1]?.field?.focus();
			aria.status(NewClauseAddedText);
		});
		this.createClauseTableActionLink(ClearText, actionsContainer, () => { this.handleClearButtonClick(); });
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
		this.filterSession();
		this.hide('ok');
	}

	private handleClearButtonClick() {
		this._clauseRows.forEach(clause => {
			clause.row.remove();
		});
		this._clauseRows = [];
		aria.status(AllClausesClearedText);
	}

	private createClauseTableActionLink(text: string, parent: HTMLElement, handler: () => void): void {
		const actionLink = DOM.append(parent, DOM.$('.profiler-filter-clause-table-action', {
			'tabIndex': '0',
			'role': 'button',
			'aria-label': text
		}));
		actionLink.innerText = text;
		DOM.addDisposableListener(actionLink, DOM.EventType.CLICK, handler);
		DOM.addStandardDisposableListener(actionLink, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				handler();
				e.preventDefault();
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

	private filterSession(): void {
		this._input!.filterSession(this.getFilter());
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
				this.addClauseRow(true, clause.field, this.convertToOperatorString(clause.operator), clause.value);
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

	private addClauseRow(setInitialValue: boolean, field?: string, operator?: string, value?: string): void {
		const columns = this._input!.columns.map(column => column.name);
		if (field && !columns.find(x => x === field)) {
			return;
		}

		const row = DOM.append(this._clauseBuilder!, DOM.$('tr'));
		const clauseId = generateUuid();

		const fieldDropDown = this.createSelectBox(DOM.append(row, DOM.$('td')), columns, columns[0], FieldText);

		const operatorDropDown = this.createSelectBox(DOM.append(row, DOM.$('td')), Operators, Operators[0], OperatorText);

		const valueText = new InputBox(DOM.append(row, DOM.$('td')), this.contextViewService, {
			ariaLabel: ValueText,
			inputBoxStyles: defaultInputBoxStyles
		});

		const removeCell = DOM.append(row, DOM.$('td'));
		const removeClauseButton = DOM.append(removeCell, DOM.$('.profiler-filter-remove-condition.codicon.remove', {
			'tabIndex': '0',
			'aria-label': RemoveText,
			'title': RemoveText,
			'role': 'button'
		}));

		DOM.addStandardDisposableListener(removeClauseButton, DOM.EventType.KEY_DOWN, (e: StandardKeyboardEvent) => {
			if (e.equals(KeyCode.Space) || e.equals(KeyCode.Enter)) {
				this.removeRow(clauseId);
				e.stopPropagation();
			}
		});

		DOM.addDisposableListener(removeClauseButton, DOM.EventType.CLICK, (e: MouseEvent) => {
			this.removeRow(clauseId);
		});

		if (setInitialValue) {
			fieldDropDown.selectWithOptionName(field);
			operatorDropDown.selectWithOptionName(operator);
			valueText.value = value ?? '';
		}

		this._clauseRows.push({
			id: clauseId,
			row,
			field: fieldDropDown,
			operator: operatorDropDown,
			value: valueText
		});
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
