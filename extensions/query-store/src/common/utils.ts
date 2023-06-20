/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * Creates a flex container with the provided component and sets the background color
 * TODO: remove background color after chart components are hooked up
 * @param view
 * @param component
 * @param backgroundColor
 * @returns Flex container containing component
 */
export async function createOneComponentFlexContainer(view: azdata.ModelView, component: azdata.Component, backgroundColor: string): Promise<azdata.FlexContainer> {
	const flexContainer = view.modelBuilder.flexContainer().component();

	await flexContainer.updateCssStyles({ 'background-color': backgroundColor });

	flexContainer.addItem(component);

	flexContainer.setLayout({
		flexFlow: 'row',
		width: '100%',
		height: '100%'
	});

	return flexContainer;
}

/**
 * Creates a flex container with two components, either horizontally or vertically based on the passed in flexFlow
 * @param view
 * @param firstComponent
 * @param secondComponent
 * @param flexFlow row or column
 * @returns Flex container containing the two components
 */
export async function createTwoComponentFlexContainer(view: azdata.ModelView, firstComponent: azdata.Component, secondComponent: azdata.Component, flexFlow: string): Promise<azdata.FlexContainer> {
	const flexContainer = view.modelBuilder.flexContainer().component();

	if (flexFlow === 'row') {
		flexContainer.addItem(firstComponent, { CSSStyles: { 'width': '50%' } });
		flexContainer.addItem(secondComponent, { CSSStyles: { 'width': '50%' } });
	} else {
		flexContainer.addItem(firstComponent, { CSSStyles: { 'height': '50%' } });
		flexContainer.addItem(secondComponent, { CSSStyles: { 'height': '50%' } });
	}

	flexContainer.setLayout({
		flexFlow: flexFlow,
		width: '100%',
		height: '100%'
	});

	return flexContainer;
}

/**
 * Creates a vertical splitview
 * @param view
 * @param topComponent
 * @param bottomComponent
 * @param splitViewHeight
 * @returns Vertical SplitViewContainer with the top and bottom components
 */
export function createVerticalSplitView(view: azdata.ModelView, topComponent: azdata.Component, bottomComponent: azdata.Component, splitViewHeight: number): azdata.SplitViewContainer {
	// TODO: figure out why the horizontal spliview isn't working

	const splitview = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().component();
	splitview.addItem(topComponent);
	splitview.addItem(bottomComponent);

	splitview.setLayout({
		orientation: 'vertical',
		splitViewHeight: splitViewHeight
	});

	return splitview;
}
