/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs/Observable';
// of is not on Observable by default, need to import it
import 'rxjs/add/observable/of';

import { WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { SingleAdminService, SingleConnectionManagementService } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { PropertiesWidgetComponent } from 'sql/workbench/contrib/dashboard/browser/widgets/properties/propertiesWidget.component';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NullLogService } from 'vs/platform/log/common/log';
import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';

class TestChangeDetectorRef extends ChangeDetectorRef {
	reattach(): void {
		return;
	}
	checkNoChanges(): void {
		return;
	}
	detectChanges(): void {
		return;
	}
	detach(): void {
		return;
	}
	markForCheck(): void {
		return;
	}
}

suite('Dashboard Properties Widget Tests', () => {
	test('Parses good config', () => {
		let propertiesConfig = {
			properties: [
				{

					displayName: 'Test',
					value: 'testProperty'
				}
			]
		};

		let serverInfo = {
			isCloud: false,
			testProperty: 'Test Property',
			serverMajorVersion: undefined,
			serverMinorVersion: undefined,
			serverReleaseVersion: undefined,
			engineEditionId: undefined,
			serverVersion: undefined,
			serverLevel: undefined,
			serverEdition: undefined,
			azureVersion: undefined,
			osVersion: undefined,
			options: {},
		};

		let databaseInfo = {
			options: {
				testProperty: 'Test Property'
			}
		};

		let widgetConfig: WidgetConfig = {
			widget: {
				'properties-widget': propertiesConfig
			},
			context: 'server',
			provider: mssqlProviderName,
			edition: 0
		};

		let dashboardService = TypeMoq.Mock.ofInstance<DashboardServiceInterface>({
			adminService: undefined,
			connectionManagementService: undefined
		} as DashboardServiceInterface, TypeMoq.MockBehavior.Loose);

		let singleAdminService = TypeMoq.Mock.ofType(SingleAdminService);
		singleAdminService.setup(x => x.databaseInfo).returns(() => Observable.of(databaseInfo));

		dashboardService.setup(x => x.adminService).returns(() => singleAdminService.object);

		let singleConnectionService = TypeMoq.Mock.ofType(SingleConnectionManagementService);
		singleConnectionService.setup(x => x.connectionInfo).returns(() => ({ serverInfo, providerId: undefined, connectionProfile: undefined, extensionTimer: undefined, serviceTimer: undefined, intelliSenseTimer: undefined, connecting: undefined, ownerUri: undefined }));

		dashboardService.setup(x => x.connectionManagementService).returns(() => singleConnectionService.object);

		const testLogService = new class extends NullLogService {
			error() {
				assert.fail('Called console Error unexpectedly');
			}
		};

		let testComponent = new PropertiesWidgetComponent(dashboardService.object, new TestChangeDetectorRef(), undefined, widgetConfig, testLogService);

		return new Promise(resolve => {
			// because config parsing is done async we need to put our asserts on the thread stack
			setImmediate(() => {
				const propertyItems: PropertyItem[] = (testComponent as any).parseProperties(databaseInfo);
				assert.equal(propertyItems.length, 1);
				assert.equal(propertyItems[0].displayName, 'Test');
				assert.equal(propertyItems[0].value, 'Test Property');
				resolve();
			});
		});
	});
});
