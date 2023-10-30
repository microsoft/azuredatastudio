/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ITreeViewDataProvider } from 'vs/workbench/common/views';
import { Emitter, Event } from 'vs/base/common/event';
import { ITreeItem } from 'sql/workbench/common/views';

export interface IConnectionTreeService {
	_serviceBrand: undefined;
	registerTreeProvider(id: string, provider: ITreeViewDataProvider): IDisposable;
	registerTreeDescriptor(descriptor: IConnectionTreeDescriptor): IDisposable;
	setView(view: IView): void;
	readonly onDidAddProvider: Event<ITreeViewDataProvider>;
	readonly providers: Iterable<[string, ITreeViewDataProvider]>;
	readonly descriptors: Iterable<IConnectionTreeDescriptor>;
	readonly view: IView | undefined;
}

export const IConnectionTreeService = createDecorator<IConnectionTreeService>('connectionTreeService');

export interface IView {
	refresh(items?: ITreeItem[])
}

export interface IConnectionTreeDescriptor {
	readonly id: string;
	readonly name: string;
	readonly icon: string;
}

export class ConnectionTreeService implements IConnectionTreeService {
	_serviceBrand;
	private readonly _onDidAddProvider = new Emitter<ITreeViewDataProvider>();
	public readonly onDidAddProvider = this._onDidAddProvider.event;

	private readonly _onDidRemoveProvider = new Emitter<void>();
	public readonly onDidRemoveProvider = this._onDidRemoveProvider.event;

	private _providers = new Map<string, ITreeViewDataProvider>();
	private _descriptors = new Set<IConnectionTreeDescriptor>();

	private _view: IView | undefined;

	registerTreeProvider(id: string, provider: ITreeViewDataProvider): IDisposable {
		this._providers.set(id, provider);
		this._onDidAddProvider.fire(provider);
		return toDisposable(() => {
			this._providers.delete(id);
			this._onDidRemoveProvider.fire();
		});
	}

	registerTreeDescriptor(descriptor: IConnectionTreeDescriptor): IDisposable {
		this._descriptors.add(descriptor);
		return toDisposable(() => {
			this._descriptors.delete(descriptor);
		});
	}

	get descriptors(): Iterable<IConnectionTreeDescriptor> {
		return this._descriptors.values();
	}

	get providers(): Iterable<[string, ITreeViewDataProvider]> {
		return this._providers.entries();
	}

	get view(): IView | undefined {
		return this._view;
	}

	setView(view: IView): void {
		this._view = view;
	}
}

registerSingleton(IConnectionTreeService, ConnectionTreeService, InstantiationType.Delayed);
