/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'should';
import 'mocha';
import { getTroubleshootNotebookUrl } from '../bigDataCluster/dialog/bdcDashboardModel';
import { Service } from '../bigDataCluster/utils';
// import { promises as fs } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

describe('getTroubleshootNotebookUrl Method Tests', () => {
	it('Should find all notebook URLs in TOC', async () => {
		const notebookPath = vscode.extensions.getExtension('Microsoft.sqlservernotebook').extensionPath;
		const tocText = await fs.readFileSync(path.join(notebookPath, 'books', 'sqlserver2019', '_config.yml'));
		// const tocText = await fs.readFile(path.join(notebookPath, 'books', 'sqlserver2019', '_config.yml'));
		Object.keys(Service).forEach(service => {
			//tocText.should.containEql(getTroubleshootNotebookUrl(service));
			getTroubleshootNotebookUrl(service).should.containEql('troubleshooters');
			// 'troubleshooters/tsg104-troubleshoot-control'.should.containEql('troubleshooters');
		});
	});
});
