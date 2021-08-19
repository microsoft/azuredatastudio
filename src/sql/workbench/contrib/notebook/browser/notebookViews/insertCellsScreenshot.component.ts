/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, AfterViewInit, forwardRef, Inject, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { IBootstrapParams } from 'sql/workbench/services/bootstrap/common/bootstrapParams';
import { IComponentEventArgs } from 'sql/platform/dashboard/browser/interfaces';
import CardComponent from 'sql/workbench/browser/modelComponents/card.component';
import { URI } from 'vs/base/common/uri';
import { CardType, CardImage } from 'azdata';


export interface LayoutRequestParams {
	modelViewId?: string;
	alwaysRefresh?: boolean;
}
export interface InsertCellsComponentParams extends IBootstrapParams {
	thumbnails: string[],
	onClick: (e: IComponentEventArgs) => void
}

@Component({
	selector: 'insert-cells-screenshots-component',
	template: ``
})
export class InsertCellsScreenshots implements AfterViewInit {
	constructor(
		@Inject(IBootstrapParams) private _params: InsertCellsComponentParams,
		@Inject(ViewContainerRef) private _containerRef: ViewContainerRef,
		@Inject(forwardRef(() => ComponentFactoryResolver)) private _componentFactoryResolver: ComponentFactoryResolver
	) {
		const cellImageUri = URI.parse(this._params.thumbnails[0]);

		let cardComponentFactory = this._componentFactoryResolver.resolveComponentFactory(CardComponent);
		let cardComponent = this._containerRef.createComponent(cardComponentFactory);

		let cardImage: CardImage = {
			path: cellImageUri,
			size: 'cover'
		};

		cardComponent.instance.setProperties({ image: cardImage, cardType: CardType.Image });
	}

	ngAfterViewInit(): void { }
}
