/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../common/apiWrapper';

export interface TestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
}

export function createContext(): TestContext {
	let apiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	return {
		apiWrapper: apiWrapper
	};
}
