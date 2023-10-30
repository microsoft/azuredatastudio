/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Disposable } from 'vs/base/common/lifecycle';
import { INotebookLoggingService } from 'vs/workbench/contrib/notebook/common/notebookLoggingService';
import { ILogger, ILoggerService } from 'vs/platform/log/common/log';
import { joinPath } from 'vs/base/common/resources';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';

const logChannelId = 'notebook.rendering';

export class NotebookLoggingService extends Disposable implements INotebookLoggingService {
	_serviceBrand: undefined;

	static ID: string = 'notebook';
	private readonly _logger: ILogger;

	constructor(
		@ILoggerService loggerService: ILoggerService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
	) {
		super();
		const logsPath = joinPath(environmentService.windowLogsPath, 'notebook.rendering.log');
		this._logger = this._register(loggerService.createLogger(logsPath, { id: logChannelId, name: nls.localize('renderChannelName', "Notebook rendering") }));
	}

	debug(category: string, output: string): void {
		this._logger.debug(`[${category}] ${output}`);
	}


	info(category: string, output: string): void {
		this._logger.info(`[${category}] ${output}`);
	}
}

