/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// TempDB Messages
export const XEventsFailed = localize('XEventsFailed', 'XEvents operation failed.');
export const XEventsStarted = localize('XEventsStarted', 'XEvents sessions started for PageContention and ObjectContention.');
export const XEventsNotSupported = localize('XEventsNotSupported', 'XEvents sessions not supported.');
export const XEventsStopped = localize('XEventsStopped', 'XEvents sessions PageContention and ObjectContention removed.');
// CONFIG VALUES ///////////////////////////////////////////////////////////
export const extensionConfigSectionName = 'server-reports';
export const configLogDebugInfo = 'logDebugInfo';
