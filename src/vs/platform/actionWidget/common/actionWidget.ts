/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';

export interface ActionSet<T> extends IDisposable {
	readonly validActions: readonly T[];
	readonly allActions: readonly T[];
	readonly hasAutoFix: boolean;
}
