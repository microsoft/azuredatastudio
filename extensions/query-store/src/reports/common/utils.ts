/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export async function createOneComponentFlexContainer(view: azdata.ModelView, component: azdata.Component, backgroundColor: string): Promise<azdata.FlexContainer> {
	const bottomFlexBuilder = view.modelBuilder.flexContainer().component();

	await bottomFlexBuilder.updateCssStyles({ 'background-color': backgroundColor });

	bottomFlexBuilder.addItem(component);

	bottomFlexBuilder.setLayout({
		flexFlow: 'row',
		width: '100%',
		height: '100%'
	});

	return bottomFlexBuilder;
}

export async function createTwoComponentHorizontalFlexContainer(view: azdata.ModelView, leftComponent: azdata.Component, rightComponent: azdata.Component): Promise<azdata.FlexContainer> {
	const topFlexContainer = view.modelBuilder.flexContainer().component();
	// TODO: figure out why the horizontal spliview isn't working
	// const horizontalSplitView = <azdata.SplitViewContainer>view.modelBuilder.splitViewContainer().withLayout({
	// 	orientation: 'horizontal',
	// 	splitViewHeight: 200
	// }).component();
	// horizontalSplitView.addItem(leftComponent);
	// horizontalSplitView.addItem(rightContainer);
	// topFlexContainer.addItem(rightComponent);

	topFlexContainer.addItems([leftComponent, rightComponent]);

	topFlexContainer.setLayout({
		flexFlow: 'row',
		width: '100%',
		height: '100%'
	});

	return topFlexContainer;
}
