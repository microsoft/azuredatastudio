/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { AbstractLogger, ILogger, ILoggerService } from 'vs/platform/log/common/log';
import { IUserDataSyncLogService, USER_DATA_SYNC_LOG_ID } from 'vs/platform/userDataSync/common/userDataSync';

export class UserDataSyncLogService extends AbstractLogger implements IUserDataSyncLogService {

	declare readonly _serviceBrand: undefined;
	private readonly logger: ILogger;

	constructor(
		@ILoggerService loggerService: ILoggerService,
	) {
		super();
		this.logger = this._register(loggerService.createLogger(USER_DATA_SYNC_LOG_ID, { name: localize('userDataSyncLog', "Settings Sync") }));
	}

	trace(message: string, ...args: any[]): void {
		this.logger.trace(message, ...args);
	}

	debug(message: string, ...args: any[]): void {
		this.logger.debug(message, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.logger.info(message, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.logger.warn(message, ...args);
	}

	error(message: string | Error, ...args: any[]): void {
		this.logger.error(message, ...args);
	}

	flush(): void {
		this.logger.flush();
	}

}
