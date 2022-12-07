/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export function failedToFindTenants(tenantId: string, accountName: string): string { return localize('mssql.failedToFindTenants', "Failed to find tenant '{0}' in account '{1}' when refreshing security token", tenantId, accountName); }
export function tokenRefreshFailed(name: string): string { return localize('mssql.tokenRefreshFailed', "{0} AAD token refresh failed, please reconnect to enable {0}", name); }
export const tokenRefreshFailedNoSecurityToken = localize('mssql.tokenRefreshFailedNoSecurityToken', "Editor token refresh failed, autocompletion will be disabled until the editor is disconnected and reconnected");
export function failedToFindAccount(accountName: string) { return localize('mssql.failedToFindAccount', "Failed to find azure account {0} when executing token refresh", accountName); }
