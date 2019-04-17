/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProfilerFilterClause, ProfilerFilter, ProfilerFilterClauseOperator } from 'sql/workbench/services/profiler/common/interfaces';


export function FilterData(filter: ProfilerFilter, data: any[]): any[] {
	if (!data || !filter) {
		return data;
	}
	return data.filter(item => matches(item, filter.clauses));
}

function matches(item: any, clauses: ProfilerFilterClause[]): boolean {
	let match = true;
	if (!item) {
		match = false;
	} else if (clauses) {
		for (let i = 0; i < clauses.length; i++) {
			let clause = clauses[i];
			if (!!clause && !!clause.field) {
				let actualValue: any = item[clause.field];
				let expectedValue: any = clause.value;
				let actualValueString: string = actualValue === undefined ? undefined : actualValue.toLocaleLowerCase();
				let expectedValueString: string = expectedValue === undefined ? undefined : expectedValue.toLocaleLowerCase();
				let actualValueDate = new Date(actualValue).valueOf();
				let expectedValueDate = new Date(expectedValue).valueOf();
				let actualValueNumber = new Number(actualValue).valueOf();
				let expectedValueNumber = new Number(expectedValue).valueOf();

				if (isValidNumber(actualValue) && isValidNumber(expectedValue)) {
					actualValue = actualValueNumber;
					expectedValue = expectedValueNumber;
				} else if (isValidDate(actualValue) && isValidDate(expectedValue)) {
					actualValue = actualValueDate;
					expectedValue = expectedValueDate;
				} else {
					actualValue = actualValueString;
					expectedValue = expectedValueString;
				}

				switch (clause.operator) {
					case ProfilerFilterClauseOperator.Equals:
						match = actualValue === expectedValue;
						break;
					case ProfilerFilterClauseOperator.NotEquals:
						match = actualValue !== expectedValue;
						break;
					case ProfilerFilterClauseOperator.LessThan:
						match = actualValue < expectedValue;
						break;
					case ProfilerFilterClauseOperator.LessThanOrEquals:
						match = actualValue <= expectedValue;
						break;
					case ProfilerFilterClauseOperator.GreaterThan:
						match = actualValue > expectedValue;
						break;
					case ProfilerFilterClauseOperator.GreaterThanOrEquals:
						match = actualValue >= expectedValue;
						break;
					case ProfilerFilterClauseOperator.IsNull:
						match = actualValue === undefined || actualValue === null || actualValue === '';
						break;
					case ProfilerFilterClauseOperator.IsNotNull:
						match = actualValue !== undefined && actualValue !== null && actualValue !== '';
						break;
					case ProfilerFilterClauseOperator.Contains:
						match = actualValueString && actualValueString.includes(expectedValueString);
						break;
					case ProfilerFilterClauseOperator.NotContains:
						match = !actualValueString || !actualValueString.includes(expectedValueString);
						break;
					case ProfilerFilterClauseOperator.StartsWith:
						match = actualValueString.startsWith(expectedValueString);
						break;
					case ProfilerFilterClauseOperator.NotStartsWith:
						match = !actualValueString || !actualValueString.startsWith(expectedValueString);
						break;
					default:
						throw `Not a valid operator: ${clause.operator}`;
				}
			}

			if (!match) {
				break;
			}
		}
	}

	return match;
}

function isValidNumber(value: string): boolean {
	let num = new Number(value);
	return value !== undefined && !isNaN(num.valueOf()) && value.replace(' ', '') !== '';
}

function isValidDate(value: string): boolean {
	let date = new Date(value);
	return value !== undefined && !isNaN(date.valueOf());
}
