/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { ContextViewService } from 'vs/platform/contextview/browser/contextViewService';
import { TestLayoutService } from 'vs/workbench/test/workbenchTestServices';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { SimpleNotificationService } from 'vs/editor/standalone/browser/simpleServices';

suite('Chart View', () => {
	test('initializes without error', () => {
		const chartview = createChartView();
		assert(chartview);
	});

	test('renders without error', () => {
		const chartview = createChartView();
		chartview.render(document.createElement('div'));
	});
});

function createChartView(): ChartView {
	const layoutService = new TestLayoutService();
	const contextViewService = new ContextViewService(layoutService);
	const themeService = new TestThemeService();
	const instantiationService = new TestInstantiationService();
	const notificationService = new SimpleNotificationService();
	instantiationService.stub(IThemeService, themeService);
	return new ChartView(contextViewService, themeService, instantiationService, notificationService);
}
