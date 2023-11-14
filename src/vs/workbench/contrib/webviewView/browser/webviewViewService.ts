/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IViewBadge } from 'vs/workbench/common/views';
import { IOverlayWebview } from 'vs/workbench/contrib/webview/browser/webview';

/**
 * A webview shown in a view pane.
 */
export interface WebviewView {
	/**
	 * The text displayed in the view's title.
	 */
	title?: string;

	/**
	 * Additional text shown for this view.
	 */
	description?: string;

	/**
	 * The badge shown for this view.
	 */
	badge?: IViewBadge;

	/**
	 * The webview associated with this webview view.
	 */
	readonly webview: IOverlayWebview;

	/**
	 * Fired when the visibility of the webview view changes.
	 *
	 * This can happen when the view itself is hidden, when the view is collapsed, or when the user switches away from
	 * the view.
	 */
	readonly onDidChangeVisibility: Event<boolean>;

	/**
	 * Fired when the webview view has been disposed of.
	 */
	readonly onDispose: Event<void>;

	/**
	 * Dispose of the webview view and clean up any associated resources.
	 */
	dispose(): void;

	/**
	 * Force the webview view to show.
	 */
	show(preserveFocus: boolean): void;
}

/**
 * Fill in the contents of a newly created webview view.
 */
interface IWebviewViewResolver {
	/**
	 * Fill in the contents of a webview view.
	 */
	resolve(webviewView: WebviewView, cancellation: CancellationToken): Promise<void>;
}

export const IWebviewViewService = createDecorator<IWebviewViewService>('webviewViewService');

export interface IWebviewViewService {

	readonly _serviceBrand: undefined;

	/**
	 * Fired when a resolver has been registered
	 */
	readonly onNewResolverRegistered: Event<{ readonly viewType: string }>;

	/**
	 * Register a new {@link IWebviewViewResolver webview view resolver}.
	 */
	register(viewType: string, resolver: IWebviewViewResolver): IDisposable;

	/**
	 * Try to resolve a webview view. The promise will not resolve until a resolver for the webview has been registered
	 * and run
	 */
	resolve(viewType: string, webview: WebviewView, cancellation: CancellationToken): Promise<void>;
}

export class WebviewViewService extends Disposable implements IWebviewViewService {

	readonly _serviceBrand: undefined;

	private readonly _resolvers = new Map<string, IWebviewViewResolver>();

	private readonly _awaitingRevival = new Map<string, { readonly webview: WebviewView; readonly resolve: () => void }>();

	private readonly _onNewResolverRegistered = this._register(new Emitter<{ readonly viewType: string }>());
	public readonly onNewResolverRegistered = this._onNewResolverRegistered.event;

	register(viewType: string, resolver: IWebviewViewResolver): IDisposable {
		if (this._resolvers.has(viewType)) {
			throw new Error(`View resolver already registered for ${viewType}`);
		}

		this._resolvers.set(viewType, resolver);
		this._onNewResolverRegistered.fire({ viewType: viewType });

		const pending = this._awaitingRevival.get(viewType);
		if (pending) {
			resolver.resolve(pending.webview, CancellationToken.None).then(() => {
				this._awaitingRevival.delete(viewType);
				pending.resolve();
			});
		}

		return toDisposable(() => {
			this._resolvers.delete(viewType);
		});
	}

	resolve(viewType: string, webview: WebviewView, cancellation: CancellationToken): Promise<void> {
		const resolver = this._resolvers.get(viewType);
		if (!resolver) {
			if (this._awaitingRevival.has(viewType)) {
				throw new Error('View already awaiting revival');
			}

			let resolve: () => void;
			const p = new Promise<void>(r => resolve = r);
			this._awaitingRevival.set(viewType, { webview, resolve: resolve! });
			return p;
		}

		return resolver.resolve(webview, cancellation);
	}
}
