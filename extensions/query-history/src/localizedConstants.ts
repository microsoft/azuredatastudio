/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export const succeeded = localize('succeeded', "Succeeded");
export const failed = localize('failed', "Failed");

export const errorLoading = (err: any): string => localize('errorLoading', "Error loading saved query history items. {0}", err.message ?? err);

