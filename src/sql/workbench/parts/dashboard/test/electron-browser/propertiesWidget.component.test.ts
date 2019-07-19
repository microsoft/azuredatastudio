/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs/Observable';
// of is not on Observable by default, need to import it
import 'rxjs/add/observable/of';

import { WidgetConfig } from 'sql/workbench/parts/dashboard/browser/core/dashboardWidget';
import { DashboardServiceInterface } from 'sql/workbench/parts/dashboard/browser/services/dashboardServiceInterface.service';
import { SingleAdminService, SingleConnectionManagementService } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { PropertiesWidgetComponent } from 'sql/workbench/parts/dashboard/browser/widgets/properties/propertiesWidget.component';
import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NullLogService } from 'vs/platform/log/common/log';

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
	test('Parses good config', function (done) {
		// for some reason mocha thinks this test takes 26 seconds even though it doesn't, so it says this failed because it took longer than 2 seconds
		this.timeout(30000);
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

		let connectionManagementinfo = TypeMoq.Mock.ofType(ConnectionManagementInfo);
		connectionManagementinfo.object.serverInfo = serverInfo;

		let singleConnectionService = TypeMoq.Mock.ofType(SingleConnectionManagementService);
		singleConnectionService.setup(x => x.connectionInfo).returns(() => connectionManagementinfo.object);

		dashboardService.setup(x => x.connectionManagementService).returns(() => singleConnectionService.object);

		const testLogService = new class extends NullLogService {
			error() {
				assert.fail('Called console Error unexpectedly');
			}
		};

		let testComponent = new PropertiesWidgetComponent(dashboardService.object, new TestChangeDetectorRef(), undefined, widgetConfig, testLogService);

		// because config parsing is done async we need to put our asserts on the thread stack
		setTimeout(() => {
			// because properties is private we need to do some work arounds to access it.
			assert.equal((<any>testComponent).properties.length, 1);
			assert.equal((<any>testComponent).properties[0].displayName, 'Test');
			assert.equal((<any>testComponent).properties[0].value, 'Test Property');
			done();
		});
	});
});
