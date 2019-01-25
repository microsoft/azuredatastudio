/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as path from 'path';
import { nb } from 'sqlops';

import * as pfs from 'vs/base/node/pfs';
import { localize } from 'vs/nls';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IDefaultConnection, notebookConstants, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import * as notebookUtils from '../notebookUtils';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';

const configBase = {
	'kernel_python_credentials': {
		'url': ''
	},
	'kernel_scala_credentials': {
		'url': ''
	},
	'kernel_r_credentials': {
		'url': ''
	},

	'ignore_ssl_errors': true,

	'logging_config': {
		'version': 1,
		'formatters': {
			'magicsFormatter': {
				'format': '%(asctime)s\t%(levelname)s\t%(message)s',
				'datefmt': ''
			}
		},
		'handlers': {
			'magicsHandler': {
				'class': 'hdijupyterutils.filehandler.MagicsFileHandler',
				'formatter': 'magicsFormatter',
				'home_path': ''
			}
		},
		'loggers': {
			'magicsLogger': {
				'handlers': ['magicsHandler'],
				'level': 'DEBUG',
				'propagate': 0
			}
		}
	}
};
export class SparkMagicContexts {

	public static get DefaultContext(): IDefaultConnection {
		// TODO NOTEBOOK REFACTOR fix default connection handling
		let defaultConnection: IConnectionProfile = <any>{
			providerName: notebookConstants.hadoopKnoxProviderName,
			id: '-1',
			options:
			{
				host: localize('selectConnection', 'Select connection')
			}
		};

		return {
			// default context if no other contexts are applicable
			defaultConnection: defaultConnection,
			otherConnections: [defaultConnection]
		};
	}

	/**
	 * Get all of the applicable contexts for a given kernel
	 * @param apiWrapper ApiWrapper
	 * @param kernelChangedArgs kernel changed args (both old and new kernel info)
	 * @param profile current connection profile
	 */
	public static async getContextsForKernel(connectionService: IConnectionManagementService, kernelChangedArgs?: nb.IKernelChangedArgs, profile?: IConnectionProfile): Promise<IDefaultConnection> {
		let connections: IDefaultConnection = this.DefaultContext;
		if (!profile) {
			if (!kernelChangedArgs || !kernelChangedArgs.newValue ||
				(kernelChangedArgs.oldValue && kernelChangedArgs.newValue.id === kernelChangedArgs.oldValue.id)) {
				// nothing to do, kernels are the same or new kernel is undefined
				return connections;
			}
		}
		if (kernelChangedArgs && kernelChangedArgs.newValue && kernelChangedArgs.newValue.name) {
			switch (kernelChangedArgs.newValue.name) {
				case (notebookConstants.python3):
					// python3 case, use this.DefaultContext for the only connection
					break;
				//TO DO: Handle server connections based on kernel type. Right now, we call the same method for all kernel types.
				default:
					connections = await this.getActiveContexts(connectionService, profile);
			}
		} else {
			connections = await this.getActiveContexts(connectionService, profile);
		}
		return connections;
	}

	/**
	 * Get all active contexts and sort them
	 * @param apiWrapper ApiWrapper
	 * @param profile current connection profile
	 */
	public static async getActiveContexts(connectionService: IConnectionManagementService, profile: IConnectionProfile): Promise<IDefaultConnection> {
		let defaultConnection: IConnectionProfile = SparkMagicContexts.DefaultContext.defaultConnection;
		let activeConnections: IConnectionProfile[] = await connectionService.getActiveConnections();
		// If no connections exist, only show 'n/a'
		if (activeConnections && activeConnections.length > 0) {
			// Remove all non-Spark connections
			activeConnections = activeConnections.filter(conn => conn.providerName === notebookConstants.hadoopKnoxProviderName);
		}
		if (activeConnections.length === 0) {
			return SparkMagicContexts.DefaultContext;
		}

		// If launched from the right click or server dashboard, connection profile data exists, so use that as default
		if (profile && profile.options) {
			let profileConnection = activeConnections.filter(conn => conn.options['host'] === profile.options['host']);
			if (profileConnection) {
				defaultConnection = profileConnection[0];
			}
		} else {
			if (activeConnections.length > 0) {
				defaultConnection = activeConnections[0];
			} else {
				// TODO NOTEBOOK REFACTOR change this so it's no longer incompatible with IConnectionProfile
				defaultConnection = <IConnectionProfile><any>{
					providerName: notebookConstants.hadoopKnoxProviderName,
					id: '-1',
					options:
					{
						host: localize('addConnection', 'Add new connection')
					}
				};
				activeConnections.push(defaultConnection);
			}
		}
		return {
			otherConnections: activeConnections,
			defaultConnection: defaultConnection
		};
	}

