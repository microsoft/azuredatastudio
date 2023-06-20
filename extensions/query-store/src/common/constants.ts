/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const overallResourceConsumption = localize('overallResourceConsumption', "Overall Resource Consumption");
export function overallResourceConsumptionToolbarLabel(databaseName: string): string { return localize('overallResourceConsumptionToolbarLabel', 'Overall resource consumption for database {0}', databaseName); }

export const topResourceConsumingQueries = localize('topResourceConsumingQueries', "Top Resource Consuming Queries");
export function topResourceConsumingQueriesToolbarLabel(databaseName: string): string { return localize('topResourceConsumingQueriesToolbarLabel', 'Top 25 resource consumers for database {0}', databaseName); }

export const configure = localize('configure', "Configure");
