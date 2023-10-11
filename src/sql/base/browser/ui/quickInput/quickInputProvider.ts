/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { IInputOptions } from 'vs/platform/quickinput/common/quickInput';



export interface IQuickInputProvider {
	input(options?: IInputOptions, token?: CancellationToken): Promise<string | undefined>;
}
