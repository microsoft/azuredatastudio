/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, Output, EventEmitter } from '@angular/core';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import {nb} from 'sqlops';

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
		//Just for testing - wil remove it
		let cellText = this.cellModel.outputs.length >0 ? (<nb.IStreamResult>this.cellModel.outputs[0]).text : '';
	}

	public layout(): void {
	}

}
