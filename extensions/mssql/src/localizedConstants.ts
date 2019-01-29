/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// HDFS Constants //////////////////////////////////////////////////////////
export const msgMissingNodeContext = localize('msgMissingNodeContext', 'Node Command called without any node passed');
export const msgTimeout = localize('connectionTimeout', 'connection timed out. Host name or port may be incorrect');
