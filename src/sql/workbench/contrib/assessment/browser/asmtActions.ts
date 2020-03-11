/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IAssessmentComponent } from 'sql/workbench/contrib/assessment/browser/asmtResultsView.component';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ILogService } from 'vs/platform/log/common/log';
import { IAssessmentService } from 'sql/workbench/services/assessment/common/interfaces';
import { AssessmentResult } from 'azdata';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { AssessmentType, AssessmentTargetType, TELEMETRY_VIEW_EVENT } from 'sql/workbench/contrib/assessment/browser/consts';

export class IAsmtActionInfo {
	ownerUri?: string;
	component: IAssessmentComponent;
	connectionId: string;
}



abstract class AsmtServerAction extends Action {
	constructor(
		id: string,
		label: string,
		private asmtType: AssessmentType,
		@IConnectionManagementService private _connectionManagement: IConnectionManagementService,
		@ILogService protected _logService: ILogService,
		@IAdsTelemetryService protected _telemetryService: IAdsTelemetryService
	) {
		super(id, label, 'defaultServerIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>(async (resolve, reject) => {
			this._telemetryService.sendActionEvent(TELEMETRY_VIEW_EVENT, this.id);
			if (context) {
				if (context.component) {
					context.component.showProgress(this.asmtType);
					let serverResults = this.getServerItems(context.ownerUri);
					let connectionUri: string = this._connectionManagement.getConnectionUriFromId(context.connectionId);
					let connection = this._connectionManagement.getConnection(connectionUri);
					let databaseListResult = this._connectionManagement.listDatabases(connectionUri);
					context.component.showInitialResults(await serverResults, this.asmtType);
					let dbList = await databaseListResult;
					if (dbList) {
						for (let nDbName = 0; nDbName < dbList.databaseNames.length; nDbName++) {
							if (!context.component.isActive) {
								break;
							}
							let dbName = dbList.databaseNames[nDbName];
							let newUri = await this._connectionManagement.connectIfNotConnected(connection.cloneWithDatabase(dbName).clone());

							this._logService.info(`Database ${dbName} assessment started`);
							let dbResult = await this.getDatabaseItems(newUri);
							this._logService.info(`Database ${dbName} assessment completed`);

							context.component.appendResults(dbResult, this.asmtType);
						}
					}

					context.component.stopProgress(this.asmtType);
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}

	abstract getServerItems(ownerUri: string): Thenable<AssessmentResult>;
	abstract getDatabaseItems(ownerUri: string): Thenable<AssessmentResult>;
}


export class AsmtServerSelectItemsAction extends AsmtServerAction {
	public static ID = 'asmtaction.server.getitems';
	public static LABEL = nls.localize(AsmtServerSelectItemsAction.ID, "View applicable rules");

	constructor(
		@IConnectionManagementService _connectionManagement: IConnectionManagementService,
		@ILogService _logService: ILogService,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService _telemetryService: IAdsTelemetryService
	) {
		super(AsmtServerSelectItemsAction.ID, AsmtServerSelectItemsAction.LABEL,
			AssessmentType.AvailableRules,
			_connectionManagement,
			_logService, _telemetryService);
	}

	getServerItems(ownerUri: string): Thenable<AssessmentResult> {
		return this._assessmentService.getAssessmentItems(ownerUri, AssessmentTargetType.Server);
	}

	getDatabaseItems(ownerUri: string): Thenable<AssessmentResult> {
		return this._assessmentService.getAssessmentItems(ownerUri, AssessmentTargetType.Database);
	}
}

export class AsmtDatabaseSelectItemsAction extends Action {
	public static ID = 'asmtaction.database.getitems';
	public static LABEL = nls.localize(AsmtDatabaseSelectItemsAction.ID, "View applicable rules");

	constructor(
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtDatabaseSelectItemsAction.ID, AsmtDatabaseSelectItemsAction.LABEL, 'defaultDatabaseIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>(async (resolve, reject) => {
			this._telemetryService.sendActionEvent(TELEMETRY_VIEW_EVENT, this.id);
			if (context) {
				if (context.component) {
					context.component.showProgress(AssessmentType.AvailableRules);
					let dbAsmtResults = await this._assessmentService.getAssessmentItems(context.ownerUri, AssessmentTargetType.Database);
					context.component.showInitialResults(dbAsmtResults, AssessmentType.AvailableRules);
					context.component.stopProgress(AssessmentType.AvailableRules);
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}


export class AsmtServerInvokeItemsAction extends AsmtServerAction {
	public static ID = 'asmtaction.server.invokeitems';
	public static LABEL = nls.localize(AsmtServerInvokeItemsAction.ID, "Invoke Assessment");

	constructor(
		@IConnectionManagementService _connectionManagement: IConnectionManagementService,
		@ILogService _logService: ILogService,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService _telemetryService: IAdsTelemetryService
	) {
		super(AsmtServerInvokeItemsAction.ID, AsmtServerInvokeItemsAction.LABEL, AssessmentType.InvokeAssessment, _connectionManagement, _logService, _telemetryService);
	}
	getServerItems(ownerUri: string): Thenable<AssessmentResult> {
		this._logService.info(`Requesting server items`);
		return this._assessmentService.assessmentInvoke(ownerUri, AssessmentTargetType.Server);
	}

	getDatabaseItems(ownerUri: string): Thenable<AssessmentResult> {
		return this._assessmentService.assessmentInvoke(ownerUri, AssessmentTargetType.Database);
	}
}

export class AsmtDatabaseInvokeItemsAction extends Action {
	public static ID = 'asmtaction.database.invokeitems';
	public static LABEL = nls.localize(AsmtDatabaseInvokeItemsAction.ID, "Invoke Assessment");

	constructor(
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtDatabaseInvokeItemsAction.ID, AsmtDatabaseInvokeItemsAction.LABEL, 'defaultDatabaseIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>(async (resolve, reject) => {
			this._telemetryService.sendActionEvent(TELEMETRY_VIEW_EVENT, this.id);
			if (context) {
				if (context.component) {
					context.component.showProgress(AssessmentType.InvokeAssessment);
					let dbAsmtResults = await this._assessmentService.assessmentInvoke(context.ownerUri, AssessmentTargetType.Database);
					context.component.showInitialResults(dbAsmtResults, AssessmentType.InvokeAssessment);
					context.component.stopProgress(AssessmentType.InvokeAssessment);
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class AsmtExportAsScriptAction extends Action {
	public static ID = 'asmtaction.exportasscript';
	public static LABEL = nls.localize(AsmtExportAsScriptAction.ID, "Export As Script");

	constructor(
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtExportAsScriptAction.ID, AsmtExportAsScriptAction.LABEL, 'exportAsScriptIcon');
	}

	public run(context: IAsmtActionInfo): Promise<boolean> {
		return new Promise<boolean>(async (resolve, reject) => {
			this._telemetryService.sendActionEvent(TELEMETRY_VIEW_EVENT, this.id);
			if (context) {
				if (context.component) {
					await this._assessmentService.generateAssessmentScript(context.ownerUri, context.component.resultItems);
				}
				resolve(true);
			} else {
				reject(false);
			}
		});
	}
}

export class AsmtSamplesLinkAction extends Action {
	public static readonly ID = 'asmtaction.showsamples';
	public static readonly LABEL = nls.localize(AsmtSamplesLinkAction.ID, "View all rules and learn more on GitHub");
	public static readonly ICON = 'asmt-learnmore';
	private static readonly configHelpUri = 'https://aka.ms/sql-assessment-api';

	constructor(
		@IOpenerService private _openerService: IOpenerService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService

	) {
		super(AsmtSamplesLinkAction.ID, AsmtSamplesLinkAction.LABEL, AsmtSamplesLinkAction.ICON);
	}

	public run(): Promise<boolean> {
		this._telemetryService.sendActionEvent(TELEMETRY_VIEW_EVENT, this.id);
		return this._openerService.open(URI.parse(AsmtSamplesLinkAction.configHelpUri));
	}
}
