/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// localizable strings

export const runQueryBatchStartMessage = localize('runQueryBatchStartMessage', 'Started executing query at ');
export const runQueryBatchStartLine = localize('runQueryBatchStartLine', 'Line {0}');

export const msgCancelQueryFailed = localize('msgCancelQueryFailed', 'Canceling the query failed: {0}');

export const msgSaveStarted = localize('msgSaveStarted', 'Started saving results to ');
export const msgSaveFailed = localize('msgSaveFailed', 'Failed to save results. ');
export const msgSaveSucceeded = localize('msgSaveSucceeded', 'Successfully saved results to ');

export const msgStatusRunQueryInProgress = localize('msgStatusRunQueryInProgress', 'Executing query...');

// /** Results Pane Labels */
export const maximizeLabel = localize('maximizeLabel', 'Maximize');
export const restoreLabel = localize('resultsPane.restoreLabel', 'Restore');
export const saveCSVLabel = localize('saveCSVLabel', 'Save as CSV');
export const saveJSONLabel = localize('saveJSONLabel', 'Save as JSON');
export const saveExcelLabel = localize('saveExcelLabel', 'Save as Excel');
export const saveXMLLabel = localize('saveXMLLabel', 'Save as XML');
export const viewChartLabel = localize('viewChartLabel', 'View as Chart');

export const resultPaneLabel = localize('resultPaneLabel', 'Results');
export const executeQueryLabel = localize('executeQueryLabel', 'Executing query ');

/** Messages Pane Labels */
export const messagePaneLabel = localize('messagePaneLabel', 'Messages');
export const elapsedTimeLabel = localize('elapsedTimeLabel', 'Total execution time: {0}');

/** Warning message for save icons */
export const msgCannotSaveMultipleSelections = localize('msgCannotSaveMultipleSelections', 'Save results command cannot be used with multiple selections.');


