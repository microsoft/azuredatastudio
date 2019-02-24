/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsightsDialogModel, ListResource } from 'sql/workbench/services/insights/common/insightsDialogService';
import { IInsightsConfigDetails, IInsightsLabel } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { Conditional } from 'sql/parts/dashboard/common/interfaces';

import { Event, Emitter, debounceEvent } from 'vs/base/common/event';

export class InsightsDialogModel implements IInsightsDialogModel {
	private _rows: string[][];
	private _columns: string[];
	private _insight: IInsightsConfigDetails;

	private _onDataChangeEmitter: Emitter<void> = new Emitter<void>();
	private _onDataChangeEvent: Event<void> = this._onDataChangeEmitter.event;
	public onDataChange: Event<void> = debounceEvent(this._onDataChangeEvent, (last, event) => event, 75, false);

	public set insight(insight: IInsightsConfigDetails) {
		this._insight = insight;
	}

	public set rows(val: string[][]) {
		this._rows = val;
		this._onDataChangeEmitter.fire();
	}

	public get rows(): string[][] {
		return this._rows;
	}

	public set columns(val: string[]) {
		this._columns = val;
		this._onDataChangeEmitter.fire();
	}

	public get columns(): string[] {
		return this._columns;
	}

	public reset(): void {
		this._columns = [];
		this._rows = [];
		this._onDataChangeEmitter.fire();
	}

	public getListResources(labelIndex: number, valueIndex: number): ListResource[] {
		return this.rows.map((item) => {
			let label = item[labelIndex];
			let value = item[valueIndex];
			let state = this.calcInsightState(value);
			let data = item;
			let icon = typeof this._insight.label === 'object' ? this._insight.label.icon : undefined;
			let rval = { title: false, label, value, icon, data };
			if (state) {
				rval[state.type] = state.val;
			}
			return rval;
		});
	}

	/**
	 * Calculates the state of the item value passed based on the insight conditions
	 * @param item item to determine state for
	 * @returns json that specifies whether the state is an icon or color and the val of that state
	 */
	private calcInsightState(item: string): { type: 'stateColor' | 'stateIcon', val: string } {
		if (typeof this._insight.label === 'string') {
			return undefined;
		} else {
			let label = <IInsightsLabel>this._insight.label;
			for (let cond of label.state) {
				switch (Conditional[cond.condition.if]) {
					case Conditional.always:
						return cond.color
							? { type: 'stateColor', val: cond.color }
							: { type: 'stateIcon', val: cond.icon };
					case Conditional.equals:
						if (item === cond.condition.equals) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
					case Conditional.notEquals:
						if (item !== cond.condition.equals) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
					case Conditional.greaterThanOrEquals:
						if (parseInt(item) >= parseInt(cond.condition.equals)) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
					case Conditional.greaterThan:
						if (parseInt(item) > parseInt(cond.condition.equals)) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
					case Conditional.lessThanOrEquals:
						if (parseInt(item) <= parseInt(cond.condition.equals)) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
					case Conditional.lessThan:
						if (parseInt(item) < parseInt(cond.condition.equals)) {
							return cond.color
								? { type: 'stateColor', val: cond.color }
								: { type: 'stateIcon', val: cond.icon };
						}
						break;
				}
			}
		}
		// if we got to this point, there was no matching conditionals therefore no valid state
		return undefined;
	}
}
