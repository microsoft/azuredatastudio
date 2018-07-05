/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./lineSeparator';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	OnDestroy, AfterViewInit
} from '@angular/core';

import * as sqlops from 'sqlops';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/parts/modelComponents/interfaces';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';

@Component({
	selector: 'modelview-lineSeparator',
	template: `
		<div class="lineSeparatorContainer"><p class="lineSeparatorText">{{getValue()}}</p><hr class="lineSeparator"></div>`
})
export default class LineSeparatorComponent extends ComponentBase implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// IComponent implementation

	public layout(): void {
		this._changeRef.detectChanges();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public set value(newValue: string) {
		this.setPropertyFromUI<sqlops.LineSeparatorComponentProperties, string>((properties, value) => { properties.value = value; }, newValue);
	}

	public get value(): string {
		return this.getPropertyOrDefault<sqlops.LineSeparatorComponentProperties, string>((props) => props.value, '');
	}

	public getValue(): string {
		return this.value;
	}
}
