/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./webview';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList
} from '@angular/core';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { Parts, IPartService } from 'vs/workbench/services/part/common/partService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { WebviewElement, WebviewOptions } from 'vs/workbench/parts/webview/electron-browser/webviewElement';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';

function reviveWebviewOptions(options: vscode.WebviewOptions): vscode.WebviewOptions {
	return {
		...options,
		localResourceRoots: Array.isArray(options.localResourceRoots) ? options.localResourceRoots.map(URI.revive) : undefined
	};
}

@Component({
	template: '',
	selector: 'modelview-webview-component'
})
export default class WebViewComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private static readonly standardSupportedLinkSchemes = ['http', 'https', 'mailto'];

	private _webview: WebviewElement;
	private _renderedHtml: string;
	private _extensionLocationUri: URI;

	protected contextKey: IContextKey<boolean>;
	protected findInputFocusContextKey: IContextKey<boolean>;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IPartService) private partService: IPartService,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IEnvironmentService) private environmentService: IEnvironmentService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(IOpenerService) private readonly _openerService: IOpenerService,
		@Inject(IWorkspaceContextService) private readonly _contextService: IWorkspaceContextService,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
		this._createWebview();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	private _createWebview(): void {
		this._webview = this.instantiationService.createInstance(WebviewElement,
			this.partService.getContainer(Parts.EDITOR_PART),
			{
				allowScripts: true,
				enableWrappedPostMessage: true
			});

		this._webview.mountTo(this._el.nativeElement);

		this._register(this._webview.onDidClickLink(link => this.onDidClickLink(link)));

		this._register(this._webview.onMessage(e => {
			this.fireEvent({
				eventType: ComponentEventType.onMessage,
				args: e
			});
		}));

		this._webview.style(this.themeService.getTheme());
		this.setHtml();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// Webview Functions

	private setHtml(): void {
		if (this._webview && this.html) {
			this._renderedHtml = this.html;
			this._webview.contents = this._renderedHtml;
			this._webview.layout();
		}
	}

	private sendMessage(): void {
		if (this._webview && this.message) {
			this._webview.sendMessage(this.message);
		}
	}

	private onDidClickLink(link: URI): any {
		if (!link) {
			return;
		}
		if (WebViewComponent.standardSupportedLinkSchemes.indexOf(link.scheme) >= 0 || this.enableCommandUris && link.scheme === 'command') {
			this._openerService.open(link);
		}
	}

	private get enableCommandUris(): boolean {
		if (this.options && this.options.enableCommandUris) {
			return true;
		}
		return false;
	}


	/// IComponent implementation

	public layout(): void {
		let element = <HTMLElement>this._el.nativeElement;
		element.style.position = this.position;
		this._webview.layout();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.options) {
			this._webview.options = this.getExtendedOptions();
		}
		if (this.html !== this._renderedHtml) {
			this.setHtml();
		}
		if (this.extensionLocation) {
			this._extensionLocationUri = URI.revive(this.extensionLocation);
		}
		this.sendMessage();

	}

	// CSS-bound properties

	public get message(): any {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, any>((props) => props.message, undefined);
	}

	public set message(newValue: any) {
		this.setPropertyFromUI<sqlops.WebViewProperties, any>((properties, message) => { properties.message = message; }, newValue);
	}

	public get html(): string {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, string>((props) => props.html, undefined);
	}

	public set html(newValue: string) {
		this.setPropertyFromUI<sqlops.WebViewProperties, string>((properties, html) => { properties.html = html; }, newValue);
	}

	public get options(): vscode.WebviewOptions {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, vscode.WebviewOptions>((props) => props.options, undefined);
	}

	public get extensionLocation(): UriComponents {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, UriComponents>((props) => props.extensionLocation, undefined);
	}

	private get extensionLocationUri(): URI {
		if (!this._extensionLocationUri && this.extensionLocation) {
			this._extensionLocationUri = URI.revive(this.extensionLocation);
		}
		return this._extensionLocationUri;
	}

	private getExtendedOptions(): WebviewOptions {
		let options = this.options || { enableScripts: true };
		options = reviveWebviewOptions(options);
		return {
			allowScripts: options.enableScripts,
			allowSvgs: true,
			enableWrappedPostMessage: true,
			useSameOriginForRoot: false,
			localResourceRoots: options!.localResourceRoots || this.getDefaultLocalResourceRoots()
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
