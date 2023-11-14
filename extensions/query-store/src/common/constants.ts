/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export function queryStoreDashboardTitle(databaseName: string): string { return localize('queryStoreDashboardTitle', "Query Store - {0}", databaseName); }

// report dashboard tab ids
export const overallResourceConsumptionTabId = 'OverallResourceConsumptionTab';
export const topResourceConsumingQueriesTabId = 'TopResourceConsumingQueriesTab';

export const overallResourceConsumption = localize('overallResourceConsumption', "Overall Resource Consumption");
export const duration = localize('duration', "Duration");
export const executionCount = localize('executionCount', "Execution Count");
export const cpuTime = localize('cpuTime', "CPU Time");
export const logicalReads = localize('logicalReads', "Logical Reads");
export function overallResourceConsumptionToolbarLabel(databaseName: string): string { return localize('overallResourceConsumptionToolbarLabel', "Overall resource consumption for database {0}", databaseName); }

export const topResourceConsumingQueries = localize('topResourceConsumingQueries', "Top Resource Consuming Queries");
export const queries = localize('queries', "Queries");
export function planSummary(queryId: string): string { return localize('planSummary', "Plan Summary for query {0}", queryId); }
export function plan(queryId: string): string { return localize('plan', "Plan {0}", queryId); }
export function topResourceConsumingQueriesToolbarLabel(databaseName: string): string { return localize('topResourceConsumingQueriesToolbarLabel', "Top 25 resource consumers for database {0}", databaseName); }

export const configure = localize('configure', "Configure");
export const openInNewTab = localize('openInNewTab', "Open In New Tab");
export const okButtonText = localize('okButtonText', "Ok");
export const cancelButtonText = localize('cancelButtonText', "Cancel");
export const applyButtonText = localize('applyButtonText', "Apply");
export const criteria = localize('criteria', "Criteria");
export const executionCountLabel = localize('executionCountLabel', "Execution Count");
export const durationLabel = localize('durationLabel', "Duration (ms)");
export const CPUTimeLabel = localize('CPUTimeLabel', "CPU Time (ms)");
export const logicalReadsLabel = localize('logicalReadsLabel', "Logical Reads (KB)");
export const logicalWritesLabel = localize('logicalWritesLabel', "Logical Writes (KB)");
export const physicalReadsLabel = localize('physicalReadsLabel', "Physical Reads (KB)");
export const CLRTimeLabel = localize('CLRTimeLabel', "CLR Time (ms)");
export const DOPLabel = localize('DOPLabel', "DOP");
export const memoryConsumptionLabel = localize('memoryConsumptionLabel', "Memory Consumption (KB)");
export const rowCountLabel = localize('rowCountLabel', "Row Count");
export const logMemoryUsedLabel = localize('logMemoryUsedLabel', "Log Memory Used (KB)");
export const tempDBMermoryUsedLabel = localize('tempDBMermoryUsedLabel', "Temp DB Memory Used (KB)");
export const waitTimeLabel = localize('waitTimeLabel', "Wait Time (ms)");
export const topConsumersRadioButtonsLabel = localize('topConsumersRadioButtonsLabel', "Check for top consumers of:");
export const resourceConsumptionCriteriaTitle = localize('resourceConsumptionCriteriaTitle', "Resource Consumption Criteria")
export const showChartTitle = localize('showChartTitle', "Show Chart for")

export const last5MinsLabel = localize('last5MinsLabel', "Last 5 minutes");
export const last15MinsLabel = localize('last15MinsLabel', "Last 15 minutes");
export const last30MinsLabel = localize('last30MinsLabel', "Last 30 minutes");
export const lastHourLabel = localize('lastHourLabel', "Last hour");
export const last12HoursLabel = localize('last12HoursLabel', "Last 12 hours");
export const lastDayLabel = localize('lastDayLabel', "Last day");
export const last2DaysLabel = localize('last2DaysLabel', "Last 2 days");
export const lastWeekLabel = localize('lastWeekLabel', "Last week");
export const last2WeeksLabel = localize('last2WeeksLabel', "Last 2 weeks");
export const lastMonthLabel = localize('lastMonthLabel', "Last month");
export const last3MonthsLabel = localize('last3MonthsLabel', "Last 3 months");
export const last6MonthsLabel = localize('last6MonthsLabel', "Last 6 months");
export const lastYearLabel = localize('lastYearLabel', "Last year");
export const customLabel = localize('customLabel', "Custom");
export const fromLabel = localize('fromLabel', "From");
export const toLabel = localize('toLabel', "To");
export const localLabel = localize('localLabel', "Local");
export const UTCLabel = localize('UTCLabel', "UTC");
export const timeFormatLabel = localize('timeFormatLabel', "Time Format");
export const timeSettingsLabel = localize('timeSettingsLabel', "Time Settings");
export const timeIntervalLabel = localize('timeIntervalLabel', "Time Interval");
export const aggregationSizeLabel = localize('aggregationSizeLabel', "Aggregation Size");
export const minuteLabel = localize('minuteLabel', "Minute");
export const hourLabel = localize('hourLabel', "Hour");
export const dayLabel = localize('dayLabel', "Day");
export const automaticLabel = localize('automaticLabel', "Automatic");

export const basedOnLabel = localize('basedOnLabel', "Based on:");
export const avgLabel = localize('avgLabel', "Avg");
export const maxLabel = localize('maxLabel', "Max");
export const minLabel = localize('minLabel', "Min");
export const stdDevLabel = localize('stdDevLabel', "Std Dev");
export const totalLabel = localize('totalLabel', "Total");

export const returnLabel = localize('returnLabel', "Return");
export const allLabel = localize('allLabel', "All");
export const topLabel = localize('topLabel', "Top");

export const filterLabel = localize('filterLabel', "Filters");
export const filterMinPlanLabel = localize('filterMinPlanLabel', "Min number of plans");
