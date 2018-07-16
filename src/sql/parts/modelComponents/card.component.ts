/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./card';

import { Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList,
} from '@angular/core';

import * as sqlops from 'sqlops';
import { ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { BOOTSTRAP_SERVICE_ID, IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { StatusIndicator, CardProperties, ActionDescriptor } from 'sql/workbench/api/common/sqlExtHostTypes';

@Component({
	templateUrl: decodeURI(require.toUrl('sql/parts/modelComponents/card.component.html'))
})
export default class CardComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private backgroundColor: string;

	constructor(@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(BOOTSTRAP_SERVICE_ID) private _bootstrapService: IBootstrapService
	) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();
		this._register(this._bootstrapService.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this._bootstrapService.themeService.getColorTheme());

	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
	}

	public setLayout (layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	// CSS-bound properties

	public get label(): string {
		return this.getPropertyOrDefault<CardProperties, string>((props) => props.label, '');
	}

	public get value(): string {
		return this.getPropertyOrDefault<CardProperties, string>((props) => props.value, '');
	}

	public get actions(): ActionDescriptor[] {
		return this.getPropertyOrDefault<CardProperties, ActionDescriptor[]>((props) => props.actions, []);
	}

	public hasStatus(): boolean {
		let status = this.getPropertyOrDefault<CardProperties, StatusIndicator>((props) => props.status, StatusIndicator.None);
		return status !== StatusIndicator.None;
	}

	public get statusColor(): string {
		let status = this.getPropertyOrDefault<CardProperties, StatusIndicator>((props) => props.status, StatusIndicator.None);
		switch(status) {
			case StatusIndicator.Ok:
				return 'green';
			case StatusIndicator.Warning:
				return 'orange';
			case StatusIndicator.Error:
				return 'red';
			default:
				return this.backgroundColor;
		}
	}

	private updateTheme(theme: IColorTheme) {
		this.backgroundColor = theme.getColor(colors.editorBackground, true).toString();
	}

	private onDidActionClick(action: ActionDescriptor): void {
		this._onEventEmitter.fire({
			eventType: ComponentEventType.onDidClick,
			args: action
		});

	}
}
