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
import { AzDataGraphCell, AzdataGraphView, ExpensiveOperationType } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
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

export class FindExpensiveOperationWidget extends ExecutionPlanWidgetBase {
	private _actionBar: ActionBar;

	private _operationNameSelectBoxContainer: HTMLElement;
	private _operationNameSelectBox: SelectBox;
	private _selectedExpensiveOperationType: ExpensiveOperationType = ExpensiveOperationType.Cost;

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

	private getDefaultExpensiveOperationMetric(): ExpensiveOperationType {
		let defaultMetricConfiguration = this._configurationService.getValue<string>('queryEditor.executionPlan.expensiveOperationMetric');

		switch (defaultMetricConfiguration) {
			case 'actualElapsedTime':
				return ExpensiveOperationType.ActualElapsedTime;
			case 'actualElapsedCpuTime':
				return ExpensiveOperationType.ActualElapsedCpuTime;
			case 'cost':
				return ExpensiveOperationType.Cost;
			case 'subtreeCost':
				return ExpensiveOperationType.SubtreeCost;
			case 'actualNumberOfRowsForAllExecutions':
				return ExpensiveOperationType.ActualNumberOfRowsForAllExecutions;
			case 'numberOfRowsRead':
				return ExpensiveOperationType.NumberOfRowsRead;
			default:
				return ExpensiveOperationType.Off;
		}
	}

	private renderAndStyleWidget(): void {
		// Expensive Operation Dropdown
		this._operationNameSelectBoxContainer = DOM.$('expensive-operation-name-select-box .dropdown-container');
		const operationLabel = DOM.$('expensive-operation-name-select-box-label');
		operationLabel.innerText = localize('expensiveOperationLabel', 'Metric:');

		this._operationNameSelectBoxContainer.appendChild(operationLabel);
		this.container.appendChild(this._operationNameSelectBoxContainer);

		this._operationNameSelectBox = new SelectBox([
			OFF_STRING,
			ACTUAL_ELAPSED_TIME_STRING,
			ACTUAL_ELAPSED_CPU_TIME_STRING,
			COST_STRING,
			SUBTREE_COST_STRING,
			ACTUAL_NUMBER_OF_ROWS_FOR_ALL_EXECUTIONS_STRING,
			NUMBER_OF_ROWS_READ_STRING
		], COST_STRING, this.contextViewService, this._operationNameSelectBoxContainer);

		this._operationNameSelectBox.render(this._operationNameSelectBoxContainer);
		this._register(attachSelectBoxStyler(this._operationNameSelectBox, this.themeService));

		this._operationNameSelectBoxContainer.style.width = '200px';
		this._operationNameSelectBoxContainer.style.marginRight = '5px';

		this._register(this._operationNameSelectBox.onDidSelect(e => {
			switch (e.selected) {
				case ACTUAL_ELAPSED_TIME_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.ActualElapsedTime;
					break;
				case ACTUAL_ELAPSED_CPU_TIME_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.ActualElapsedCpuTime;
					break;
				case COST_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.Cost;
					break;
				case SUBTREE_COST_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.SubtreeCost;
					break;
				case ACTUAL_NUMBER_OF_ROWS_FOR_ALL_EXECUTIONS_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.ActualNumberOfRowsForAllExecutions;
					break;
				case NUMBER_OF_ROWS_READ_STRING:
					this._selectedExpensiveOperationType = ExpensiveOperationType.NumberOfRowsRead;
					break;
				default:
					this._selectedExpensiveOperationType = ExpensiveOperationType.Off;
			}
		}));

		// Apply Button
		const findExpensiveOperationAction = new FindExpensiveOperationAction();
		this._register(findExpensiveOperationAction);

		const clearExpensiveOperationAction = new TurnOffExpensiveOperationAction();
		this._register(clearExpensiveOperationAction);

		const cancelExpensiveOperationAction = new CancelExpensiveOperationAction();
		this._register(cancelExpensiveOperationAction);

		const self = this;
		this._operationNameSelectBox.selectElem.onkeydown = async (ev) => {
			if (ev.key === 'Enter') {
				if (this._selectedExpensiveOperationType === ExpensiveOperationType.Off) {
					await clearExpensiveOperationAction.run(self);
				}
				else {
					await findExpensiveOperationAction.run(self);
				}

				this.showStoreDefaultMetricPrompt();
			}
			else if (ev.key === 'Escape') {
				this.widgetController.removeWidget(self);
			}
		};

		const applyButton = new Button(this.container, {
			title: localize('findExpensiveOperationButtonTitle', 'Find Expensive Operation (Enter)')
		});
		applyButton.setWidth('60px');
		applyButton.label = localize('findExpensiveOperationApplyButton', 'Apply');

		this._register(applyButton.onDidClick(async e => {
			if (this._selectedExpensiveOperationType === ExpensiveOperationType.Off) {
				await clearExpensiveOperationAction.run(self);
			}
			else {
				await findExpensiveOperationAction.run(self);
			}

			this.showStoreDefaultMetricPrompt();
		}));

		// Adds Action bar
		this._actionBar = new ActionBar(this.container);
		this._actionBar.context = this;
		this._actionBar.pushAction(cancelExpensiveOperationAction, { label: false, icon: true });
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
		this._operationNameSelectBox.focus();
	}

