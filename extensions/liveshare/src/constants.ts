/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Provider Constants
 */
export const LiveShareProviderId: string = 'ads-liveshare';
export const LiveShareServiceName: string = 'ads-liveshare';
export const VslsSchema: string = 'vsls';

/**
 *  Connection Provider Constants
 */
export const connectRequest = 'connect';
export const disconnectRequest = 'disconnect';
export const cancelConnectRequest = 'cancelConnect';
export const changeDatabaseRequest = 'changeDatabase';
export const listDatabasesRequest = 'listDatabases';
export const getConnectionStringRequest = 'getConnectionString';
export const buildConnectionInfoRequest = 'buildConnectionInfo';
export const rebuildIntellisenseCacheRequest = 'rebuildIntelliSenseCache';

/**
 * Query Provider Constants
 */
export const cancelQueryRequest = 'cancelQuery';
export const runQueryRequest = 'runQuery';
export const runQueryStatementRequest = 'runQueryStatement';
export const runQueryStringRequest = 'runQueryString';
export const runQueryAndReturnRequest = 'runQueryAndReturn';
export const parseSyntaxRequest = 'parseSyntax';
export const getQueryRowsRequest = 'getQueryRows';
export const disposeQueryRequest = 'disposeQuery';
export const setQueryExecutionOptionsRequest = 'setQueryExecutionOptions';
export const saveResultsRequest = 'saveResultsRequest';
