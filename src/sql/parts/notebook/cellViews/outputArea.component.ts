/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';

import { AngularDisposable } from 'sql/base/common/lifecycle';

import { IModeService } from 'vs/editor/common/services/modeService';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { CellModel } from 'sql/parts/notebook/models/cell';

export const OUTPUT_AREA_SELECTOR: string = 'output-area-component';

@Component({
	selector: OUTPUT_AREA_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./outputArea.component.html'))
})
export class OutputAreaComponent extends AngularDisposable implements OnInit {

	@Input() cellModel: ICellModel;

	private readonly _minimumHeight = 30;

	constructor(
		@Inject(IModeService) private _modeService: IModeService
	) {
		super();
	}

	ngOnInit() {
	}

	public layout(): void {
	}

}
