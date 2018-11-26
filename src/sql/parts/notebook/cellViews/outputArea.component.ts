/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./code';
import { OnInit, Component, Input, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { AngularDisposable } from 'sql/base/common/lifecycle';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';

export const OUTPUT_AREA_SELECTOR: string = 'output-area-component';

@Component({
	selector: OUTPUT_AREA_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./outputArea.component.html'))
})
export class OutputAreaComponent extends AngularDisposable implements OnInit {
	@Input() cellModel: ICellModel;

	private readonly _minimumHeight = 30;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
	}
	ngOnInit(): void {
		if (this.cellModel) {
			this.cellModel.onOutputsChanged(() => {
				this._changeRef.detectChanges();
			});
		}
	}
}
