/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vscode-nls';
import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import { Disposable, window, QuickPickItem, QuickPickOptions } from 'vscode';
import { Telemetry } from './telemetry';
import * as contracts from './contracts';
import * as azdata from 'azdata';
import * as Utils from './utils';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { DataItemCache } from './util/dataCache';

const localize = nls.loadMessageBundle();

export class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		this._client.onNotification(contracts.TelemetryNotification.type, e => {
			Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
}

export class AccountFeature implements StaticFeature {

	tokenCache: DataItemCache<contracts.RequestSecurityTokenResponse | undefined>;

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void { }

	initialize(): void {
		let timeToLiveInSeconds = 10;
		this.tokenCache = new DataItemCache(this.getToken, timeToLiveInSeconds);
		this._client.onRequest(contracts.SecurityTokenRequest.type, async (request): Promise<contracts.RequestSecurityTokenResponse | undefined> => {
			return this.tokenCache.getData(request);
		});
	}

	protected async getToken(request: contracts.RequestSecurityTokenParams): Promise<contracts.RequestSecurityTokenResponse | undefined> {
		const accountList = await azdata.accounts.getAllAccounts();
		let account: azdata.Account;

		if (accountList.length < 1) {
			// TODO: Prompt user to add account
			window.showErrorMessage(localize('mssql.missingLinkedAzureAccount', "Azure Data Studio needs to contact Azure Key Vault to access a column master key for Always Encrypted, but no linked Azure account is available. Please add a linked Azure account and retry the query."));
			return undefined;
		} else if (accountList.length > 1) {
			let options: QuickPickOptions = {
				ignoreFocusOut: true,
				placeHolder: localize('mssql.chooseLinkedAzureAccount', "Please select a linked Azure account:")
			};
			let items = accountList.map(a => new AccountFeature.AccountQuickPickItem(a));
			let selectedItem = await window.showQuickPick(items, options);
			if (!selectedItem) { // The user canceled the selection.
				window.showErrorMessage(localize('mssql.canceledLinkedAzureAccountSelection', "Azure Data Studio needs to contact Azure Key Vault to access a column master key for Always Encrypted, but no linked Azure account was selected. Please retry the query and select a linked Azure account when prompted."));
				return undefined;
			}
			account = selectedItem.account;
		} else {
			account = accountList[0];
		}

		const tenant = account.properties.tenants.find((t: { [key: string]: string }) => request.authority.includes(t.id));
		const unauthorizedMessage = localize('mssql.insufficientlyPrivelagedAzureAccount', "The configured Azure account for {0} does not have sufficient permissions for Azure Key Vault to access a column master key for Always Encrypted.", account.key.accountId);
		if (!tenant) {
			window.showErrorMessage(unauthorizedMessage);
			return undefined;
		}
		const securityToken = await azdata.accounts.getAccountSecurityToken(account, tenant, azdata.AzureResource.AzureKeyVault);

		if (!securityToken?.token) {
			window.showErrorMessage(unauthorizedMessage);
			return undefined;
		}

		let params: contracts.RequestSecurityTokenResponse = {
			accountKey: JSON.stringify(account.key),
			token: securityToken.token
		};

		return params;
	}

	static AccountQuickPickItem = class implements QuickPickItem {
		account: azdata.Account;
		label: string;
		description?: string;
		detail?: string;
		picked?: boolean;
		alwaysShow?: boolean;

		constructor(account: azdata.Account) {
			this.account = account;
			this.label = account.displayInfo.displayName;
		}
	};
}

export class AgentServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messagesTypes: RPCMessageType[] = [
		contracts.AgentJobsRequest.type,
		contracts.AgentJobHistoryRequest.type,
		contracts.AgentJobActionRequest.type
	];

	private onUpdatedHandler: () => any;

	constructor(client: SqlOpsDataClient) {
		super(client, AgentServicesFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		// this isn't explicitly necessary
		// ensure(ensure(capabilities, 'connection')!, 'agentServices')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;
		let self = this;

		// On updated registration
		let registerOnUpdated = (handler: () => any): void => {
			self.onUpdatedHandler = handler;
		};

		let fireOnUpdated = (): void => {
			if (self.onUpdatedHandler) {
				self.onUpdatedHandler();
			}
		};

		// Job management methods
		let getJobs = (ownerUri: string): Thenable<azdata.AgentJobsResult> => {
			let params: contracts.AgentJobsParams = { ownerUri: ownerUri, jobId: null };
			return client.sendRequest(contracts.AgentJobsRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobsRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let getJobHistory = (ownerUri: string, jobID: string, jobName: string): Thenable<azdata.AgentJobHistoryResult> => {
			let params: contracts.AgentJobHistoryParams = { ownerUri: ownerUri, jobId: jobID, jobName: jobName };

			return client.sendRequest(contracts.AgentJobHistoryRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobHistoryRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let jobAction = (ownerUri: string, jobName: string, action: string): Thenable<azdata.ResultStatus> => {
			let params: contracts.AgentJobActionParams = { ownerUri: ownerUri, jobName: jobName, action: action };
			return client.sendRequest(contracts.AgentJobActionRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentJobActionRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createJob = (ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.CreateAgentJobResult> => {
			let params: contracts.CreateAgentJobParams = {
				ownerUri: ownerUri,
				job: jobInfo
			};
			let requestType = contracts.CreateAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJob = (ownerUri: string, originalJobName: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.UpdateAgentJobResult> => {
			let params: contracts.UpdateAgentJobParams = {
				ownerUri: ownerUri,
				originalJobName: originalJobName,
				job: jobInfo
			};
			let requestType = contracts.UpdateAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJob = (ownerUri: string, jobInfo: azdata.AgentJobInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobParams = {
				ownerUri: ownerUri,
				job: jobInfo
			};
			let requestType = contracts.DeleteAgentJobRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let getJobDefaults = (ownerUri: string): Thenable<azdata.AgentJobDefaultsResult> => {
			let params: contracts.AgentJobDefaultsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentJobDefaultsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Job Step management methods
		let createJobStep = (ownerUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.CreateAgentJobStepResult> => {
			let params: contracts.CreateAgentJobStepParams = {
				ownerUri: ownerUri,
				step: stepInfo
			};
			let requestType = contracts.CreateAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJobStep = (ownerUri: string, originalJobStepName: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.UpdateAgentJobStepResult> => {
			let params: contracts.UpdateAgentJobStepParams = {
				ownerUri: ownerUri,
				originalJobStepName: originalJobStepName,
				step: stepInfo
			};
			let requestType = contracts.UpdateAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJobStep = (ownerUri: string, stepInfo: azdata.AgentJobStepInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobStepParams = {
				ownerUri: ownerUri,
				step: stepInfo
			};
			let requestType = contracts.DeleteAgentJobStepRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Notebook Management methods
		const getNotebooks = (ownerUri: string): Thenable<azdata.AgentNotebooksResult> => {
			let params: contracts.AgentNotebookParams = { ownerUri: ownerUri };
			return client.sendRequest(contracts.AgentNotebooksRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(contracts.AgentNotebooksRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		const getNotebookHistory = (ownerUri: string, jobID: string, jobName: string, targetDatabase: string): Thenable<azdata.AgentNotebookHistoryResult> => {
			let params: contracts.AgentNotebookHistoryParams = { ownerUri: ownerUri, jobId: jobID, jobName: jobName, targetDatabase: targetDatabase };

			return client.sendRequest(contracts.AgentNotebookHistoryRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.AgentNotebookHistoryRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};

		const getMaterializedNotebook = (ownerUri: string, targetDatabase: string, notebookMaterializedId: number): Thenable<azdata.AgentNotebookMaterializedResult> => {
			let params: contracts.AgentNotebookMaterializedParams = { ownerUri: ownerUri, targetDatabase: targetDatabase, notebookMaterializedId: notebookMaterializedId };
			return client.sendRequest(contracts.AgentNotebookMaterializedRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.AgentNotebookMaterializedRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};

		const getTemplateNotebook = (ownerUri: string, targetDatabase: string, jobId: string): Thenable<azdata.AgentNotebookTemplateResult> => {
			let params: contracts.AgentNotebookTemplateParams = { ownerUri: ownerUri, targetDatabase: targetDatabase, jobId: jobId };
			return client.sendRequest(contracts.AgentNotebookTemplateRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.AgentNotebookTemplateRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};

		const createNotebook = (ownerUri: string, notebookInfo: azdata.AgentNotebookInfo, templateFilePath: string): Thenable<azdata.CreateAgentNotebookResult> => {
			let params: contracts.CreateAgentNotebookParams = {
				ownerUri: ownerUri,
				notebook: notebookInfo,
				templateFilePath: templateFilePath
			};
			let requestType = contracts.CreateAgentNotebookRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};


		const updateNotebook = (ownerUri: string, originalNotebookName: string, notebookInfo: azdata.AgentNotebookInfo, templateFilePath: string): Thenable<azdata.UpdateAgentNotebookResult> => {
			let params: contracts.UpdateAgentNotebookParams = {
				ownerUri: ownerUri,
				originalNotebookName: originalNotebookName,
				notebook: notebookInfo,
				templateFilePath: templateFilePath
			};
			let requestType = contracts.UpdateAgentNotebookRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		const deleteNotebook = (ownerUri: string, notebookInfo: azdata.AgentNotebookInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentNotebookParams = {
				ownerUri: ownerUri,
				notebook: notebookInfo
			};
			let requestType = contracts.DeleteAgentNotebookRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		const deleteMaterializedNotebook = (ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentMaterializedNotebookParams = { ownerUri: ownerUri, targetDatabase: targetDatabase, agentNotebookHistory: agentNotebookHistory };
			return client.sendRequest(contracts.DeleteMaterializedNotebookRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.DeleteMaterializedNotebookRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};

		const updateNotebookMaterializedName = (ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, name: string): Thenable<azdata.ResultStatus> => {
			let params: contracts.UpdateAgentNotebookRunNameParams = { ownerUri: ownerUri, targetDatabase: targetDatabase, agentNotebookHistory: agentNotebookHistory, materializedNotebookName: name };
			return client.sendRequest(contracts.UpdateAgentNotebookRunNameRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.UpdateAgentNotebookRunNameRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};

		const updateNotebookMaterializedPin = (ownerUri: string, agentNotebookHistory: azdata.AgentNotebookHistoryInfo, targetDatabase: string, pin: boolean): Thenable<azdata.ResultStatus> => {
			let params: contracts.UpdateAgentNotebookRunPinParams = { ownerUri: ownerUri, targetDatabase: targetDatabase, agentNotebookHistory: agentNotebookHistory, materializedNotebookPin: pin };
			return client.sendRequest(contracts.UpdateAgentNotebookRunPinRequest
				.type, params).then(
					r => r,
					e => {
						client.logFailedRequest(contracts.UpdateAgentNotebookRunPinRequest.type, e);
						return Promise.resolve(undefined);
					}
				);
		};



		// Alert management methods
		let getAlerts = (ownerUri: string): Thenable<azdata.AgentAlertsResult> => {
			let params: contracts.AgentAlertsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentAlertsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createAlert = (ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.CreateAgentAlertResult> => {
			let params: contracts.CreateAgentAlertParams = {
				ownerUri: ownerUri,
				alert: alertInfo
			};
			let requestType = contracts.CreateAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateAlert = (ownerUri: string, originalAlertName: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.UpdateAgentAlertResult> => {
			let params: contracts.UpdateAgentAlertParams = {
				ownerUri: ownerUri,
				originalAlertName: originalAlertName,
				alert: alertInfo
			};
			let requestType = contracts.UpdateAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteAlert = (ownerUri: string, alertInfo: azdata.AgentAlertInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentAlertParams = {
				ownerUri: ownerUri,
				alert: alertInfo
			};
			let requestType = contracts.DeleteAgentAlertRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Operator management methods
		let getOperators = (ownerUri: string): Thenable<azdata.AgentOperatorsResult> => {
			let params: contracts.AgentOperatorsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentOperatorsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createOperator = (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.CreateAgentOperatorResult> => {
			let params: contracts.CreateAgentOperatorParams = {
				ownerUri: ownerUri,
				operator: operatorInfo
			};
			let requestType = contracts.CreateAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateOperator = (ownerUri: string, originalOperatorName: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.UpdateAgentOperatorResult> => {
			let params: contracts.UpdateAgentOperatorParams = {
				ownerUri: ownerUri,
				originalOperatorName: originalOperatorName,
				operator: operatorInfo
			};
			let requestType = contracts.UpdateAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteOperator = (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentOperatorParams = {
				ownerUri: ownerUri,
				operator: operatorInfo
			};
			let requestType = contracts.DeleteAgentOperatorRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Proxy management methods
		let getProxies = (ownerUri: string): Thenable<azdata.AgentProxiesResult> => {
			let params: contracts.AgentProxiesParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentProxiesRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createProxy = (ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.CreateAgentOperatorResult> => {
			let params: contracts.CreateAgentProxyParams = {
				ownerUri: ownerUri,
				proxy: proxyInfo
			};
			let requestType = contracts.CreateAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateProxy = (ownerUri: string, originalProxyName: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.UpdateAgentOperatorResult> => {
			let params: contracts.UpdateAgentProxyParams = {
				ownerUri: ownerUri,
				originalProxyName: originalProxyName,
				proxy: proxyInfo
			};
			let requestType = contracts.UpdateAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteProxy = (ownerUri: string, proxyInfo: azdata.AgentProxyInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentProxyParams = {
				ownerUri: ownerUri,
				proxy: proxyInfo
			};
			let requestType = contracts.DeleteAgentProxyRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		// Agent Credential Method
		let getCredentials = (ownerUri: string): Thenable<azdata.GetCredentialsResult> => {
			let params: contracts.GetCredentialsParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentCredentialsRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};


		// Job Schedule management methods
		let getJobSchedules = (ownerUri: string): Thenable<azdata.AgentJobSchedulesResult> => {
			let params: contracts.AgentJobScheduleParams = {
				ownerUri: ownerUri
			};
			let requestType = contracts.AgentJobSchedulesRequest.type;
			return client.sendRequest(requestType, params).then(
				r => r,
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let createJobSchedule = (ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.CreateAgentJobScheduleResult> => {
			let params: contracts.CreateAgentJobScheduleParams = {
				ownerUri: ownerUri,
				schedule: scheduleInfo
			};
			let requestType = contracts.CreateAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let updateJobSchedule = (ownerUri: string, originalScheduleName: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.UpdateAgentJobScheduleResult> => {
			let params: contracts.UpdateAgentJobScheduleParams = {
				ownerUri: ownerUri,
				originalScheduleName: originalScheduleName,
				schedule: scheduleInfo
			};
			let requestType = contracts.UpdateAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let deleteJobSchedule = (ownerUri: string, scheduleInfo: azdata.AgentJobScheduleInfo): Thenable<azdata.ResultStatus> => {
			let params: contracts.DeleteAgentJobScheduleParams = {
				ownerUri: ownerUri,
				schedule: scheduleInfo
			};
			let requestType = contracts.DeleteAgentJobScheduleRequest.type;
			return client.sendRequest(requestType, params).then(
				r => {
					fireOnUpdated();
					return r;
				},
				e => {
					client.logFailedRequest(requestType, e);
					return Promise.resolve(undefined);
				}
			);
		};
		// Job management methods
		return azdata.dataprotocol.registerAgentServicesProvider({
			providerId: client.providerId,
			getJobs,
			getJobHistory,
			jobAction,
			createJob,
			updateJob,
			deleteJob,
			getJobDefaults,
			createJobStep,
			updateJobStep,
			deleteJobStep,
			getNotebooks,
			getNotebookHistory,
			getMaterializedNotebook,
			getTemplateNotebook,
			createNotebook,
			updateNotebook,
			deleteMaterializedNotebook,
			updateNotebookMaterializedName,
			updateNotebookMaterializedPin,
			deleteNotebook,
			getAlerts,
			createAlert,
			updateAlert,
			deleteAlert,
			getOperators,
			createOperator,
			updateOperator,
			deleteOperator,
			getProxies,
			createProxy,
			updateProxy,
			deleteProxy,
			getCredentials,
			getJobSchedules,
			createJobSchedule,
			updateJobSchedule,
			deleteJobSchedule,
			registerOnUpdated
		});
	}
}


export class SerializationFeature extends SqlOpsFeature<undefined> {
	private static readonly messageTypes: RPCMessageType[] = [
		contracts.SerializeDataStartRequest.type,
		contracts.SerializeDataContinueRequest.type,
	];

	constructor(client: SqlOpsDataClient) {
		super(client, SerializationFeature.messageTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;

		let startSerialization = (requestParams: azdata.SerializeDataStartRequestParams): Thenable<azdata.SerializeDataResult> => {
			return client.sendRequest(contracts.SerializeDataStartRequest.type, requestParams).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SerializeDataStartRequest.type, e);
					return Promise.resolve(<azdata.SerializeDataResult>{
						succeeded: false,
						messages: Utils.getErrorMessage(e)
					});
				}
			);
		};

		let continueSerialization = (requestParams: azdata.SerializeDataContinueRequestParams): Thenable<azdata.SerializeDataResult> => {
			return client.sendRequest(contracts.SerializeDataContinueRequest.type, requestParams).then(
				r => {
					return r;
				},
				e => {
					client.logFailedRequest(contracts.SerializeDataContinueRequest.type, e);
					return Promise.resolve(<azdata.SerializeDataResult>{
						succeeded: false,
						messages: Utils.getErrorMessage(e)
					});
				}
			);
		};

		return azdata.dataprotocol.registerSerializationProvider({
			providerId: client.providerId,
			startSerialization,
			continueSerialization
		});
	}
}

export class SqlAssessmentServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messagesTypes: RPCMessageType[] = [
		contracts.SqlAssessmentInvokeRequest.type,
		contracts.GetSqlAssessmentItemsRequest.type
	];
	constructor(client: SqlOpsDataClient) {
		super(client, SqlAssessmentServicesFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;

		let assessmentInvoke = async (ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult> => {
			let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
			try {
				return client.sendRequest(contracts.SqlAssessmentInvokeRequest.type, params);
			}
			catch (e) {
				client.logFailedRequest(contracts.SqlAssessmentInvokeRequest.type, e);
			}

			return undefined;
		};

		let getAssessmentItems = async (ownerUri: string, targetType: azdata.sqlAssessment.SqlAssessmentTargetType): Promise<azdata.SqlAssessmentResult> => {
			let params: contracts.SqlAssessmentParams = { ownerUri: ownerUri, targetType: targetType };
			try {
				return client.sendRequest(contracts.GetSqlAssessmentItemsRequest.type, params);
			}
			catch (e) {
				client.logFailedRequest(contracts.GetSqlAssessmentItemsRequest.type, e);
			}

			return undefined;
		};

		let generateAssessmentScript = async (items: azdata.SqlAssessmentResultItem[]): Promise<azdata.ResultStatus> => {
			let params: contracts.GenerateSqlAssessmentScriptParams = { items: items, taskExecutionMode: azdata.TaskExecutionMode.script, targetServerName: '', targetDatabaseName: '' };
			try {
				return client.sendRequest(contracts.GenerateSqlAssessmentScriptRequest.type, params);
			}
			catch (e) {
				client.logFailedRequest(contracts.GenerateSqlAssessmentScriptRequest.type, e);
			}

			return undefined;
		};

		return azdata.dataprotocol.registerSqlAssessmentServicesProvider({
			providerId: client.providerId,
			assessmentInvoke,
			getAssessmentItems,
			generateAssessmentScript
		});
	}


}
