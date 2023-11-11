/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

// Table
export const InTableContextKey = new RawContextKey<boolean>('inTable', true);
export const TableFilteringEnabledContextKey = new RawContextKey<boolean>('filteringEnabled', false);

// Query Result Grid
export const InQueryResultGridContextKey = new RawContextKey<boolean>('inQueryResultGrid', true);
