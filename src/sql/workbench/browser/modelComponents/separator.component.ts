/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';
import * as azdata from 'azdata';


import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { Separator } from 'sql/base/browser/ui/separator/separator';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: `modelview-separator`,
	template: `
		<div [ngStyle]="CSSStyles" #separator> </div>
	`
})
export default class SeparatorComponent extends ComponentBase<azdata.SeparatorComponentProperties> implements IComponent, OnDestroy, AfterViewInit {
	private _separator: Separator;
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild('separator', { read: ElementRef }) private _separatorContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		if (this._separatorContainer) {
			this._separator = new Separator(this._separatorContainer.nativeElement);
			this._register(this._separator);
		}
		this.baseInit();
	}

	setLayout(layout: any): void {
		// Change look and feel
		this.layout();
	}
}