	public static async configureContext(): Promise<object> {
		let sparkmagicConfDir = path.join(notebookUtils.getUserHome(), '.sparkmagic');
		// TODO NOTEBOOK REFACTOR re-enable this or move to extension. Requires config files to be available in order to work
		await notebookUtils.mkDir(sparkmagicConfDir);

		// Default to localhost in config file.
		let creds: ICredentials = {
			'url': 'http://localhost:8088'
		};

		let config: ISparkMagicConfig = Object.assign({}, configBase);
		SparkMagicContexts.updateConfig(config, creds, sparkmagicConfDir);

		let configFilePath = path.join(sparkmagicConfDir, 'config.json');
		await pfs.writeFile(configFilePath, JSON.stringify(config));

		return { 'SPARKMAGIC_CONF_DIR': sparkmagicConfDir };
	}
	/**
	 *
	 * @param specs kernel specs (comes from session manager)
	 * @param connectionInfo connection profile
	 * @param savedKernelInfo kernel info loaded from
	 */
	public static getDefaultKernel(specs: nb.IAllKernels, connectionInfo: IConnectionProfile, savedKernelInfo: nb.IKernelInfo, notificationService: INotificationService): nb.IKernelSpec {
		let foundSavedKernelInSpecs;
		let defaultKernel;
		if (specs) {
			defaultKernel = specs.kernels.find((kernel) => kernel.name === specs.defaultKernel);
			if (savedKernelInfo) {
				foundSavedKernelInSpecs = specs.kernels.find((kernel) => kernel.name === savedKernelInfo.name);
			}
		}
		let profile = connectionInfo as IConnectionProfile;
		if (specs && connectionInfo && profile.providerName === notebookConstants.hadoopKnoxProviderName) {
			// set default kernel to default spark kernel if profile exists
			// otherwise, set default to kernel info loaded from existing file
			defaultKernel = !foundSavedKernelInSpecs ? specs.kernels.find((spec) => spec.name === notebookConstants.defaultSparkKernel) : foundSavedKernelInSpecs;
		} else {
			// Handle kernels
			if (savedKernelInfo && savedKernelInfo.name.toLowerCase().indexOf('spark') > -1) {
				notificationService.warn(localize('sparkKernelRequiresConnection', 'Cannot use kernel {0} as no connection is active. The default kernel of {1} will be used instead.', savedKernelInfo.display_name, defaultKernel.display_name));
			}
		}

		// If no default kernel specified (should never happen), default to python3
		if (!defaultKernel) {
			defaultKernel = {
				name: notebookConstants.python3,
				display_name: notebookConstants.python3DisplayName
			};
		}
		return defaultKernel;
	}

	private static updateConfig(config: ISparkMagicConfig, creds: ICredentials, homePath: string): void {
		config.kernel_python_credentials = creds;
		config.kernel_scala_credentials = creds;
		config.kernel_r_credentials = creds;
		config.logging_config.handlers.magicsHandler.home_path = homePath;
	}
}

interface ICredentials {
	'url': string;
}

interface ISparkMagicConfig {
	kernel_python_credentials: ICredentials;
	kernel_scala_credentials: ICredentials;
	kernel_r_credentials: ICredentials;
	ignore_ssl_errors?: boolean;
	logging_config: {
		handlers: {
			magicsHandler: {
				home_path: string;
				class?: string;
				formatter?: string
			}
		}
	};

}

export interface IKernelJupyterID {
	id: string;
	jupyterId: string;
}
