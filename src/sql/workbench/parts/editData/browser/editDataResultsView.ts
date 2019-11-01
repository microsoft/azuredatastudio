/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditDataResultsInput } from 'sql/workbench/parts/editData/browser/editDataResultsInput';
import { EditDataComponent } from 'sql/workbench/parts/editData/browser/editData.component';
import { dispose, Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

class EditDataView extends Disposable {
	private editDataComponent: EditDataComponent;

	constructor(private instantiationService: IInstantiationService) {
		super();
		//this.editDataComponent = this._register(this.instantiationService.createInstance(EditDataComponent));
	}

}
