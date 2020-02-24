/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';


import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { Separator } from 'sql/base/browser/ui/separator/separator';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

@Component({
	selector: `modelview-separator`,
	template: `
		<div #seperator> </div>
	`
})
export default class SeparatorComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	private _separator: Separator;
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild('separator', { read: ElementRef }) private _separatorContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) contextViewService: IContextViewService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IConfigurationService) configurationService: IConfigurationService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		if (this._separatorContainer) {
			this._separator = new Separator(this._separatorContainer.nativeElement);
			this._register(this._separator);
		}
	}

	setLayout(layout: any): void {
		// Change look and feel
		this.layout();
	}
}
