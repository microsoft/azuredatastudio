/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from 'vs/base/common/uri';
import { IOpenerService, IOpener, IValidator, IExternalUriResolver, IExternalOpener, ResolveExternalUriOptions, IResolvedExternalUri } from 'vs/platform/opener/common/opener';
import { IExternalOpenerProvider } from 'vs/workbench/contrib/externalUriOpener/common/externalUriOpenerService';
import { IDisposable } from 'vs/base/common/lifecycle';


export class OpenerServiceStub implements IOpenerService {
	registerOpener(opener: IOpener): IDisposable {
		throw new Error('Method not implemented.');
	}
	registerValidator(validator: IValidator): IDisposable {
		throw new Error('Method not implemented.');
	}
	registerExternalUriResolver(resolver: IExternalUriResolver): IDisposable {
		throw new Error('Method not implemented.');
	}
	setExternalOpener(opener: IExternalOpener): void {
		throw new Error('Method not implemented.');
	}
	resolveExternalUri(resource: URI, options?: ResolveExternalUriOptions): Promise<IResolvedExternalUri> {
		throw new Error('Method not implemented.');
	}
	_serviceBrand: undefined;
	async open(resource: URI | string, options?: any): Promise<boolean> { return Promise.resolve(true); }
	setDefaultExternalOpener(opener: IExternalOpener): void {
		throw new Error('Method not implemented.');
	}
	registerExternalOpenerProvider(provider: IExternalOpenerProvider): IDisposable {
		throw new Error('Method not implemented.');
	}
	registerExternalOpener(opener: IExternalOpener): IDisposable {
		throw new Error('Method not implemented.');
	}
}