	public getExpensiveOperationDelegate(): (cell: AzDataGraphCell) => number | undefined {
		const getElapsedTimeInMs = (cell: AzDataGraphCell): number | undefined => cell.elapsedTimeInMs;
		const getElapsedCpuTimeInMs = (cell: AzDataGraphCell): number | undefined => cell.elapsedCpuTimeInMs;
		const getCost = (cell: AzDataGraphCell): number | undefined => cell.cost;
		const getSubtreeCost = (cell: AzDataGraphCell): number | undefined => cell.subTreeCost;

		const getRowsForAllExecutions = (cell: AzDataGraphCell): number | undefined => {
			if (!cell.rowMetrics) {
				return undefined;
			}

			let result = Number(cell.rowMetrics['actualRows']);
			if (!result) {
				result = Number(cell.rowMetrics['estimateRowsAllExecs']);
			}

			if (isNaN(result)) {
				return undefined;
			}

			return result;
		};

		const getNumberOfRowsRead = (cell: AzDataGraphCell): number | undefined => {
			if (!cell.rowMetrics) {
				return undefined;
			}

			let result = Number(cell.rowMetrics['actualRowsRead']);
			if (!result) {
				result = Number(cell.rowMetrics['estimatedRowsRead']);
			}

			if (isNaN(result)) {
				return undefined;
			}

			return result;
		};

		let expensiveOperationDelegate = getCost;
		switch (this._selectedExpensiveOperationType) {
			case ExpensiveOperationType.ActualElapsedTime:
				expensiveOperationDelegate = getElapsedTimeInMs;
				break;
			case ExpensiveOperationType.ActualElapsedCpuTime:
				expensiveOperationDelegate = getElapsedCpuTimeInMs;
				break;
			case ExpensiveOperationType.SubtreeCost:
				expensiveOperationDelegate = getSubtreeCost;
				break;
			case ExpensiveOperationType.ActualNumberOfRowsForAllExecutions:
				expensiveOperationDelegate = getRowsForAllExecutions;
				break;
			case ExpensiveOperationType.NumberOfRowsRead:
				expensiveOperationDelegate = getNumberOfRowsRead;
				break;
		}

		return expensiveOperationDelegate;
	}
}

export class FindExpensiveOperationAction extends Action {
	public static ID = 'qp.findExpensiveOperationAction';
	public static LABEL = localize('findExpensiveOperationAction', 'Find (Enter)');

	constructor() {
		super(FindExpensiveOperationAction.ID, FindExpensiveOperationAction.LABEL, searchIconClassNames);
	}

	public override async run(context: FindExpensiveOperationWidget): Promise<void> {
		const expensiveOperationDelegate: (cell: AzDataGraphCell) => number | undefined = context.getExpensiveOperationDelegate();

		context.executionPlanDiagram.clearExpensiveOperatorHighlighting();
		let result = context.executionPlanDiagram.highlightExpensiveOperator(expensiveOperationDelegate);
		if (!result) {
			context.notificationService.info(localize('invalidPropertyExecutionPlanMetric', 'Unable to locate a node using the specified metric.'));
		}
	}
}

export class TurnOffExpensiveOperationAction extends Action {
	public static ID = 'qp.turnOffExpensiveOperationAction';
	public static LABEL = localize('turnOffExpensiveOperationAction', 'Off');

	constructor() {
		super(TurnOffExpensiveOperationAction.ID, TurnOffExpensiveOperationAction.LABEL);
	}

	public override async run(context: FindExpensiveOperationWidget): Promise<void> {
		context.executionPlanDiagram.clearExpensiveOperatorHighlighting();
	}
}

export class CancelExpensiveOperationAction extends Action {
	public static ID = 'qp.cancelExpensiveOperationAction';
	public static LABEL = localize('cancelExpensiveOperationAction', 'Close (Escape)');

	constructor() {
		super(CancelExpensiveOperationAction.ID, CancelExpensiveOperationAction.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: FindExpensiveOperationWidget): Promise<void> {
		context.widgetController.removeWidget(context);
	}
}
