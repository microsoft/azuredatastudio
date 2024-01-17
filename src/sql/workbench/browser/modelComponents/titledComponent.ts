/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {
	ChangeDetectorRef, ElementRef
} from '@angular/core';

import { ITitledComponent } from 'sql/workbench/browser/modelComponents/interfaces';
import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { ILogService } from 'vs/platform/log/common/log';


export abstract class TitledComponent<T extends azdata.TitledComponentProperties> extends ComponentBase<T> implements ITitledComponent {

	constructor(
		_changeRef: ChangeDetectorRef,
		_el: ElementRef,
		logService: ILogService) {
		super(_changeRef, _el, logService);
	}

	public get title(): string {
		return this.getPropertyOrDefault<string>((props) => props.title, '');
	}

	public set title(newTitle: string) {
		this.setPropertyFromUI<string>((properties, title) => { properties.title = title; }, newTitle);
	}
}
