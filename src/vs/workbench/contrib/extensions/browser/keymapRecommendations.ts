/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionRecommendations, ExtensionRecommendation } from 'vs/workbench/contrib/extensions/browser/extensionRecommendations';
import { IProductService } from 'vs/platform/product/common/productService';
import { ExtensionRecommendationReason, IExtensionRecommendationReson } from 'vs/workbench/services/extensionRecommendations/common/extensionRecommendations';

export class KeymapRecommendations extends ExtensionRecommendations {

	private _recommendations: ExtensionRecommendation[] = [];
	get recommendations(): ReadonlyArray<ExtensionRecommendation> { return this._recommendations; }

	constructor(
		@IProductService private readonly productService: IProductService,
	) {
		super();
	}

	protected async doActivate(): Promise<void> {
		if (this.productService.keymapExtensionTips) {
			this._recommendations = this.productService.keymapExtensionTips.map(extensionId => (<ExtensionRecommendation>{
				extensionId: extensionId.toLowerCase(),
				reason: <IExtensionRecommendationReson>{ // {{SQL CARBON EDIT}}
					reasonId: ExtensionRecommendationReason.Application,
					reasonText: ''
				}
			}));
		}
	}

}

