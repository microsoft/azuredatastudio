/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions, IModalDialogStyles } from 'sql/base/browser/ui/modal/modal';
import { Builder } from 'vs/base/browser/builder';
import { IPartService, Dimension } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler, IThemable } from 'vs/platform/theme/common/styler';
import { attachModalDialogStyler } from '../../common/theme/styler';
import { Wizard, DialogPage, Dialog, OptionsDialogButton } from './dialogTypes';
import { Button } from 'vs/base/browser/ui/button/button';
import { Disposable } from 'vs/base/common/lifecycle';
import { TabbedPanel, IPanelTab, IPanelView } from '../../base/browser/ui/panel/panel';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from '../../services/bootstrap/bootstrapService';
import { NgModule, Inject, forwardRef, ComponentFactoryResolver, ApplicationRef, NgModuleRef, Component, AfterContentInit, ViewChild } from '@angular/core';
import { APP_BASE_HREF, CommonModule } from '@angular/common';
import { DashboardModelViewContainer } from '../../parts/dashboard/containers/dashboardModelViewContainer.component';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { ModelViewContent } from '../../parts/modelComponents/modelViewContent.component';
import { ModelComponentWrapper } from '../../parts/modelComponents/modelComponentWrapper.component';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { Router, RouterModule, Routes } from '@angular/router';
import Event, { Emitter } from 'vs/base/common/event';
import { ComponentHostDirective } from '../../parts/dashboard/common/componentHost.directive';
import FlexContainer from '../../parts/modelComponents/flexContainer.component';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as ComponentExtensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';


export class DialogPane extends Disposable implements IThemable {
	private _activeTabIndex: number;
	private _tabbedPanel: TabbedPanel;
	private _moduleRef: NgModuleRef<{}>;

	// HTML Elements
	private _body: HTMLElement;
	private _tabBar: HTMLElement;
	private _tabs: HTMLElement[];
	private _tabContent: HTMLElement[];

	constructor(
		private _dialog: Dialog,
		private _bootstrapService: IBootstrapService
		// @IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
	) {
		super();
		this._tabs = [];
		this._tabContent = [];
	}

	public createBody(container: HTMLElement): HTMLElement {
		new Builder(container).div({ class: 'dialogModal-pane' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
			if (this._dialog.tabs.length > 1) {
				this._tabbedPanel = new TabbedPanel(this._body);
				this._dialog.tabs.forEach((tab, tabIndex) => {
					this._tabbedPanel.pushTab({
						title: tab.title,
						identifier: 'dialogPane.' + this._dialog.title + '.' + tabIndex,
						view: {
							render: (container) => {
								// TODO: Do something with the content
								this.bootstrapAngular(container);
							},
							layout: (dimension) => {

							}
						} as IPanelView
					} as IPanelTab);
				});
			} else {
				// TODO: Do something with the content
				this.bootstrapAngular(this._body);
			}
		});

		this._activeTabIndex = 0;
		return this._body;
	}

	/**
	 * Get the bootstrap params and perform the bootstrap
	 */
	private bootstrapAngular(bodyContainer: HTMLElement) {
		this._bootstrapService.bootstrap(
			DialogModule,
			bodyContainer,
			'dialog-modelview-container',
			undefined,
			undefined,
			(moduleRef) => this._moduleRef = moduleRef);
	}

	public show(): void {
		this._body.classList.remove('dialogModal-hidden');
	}

	public hide(): void {
		this._body.classList.add('dialogModal-hidden');
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._body.style.backgroundColor = styles.dialogBodyBackground ? styles.dialogBodyBackground.toString() : undefined;
		this._body.style.color = styles.dialogForeground ? styles.dialogForeground.toString() : undefined;
	}
}

@Component({
	selector: 'dialog-modelview-container',
	providers: [],
	template: `
		<modelview-content [modelViewId]="id">
		</modelview-content>
		<router-outlet></router-outlet>
	`
})
export class DialogModelViewContainer implements AfterContentInit {
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor() {
	}

	ngAfterContentInit(): void {
	}

	public layout(): void {
		this._modelViewContent.layout();
	}

	public get id(): string {
		return 'sqlservices';
	}

	public get editable(): boolean {
		return false;
	}

	public refresh(): void {
		// no op
	}
}

const appRoutes: Routes = [
	{ path: '**', component: DialogModelViewContainer }
];

/* Model-backed components */
let extensionComponents = Registry.as<IComponentRegistry>(ComponentExtensions.ComponentContribution).getAllCtors();

// Backup wizard main angular module
@NgModule({
	declarations: [
		DialogModelViewContainer,
		ModelViewContent,
		ModelComponentWrapper,
		ComponentHostDirective,
		...extensionComponents
	],
	entryComponents: [DialogModelViewContainer, ...extensionComponents],
	imports: [
		FormsModule,
		CommonModule,
		BrowserModule,
		RouterModule.forRoot(appRoutes),
	],
	providers: [{ provide: APP_BASE_HREF, useValue: '/' }, DashboardServiceInterface]
})
export class DialogModule {

	constructor(
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _resolver: ComponentFactoryResolver,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService
	) {
	}

	ngDoBootstrap(appRef: ApplicationRef) {
		const factory = this._resolver.resolveComponentFactory(DialogModelViewContainer);
		const uniqueSelector: string = this._bootstrapService.getUniqueSelector('dialog-modelview-container');
		(<any>factory).factory.selector = uniqueSelector;
		appRef.bootstrap(factory);
	}
}