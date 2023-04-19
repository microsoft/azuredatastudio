/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/webview';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ElementRef, OnDestroy
} from '@angular/core';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { WebviewContentOptions, IWebviewService, IWebviewElement } from 'vs/workbench/contrib/webview/browser/webview';
import { generateUuid } from 'vs/base/common/uuid';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { ComponentEventType, IModelStore, IComponentDescriptor, IComponent } from 'sql/platform/dashboard/browser/interfaces';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

function reviveWebviewOptions(options: vscode.WebviewOptions): vscode.WebviewOptions {
	return {
		...options,
		localResourceRoots: Array.isArray(options.localResourceRoots) ? options.localResourceRoots.map(URI.revive) : undefined
	};
}

interface WebViewProperties extends azdata.WebViewProperties {
	extensionLocation: UriComponents
}

@Component({
	template: '',
	selector: 'modelview-webview-component'
})
export default class WebViewComponent extends ComponentBase<WebViewProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private static readonly standardSupportedLinkSchemes = ['http', 'https', 'mailto'];

	private _webview: IWebviewElement;
	private _renderedHtml: string;
	private _extensionLocationUri: URI;
	private _ready: Promise<void>;

	protected contextKey: IContextKey<boolean>;
	protected findInputFocusContextKey: IContextKey<boolean>;

	private readonly id = generateUuid();

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IOpenerService) private readonly _openerService: IOpenerService,
		@Inject(IWorkspaceContextService) private readonly _contextService: IWorkspaceContextService,
		@Inject(IWebviewService) private readonly webviewService: IWebviewService,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this._createWebview();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
		this.baseInit();
	}

	private _createWebview(): void {
		this._webview = this.webviewService.createWebviewElement({
			id: this.id,
			contentOptions: {
				allowScripts: true,
			},
			options: {},
			extension: undefined
		});

		this._webview.mountTo(this._el.nativeElement);

		this._ready = new Promise(resolve => {
			let webview = (<any>this._webview)._webview;
			const subscription = this._register(addDisposableListener(webview, 'ipc-message', (event) => {
				if (event.channel === 'webview-ready') {
					subscription.dispose();
					resolve();
				}
			}));
		});

		this._ready.then(() => {
			this._register(this._webview.onDidClickLink(link => this.onDidClickLink(URI.parse(link))));

			this._register(this._webview.onMessage(e => {
				this.fireEvent({
					eventType: ComponentEventType.onMessage,
					args: e
				});
			}));

			this.setHtml();
		}).catch(onUnexpectedError);
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// Webview Functions

	private setHtml(): void {
		if (this._webview && this.html) {
			this._renderedHtml = this.html;
			this._webview.html = this._renderedHtml;
		}
	}

	private sendMessage(): void {
		if (this._webview && this.message) {
			this._webview.postMessage(this.message);
		}
	}

	private onDidClickLink(link: URI): any {
		if (!link) {
			return;
		}
		if (WebViewComponent.standardSupportedLinkSchemes.indexOf(link.scheme) >= 0) {
			this._openerService.open(link);
		} else if (this.enableCommandUris && link.scheme === 'command') {
			this._openerService.open(link, { allowCommands: true });
		}
	}

	private get enableCommandUris(): boolean {
		if (this.options && this.options.enableCommandUris) {
			return true;
		}
		return false;
	}


	/// IComponent implementation

	public override layout(): void {
		if (this._ready) {
			this._ready.then(() => {
				let element = <HTMLElement>this._el.nativeElement;
				element.style.position = this.position;
			}).catch(onUnexpectedError);
		}
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		if (this._ready) {
			this._ready.then(() => {
				super.setProperties(properties);
				if (this.options) {
					this._webview.contentOptions = this.getExtendedOptions();
				}
				if (this.html !== this._renderedHtml) {
					this.setHtml();
				}
				if (this.extensionLocation) {
					this._extensionLocationUri = URI.revive(this.extensionLocation);
				}
				this.sendMessage();
			}).catch(onUnexpectedError);
		}
	}

	// CSS-bound properties

	public get message(): any {
		return this.getPropertyOrDefault<any>((props) => props.message, undefined);
	}

	public set message(newValue: any) {
		this.setPropertyFromUI<any>((properties, message) => { properties.message = message; }, newValue);
	}

	public get html(): string {
		return this.getPropertyOrDefault<string>((props) => props.html, undefined);
	}

	public set html(newValue: string) {
		this.setPropertyFromUI<string>((properties, html) => { properties.html = html; }, newValue);
	}

	public get options(): vscode.WebviewOptions {
		return this.getPropertyOrDefault<vscode.WebviewOptions>((props) => props.options, undefined);
	}

	public get extensionLocation(): UriComponents {
		return this.getPropertyOrDefault<UriComponents>((props) => props.extensionLocation, undefined);
	}

	private get extensionLocationUri(): URI {
		if (!this._extensionLocationUri && this.extensionLocation) {
			this._extensionLocationUri = URI.revive(this.extensionLocation);
		}
		return this._extensionLocationUri;
	}

	private getExtendedOptions(): WebviewContentOptions {
		let options = this.options || { enableScripts: true };
		options = reviveWebviewOptions(options);
		return {
			allowScripts: options.enableScripts,
			localResourceRoots: options.localResourceRoots || this.getDefaultLocalResourceRoots()
		};
	}

	private getDefaultLocalResourceRoots(): URI[] {
		const rootPaths = this._contextService.getWorkspace().folders.map(x => x.uri);
		if (this.extensionLocationUri) {
			rootPaths.push(this.extensionLocationUri);
		}
		return rootPaths;
	}

}
