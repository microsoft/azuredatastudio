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
 * Creates a horizontal flex container with a left and right component
 * TODO: update this to have the two components in a horizontal split view
 * @param view
 * @param leftComponent
 * @param rightComponent
 * @returns Flex container containing the two components
 */
export async function createTwoComponentHorizontalFlexContainer(view: azdata.ModelView, leftComponent: azdata.Component, rightComponent: azdata.Component): Promise<azdata.FlexContainer> {
	const flexContainer = view.modelBuilder.flexContainer().component();
	// TODO: figure out why the horizontal spliview isn't working
	// const horizontalSplitView = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().withLayout({
	// 	orientation: 'vertical',
	// 	splitViewHeight: 400
	// }).component();
	// horizontalSplitView.addItem(leftComponent);
	// horizontalSplitView.addItem(rightComponent);
	// flexContainer.addItem(horizontalSplitView);

	flexContainer.addItems([leftComponent, rightComponent]);

	flexContainer.setLayout({
		flexFlow: 'row',
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
 * @returns
 */
export function createVerticalSplitView(view: azdata.ModelView, topComponent: azdata.Component, bottomComponent: azdata.Component, splitViewHeight: number): azdata.SplitViewContainer {
	const splitview = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().component();
	splitview.addItem(topComponent);
	splitview.addItem(bottomComponent);

	splitview.setLayout({
		orientation: 'vertical',
		splitViewHeight: splitViewHeight
	});

	return splitview;
}
