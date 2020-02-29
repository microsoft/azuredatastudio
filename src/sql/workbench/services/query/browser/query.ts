/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { UntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IConnectionService, IConnection } from 'sql/platform/connection/common/connectionService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';


export async function openNewQuery(accessor: ServicesAccessor, profile?: IConnectionProfile, initalContent?: string): Promise<UntitledQueryEditorInput> {
	const editorService = accessor.get(IEditorService);
	const objectExplorerService = accessor.get(IObjectExplorerService);
	const connectionService = accessor.get(IConnectionService);
	const capabilitiesService = accessor.get(ICapabilitiesService);
	const instantiationservice = accessor.get(IInstantiationService);
	const connectionManagementService = accessor.get(IConnectionManagementService);
	let connection: IConnection | undefined;
	if (!profile) {
		profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, editorService);
	}
	const untitled = editorService.createInput({ forceUntitled: true, contents: initalContent }) as UntitledTextEditorInput;
	if (profile) {
		const options = new ConnectionProfile(capabilitiesService, profile).options;
		connection = connectionService.createOrGetConnection(untitled.resource.toString(true), { provider: profile.providerName, options });
	}
	const results = instantiationservice.createInstance(QueryResultsInput, untitled.resource.toString(true));
	const input = instantiationservice.createInstance(UntitledQueryEditorInput, '', untitled, results, connection);
	await editorService.openEditor(input);
	return input;
}
