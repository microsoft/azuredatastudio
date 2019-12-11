/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ILogService, LogLevel, AbstractLogService } from 'vs/platform/log/common/log';
import { ExtHostLogServiceShape, MainThreadLogShape, MainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { IExtHostOutputService } from 'vs/workbench/api/common/extHostOutput';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { UriComponents } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { IExtHostContribution, IExtHostContributionsRegistry, Extensions } from 'vs/workbench/api/common/extHostContributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { Disposable } from 'vs/base/common/lifecycle';

export class ExtHostLogService extends AbstractLogService implements ILogService, ExtHostLogServiceShape {

	_serviceBrand: undefined;

	private readonly _proxy: MainThreadLogShape;
	private readonly _logFile: UriComponents;

	constructor(
		@IExtHostRpcService rpc: IExtHostRpcService,
		@IExtHostInitDataService initData: IExtHostInitDataService,
	) {
		super();
		this._proxy = rpc.getProxy(MainContext.MainThreadLog);
		this._logFile = initData.logFile.toJSON();
		this.setLevel(initData.logLevel);
	}

	$setLevel(level: LogLevel): void {
		this.setLevel(level);
	}

	trace(_message: string, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Trace) {
			this._proxy.$log(this._logFile, LogLevel.Trace, Array.from(arguments));
		}
	}

	debug(_message: string, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Debug) {
			this._proxy.$log(this._logFile, LogLevel.Debug, Array.from(arguments));
		}
	}

	info(_message: string, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Info) {
			this._proxy.$log(this._logFile, LogLevel.Info, Array.from(arguments));
		}
	}

	warn(_message: string, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Warning) {
			this._proxy.$log(this._logFile, LogLevel.Warning, Array.from(arguments));
		}
	}

	error(_message: string | Error, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Error) {
			this._proxy.$log(this._logFile, LogLevel.Error, Array.from(arguments));
		}
	}

	critical(_message: string | Error, ..._args: any[]): void {
		if (this.getLevel() <= LogLevel.Critical) {
			this._proxy.$log(this._logFile, LogLevel.Critical, Array.from(arguments));
		}
	}

	flush(): void { }
}


class ExtHostLogChannelContribution extends Disposable implements IExtHostContribution {

	constructor(
		@IExtHostInitDataService initData: IExtHostInitDataService,
		@IExtHostOutputService outputSerice: IExtHostOutputService,
	) {
		super();
		outputSerice.createOutputChannelFromLogFile(localize('name', "Worker Extension Host"), initData.logFile);
	}

}

Registry.as<IExtHostContributionsRegistry>(Extensions.ExtHost).registerExtHostContribution(ExtHostLogChannelContribution);
