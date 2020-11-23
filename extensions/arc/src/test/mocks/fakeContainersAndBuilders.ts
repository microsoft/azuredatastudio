/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export const loadingComponent = <azdata.LoadingComponent>{
	get loading() { return false; },
	set loading(_value: boolean) { }
};

const loadingBuilder = <azdata.LoadingComponentBuilder>{
	withItem(_obj: any) {
		return loadingBuilder;
	},
	component: () => loadingComponent,
};




