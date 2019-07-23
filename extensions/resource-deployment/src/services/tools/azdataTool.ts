/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ToolType, ITool } from '../../interfaces';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class AzdataTool implements ITool {
	get name(): string {
		return 'azdata';
	}

	get description(): string {
		return localize('resourceDeployment.AzdataDescription', "A command-line utility written in Python that enables cluster administrators to bootstrap and manage the big data cluster via REST APIs");
	}

	get type(): ToolType {
		return ToolType.Azdata;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzdataDisplayName', "azdata");
	}
}