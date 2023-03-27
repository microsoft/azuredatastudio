/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IListVirtualDelegate } from 'vs/base/browser/ui/list/list';
import { ServerTreeRenderer } from 'sql/workbench/services/objectExplorer/browser/serverTreeRenderer';
import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

export class AsyncServerTreeDelegate implements IListVirtualDelegate<ServerTreeElement> {

	getHeight(element: ServerTreeElement): number {
		if (element instanceof ConnectionProfileGroup) {
			return ServerTreeRenderer.CONNECTION_GROUP_HEIGHT;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_HEIGHT;
		} else {
			return ServerTreeRenderer.OBJECTEXPLORER_HEIGHT;
		}
	}

	getTemplateId(element: ServerTreeElement): string {
		if (element instanceof ConnectionProfileGroup) {
			return ServerTreeRenderer.CONNECTION_GROUP_TEMPLATE_ID;
		} else if (element instanceof ConnectionProfile) {
			return ServerTreeRenderer.CONNECTION_TEMPLATE_ID;
		} else {
			return ServerTreeRenderer.OBJECTEXPLORER_TEMPLATE_ID;
		}
	}
}
