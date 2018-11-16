/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export namespace QueryEditorContextKeys {
	export const isConnected = new RawContextKey<boolean>('isConnected', false);
	export const isExecuting = new RawContextKey<boolean>('isExecuting', false);
}
