/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanWidgetBase } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetBase';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import * as errors from 'vs/base/common/errors';
import { Codicon } from 'vs/base/common/codicons';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { attachSelectBoxStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Action } from 'vs/base/common/actions';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { AzDataGraphCell, AzdataGraphView, ExpensiveMetricType } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanWidgetController } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetController';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { Button } from 'sql/base/browser/ui/button/button';
import { searchIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';

const OFF_STRING = localize('executionPlanOff', 'Off');
const ACTUAL_ELAPSED_TIME_STRING = localize('executionPlanActualElapsedTime', 'Actual Elapsed Time');
const ACTUAL_ELAPSED_CPU_TIME_STRING = localize('executionPlanActualElapsedCpuTime', 'Actual Elapsed CPU Time');
const COST_STRING = localize('executionPlanCost', 'Cost');
const SUBTREE_COST_STRING = localize('executionPlanSubtreeCost', 'Subtree Cost');
const ACTUAL_NUMBER_OF_ROWS_FOR_ALL_EXECUTIONS_STRING = localize('actualNumberOfRowsForAllExecutionsAction', 'Actual Number of Rows For All Executions');
const NUMBER_OF_ROWS_READ_STRING = localize('executionPlanNumberOfRowsRead', 'Number of Rows Read');

export class HighlightExpensiveOperationWidget extends ExecutionPlanWidgetBase {
	private _actionBar: ActionBar;

	public expenseMetricSelectBox: SelectBox;
	private _expenseMetricSelectBoxContainer: HTMLElement;
	private _selectedExpensiveOperationType: ExpensiveMetricType = ExpensiveMetricType.Cost;

	constructor(
		public readonly widgetController: ExecutionPlanWidgetController,
		public readonly executionPlanDiagram: AzdataGraphView,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IThemeService public readonly themeService: IThemeService,
		@INotificationService public readonly notificationService: INotificationService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IStorageService private readonly _storageService: IStorageService
	) {
		super(DOM.$('.find-expensive-operation-widget'), 'findExpensiveOperation');

		this.renderAndStyleWidget();
	}

	private getDefaultExpensiveOperationMetric(): ExpensiveMetricType {
		let defaultMetricConfiguration = this._configurationService.getValue<string>('queryEditor.executionPlan.expensiveOperationMetric');

		switch (defaultMetricConfiguration) {
			case 'actualElapsedTime':
				return ExpensiveMetricType.ActualElapsedTime;
			case 'actualElapsedCpuTime':
				return ExpensiveMetricType.ActualElapsedCpuTime;
			case 'cost':
				return ExpensiveMetricType.Cost;
			case 'subtreeCost':
				return ExpensiveMetricType.SubtreeCost;
			case 'actualNumberOfRowsForAllExecutions':
				return ExpensiveMetricType.ActualNumberOfRowsForAllExecutions;
			case 'numberOfRowsRead':
				return ExpensiveMetricType.NumberOfRowsRead;
			default:
				return ExpensiveMetricType.Off;
		}
	}

	private renderAndStyleWidget(): void {
		// Expensive Operation Dropdown
		this._expenseMetricSelectBoxContainer = DOM.$('expensive-operation-name-select-box .dropdown-container');
		const operationLabel = DOM.$('expensive-operation-name-select-box-label');
		operationLabel.innerText = localize('expensiveOperationLabel', 'Metric:');

		this._expenseMetricSelectBoxContainer.appendChild(operationLabel);
		this.container.appendChild(this._expenseMetricSelectBoxContainer);

		this.expenseMetricSelectBox = new SelectBox([
			OFF_STRING,
			ACTUAL_ELAPSED_TIME_STRING,
			ACTUAL_ELAPSED_CPU_TIME_STRING,
			COST_STRING,
			SUBTREE_COST_STRING,
			ACTUAL_NUMBER_OF_ROWS_FOR_ALL_EXECUTIONS_STRING,
			NUMBER_OF_ROWS_READ_STRING
		], COST_STRING, this.contextViewService, this._expenseMetricSelectBoxContainer);

		this.expenseMetricSelectBox.render(this._expenseMetricSelectBoxContainer);
		this._register(attachSelectBoxStyler(this.expenseMetricSelectBox, this.themeService));

		this._expenseMetricSelectBoxContainer.style.width = '200px';
		this._expenseMetricSelectBoxContainer.style.marginRight = '5px';

		this._register(this.expenseMetricSelectBox.onDidSelect(e => {
			switch (e.selected) {
				case ACTUAL_ELAPSED_TIME_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.ActualElapsedTime;
					break;
				case ACTUAL_ELAPSED_CPU_TIME_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.ActualElapsedCpuTime;
					break;
				case COST_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.Cost;
					break;
				case SUBTREE_COST_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.SubtreeCost;
					break;
				case ACTUAL_NUMBER_OF_ROWS_FOR_ALL_EXECUTIONS_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.ActualNumberOfRowsForAllExecutions;
					break;
				case NUMBER_OF_ROWS_READ_STRING:
					this._selectedExpensiveOperationType = ExpensiveMetricType.NumberOfRowsRead;
					break;
				default:
					this._selectedExpensiveOperationType = ExpensiveMetricType.Off;
			}
		}));

		// Apply Button
		const highlightExpensiveOperationAction = new HighlightExpensiveOperationAction();
		this._register(highlightExpensiveOperationAction);

		const clearHighlightExpensiveOperationAction = new TurnOffExpensiveHighlightingOperationAction();
		this._register(clearHighlightExpensiveOperationAction);

		const cancelHighlightExpensiveOperationAction = new CancelHIghlightExpensiveOperationAction();
		this._register(cancelHighlightExpensiveOperationAction);

		const self = this;
		const applyButton = new Button(this.container, {
			title: localize('highlightExpensiveOperationButtonTitle', 'Highlight Expensive Operation')
		});
		applyButton.label = localize('highlightExpensiveOperationApplyButton', 'Apply');

		this._register(applyButton.onDidClick(async e => {
			if (this._selectedExpensiveOperationType === ExpensiveMetricType.Off) {
				await clearHighlightExpensiveOperationAction.run(self);
			}
			else {
				await highlightExpensiveOperationAction.run(self);
			}

			this.showStoreDefaultMetricPrompt();
		}));

		// Adds Action bar
		this._actionBar = new ActionBar(this.container);
		this._actionBar.context = this;
		this._actionBar.pushAction(cancelHighlightExpensiveOperationAction, { label: false, icon: true });
	}

	public showStoreDefaultMetricPrompt(): void {
		const currentDefaultExpensiveOperationMetric = this.getDefaultExpensiveOperationMetric();
		if (this._selectedExpensiveOperationType === currentDefaultExpensiveOperationMetric || !this._storageService.getBoolean('qp.expensiveOperationMetric.showChangeDefaultExpensiveMetricPrompt', StorageScope.GLOBAL, true)) {
			return;
		}

		const infoMessage = localize('queryExecutionPlan.showUpdateDefaultMetricInfo', 'Set chosen metric as the default for query execution plans?');
		const promptChoices = [
			{
				label: localize('qp.expensiveOperationMetric.yes', 'Yes'),
				run: () => this._configurationService.updateValue('queryEditor.executionPlan.expensiveOperationMetric', this._selectedExpensiveOperationType.toString()).catch(e => errors.onUnexpectedError(e))
			},
			{
				label: localize('qp.expensiveOperationMetric.no', 'No'),
				run: () => { }
			},
			{
				label: localize('qp.expensiveOperationMetric.dontShowAgain', "Don't Show Again"),
				run: () => this._storageService.store('qp.expensiveOperationMetric.showChangeDefaultExpensiveMetricPrompt', false, StorageScope.GLOBAL, StorageTarget.USER)
			}
		];

		this.notificationService.prompt(Severity.Info, infoMessage, promptChoices, { sticky: true });
	}

	public focus() {
		this.expenseMetricSelectBox.focus();
	}

	public getExpensiveOperationDelegate(): (cell: AzDataGraphCell) => number | undefined {
		const getElapsedTimeInMs = (cell: AzDataGraphCell): number | undefined => cell.elapsedTimeInMs;
		const getElapsedCpuTimeInMs = (cell: AzDataGraphCell): number | undefined => cell.costMetrics.elapsedCpuTimeInMs;
		const getCost = (cell: AzDataGraphCell): number | undefined => cell.cost;
		const getSubtreeCost = (cell: AzDataGraphCell): number | undefined => cell.subTreeCost;

		const getRowsForAllExecutions = (cell: AzDataGraphCell): number | undefined => {
			if (!cell.costMetrics.actualRows && !cell.costMetrics.estimateRowsForAllExecutions) {
				return undefined;
			}

			let result = Number(cell.costMetrics.actualRows);
			if (!result) {
				result = Number(cell.costMetrics.estimateRowsForAllExecutions);
			}

			if (isNaN(result)) {
				return undefined;
			}

			return result;
		};

		const getNumberOfRowsRead = (cell: AzDataGraphCell): number | undefined => {
			if (!cell.costMetrics.actualRowsRead && !cell.costMetrics.estimatedRowsRead) {
				return undefined;
			}

			let result = Number(cell.costMetrics.actualRowsRead);
			if (!result) {
				result = Number(cell.costMetrics.estimatedRowsRead);
			}

			if (isNaN(result)) {
				return undefined;
			}

			return result;
		};

		let expensiveOperationDelegate = getCost;
		switch (this._selectedExpensiveOperationType) {
			case ExpensiveMetricType.ActualElapsedTime:
				expensiveOperationDelegate = getElapsedTimeInMs;
				break;
			case ExpensiveMetricType.ActualElapsedCpuTime:
				expensiveOperationDelegate = getElapsedCpuTimeInMs;
				break;
			case ExpensiveMetricType.SubtreeCost:
				expensiveOperationDelegate = getSubtreeCost;
				break;
			case ExpensiveMetricType.ActualNumberOfRowsForAllExecutions:
				expensiveOperationDelegate = getRowsForAllExecutions;
				break;
			case ExpensiveMetricType.NumberOfRowsRead:
				expensiveOperationDelegate = getNumberOfRowsRead;
				break;
		}

		return expensiveOperationDelegate;
	}
}

export class HighlightExpensiveOperationAction extends Action {
	public static ID = 'qp.highlightExpensiveOperationAction';
	public static LABEL = localize('highlightExpensiveOperationAction', 'Apply');

	constructor() {
		super(HighlightExpensiveOperationAction.ID, HighlightExpensiveOperationAction.LABEL, searchIconClassNames);
	}

	public override async run(context: HighlightExpensiveOperationWidget): Promise<void> {
		const expensiveOperationDelegate: (cell: AzDataGraphCell) => number | undefined = context.getExpensiveOperationDelegate();

		context.executionPlanDiagram.clearExpensiveOperatorHighlighting();
		let result = context.executionPlanDiagram.highlightExpensiveOperator(expensiveOperationDelegate);
		if (!result) {
			const metric = context.expenseMetricSelectBox.value;
			context.notificationService.warn(localize('invalidPropertyExecutionPlanMetric', 'No nodes found with the {0} metric.', metric));
		}
	}
}

export class TurnOffExpensiveHighlightingOperationAction extends Action {
	public static ID = 'qp.turnOffExpensiveHighlightingOperationAction';
	public static LABEL = localize('turnOffExpensiveHighlightingOperationAction', 'Off');

	constructor() {
		super(TurnOffExpensiveHighlightingOperationAction.ID, TurnOffExpensiveHighlightingOperationAction.LABEL);
	}

	public override async run(context: HighlightExpensiveOperationWidget): Promise<void> {
		context.executionPlanDiagram.clearExpensiveOperatorHighlighting();
	}
}

export class CancelHIghlightExpensiveOperationAction extends Action {
	public static ID = 'qp.cancelExpensiveOperationAction';
	public static LABEL = localize('cancelExpensiveOperationAction', 'Close');

	constructor() {
		super(CancelHIghlightExpensiveOperationAction.ID, CancelHIghlightExpensiveOperationAction.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: HighlightExpensiveOperationWidget): Promise<void> {
		context.widgetController.removeWidget(context);
	}
}
