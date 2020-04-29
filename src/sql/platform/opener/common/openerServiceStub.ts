/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';


export class OpenerServiceStub implements IOpenerService {
	_serviceBrand: undefined;
	registerOpener() { return undefined; }
	registerValidator() { return undefined; }
	registerExternalUriResolver() { return undefined; }
	setExternalOpener() { return undefined; }
	async open(resource: URI | string, options?: any): Promise<boolean> { return Promise.resolve(true); }
	async resolveExternalUri(uri: any) { return undefined; }
}
