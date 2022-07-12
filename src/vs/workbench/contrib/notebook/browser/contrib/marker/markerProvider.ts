/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { IMarkerListProvider, MarkerList, IMarkerNavigationService } from 'vs/editor/contrib/gotoError/markerNavigationService';
import { CellUri } from 'vs/workbench/contrib/notebook/common/notebookCommon';
import { IMarkerService } from 'vs/platform/markers/common/markers';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IDisposable } from 'vs/base/common/lifecycle';

class MarkerListProvider implements IMarkerListProvider {

	private readonly _dispoables: IDisposable;

	constructor(
		@IMarkerService private readonly _markerService: IMarkerService,
		@IMarkerNavigationService markerNavigation: IMarkerNavigationService,
		@IConfigurationService private readonly _configService: IConfigurationService,
	) {
		this._dispoables = markerNavigation.registerProvider(this);
	}

	dispose() {
		this._dispoables.dispose();
	}

	getMarkerList(resource: URI | undefined): MarkerList | undefined {
		if (!resource) {
			return undefined;
		}
		const data = CellUri.parse(resource);
		if (!data) {
			return undefined;
		}
		return new MarkerList(uri => {
			const otherData = CellUri.parse(uri);
			return otherData?.notebook.toString() === data.notebook.toString();
		}, this._markerService, this._configService);
	}
}

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(MarkerListProvider, LifecyclePhase.Ready);
