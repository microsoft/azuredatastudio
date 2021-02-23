/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from 'vs/base/common/uri';
import { IOpenerService, IOpener, IValidator, IExternalUriResolver, IExternalOpener, ResolveExternalUriOptions, IResolvedExternalUri, IExternalOpenerProvider } from 'vs/platform/opener/common/opener';
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
}
