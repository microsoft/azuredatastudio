/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Simple fake Azdata Api used to mock the API during tests
 */
export class FakePostgresServerShowResult {

	public get result() {
		return {
			apiVersion: 'version',
			kind: 'postgresql',
			metadata: {
				creationTimestamp: '',
				generation: 1,
				name: 'pgt',
				namespace: 'ns',
				resourceVersion: '',
				selfLink: '',
				uid: '',
			},
			spec: {
				engine: {
					extensions: [{ name: '' }],
					settings: {
						default: { ['']: '' }
					}
				},
				scale: {
					shards: 0,
					workers: 0
				},
				scheduling: {
					default: {
						resources: {
							requests: {
								cpu: '',
								memory: ''
							},
							limits: {
								cpu: '',
								memory: ''
							}
						}
					}
				},
				service: {
					type: '',
					port: 0
				},
				storage: {
					data: {
						className: '',
						size: ''
					},
					logs: {
						className: '',
						size: ''
					},
					backups: {
						className: '',
						size: ''
					}
				}
			},
			status: {
				externalEndpoint: '127.0.0.1:5432',
				readyPods: '',
				state: '',
				logSearchDashboard: '',
				metricsDashboard: '',
				podsStatus: [{
					conditions: [{
						lastTransitionTime: '',
						message: '',
						reason: '',
						status: '',
						type: '',
					}],
					name: '',
					role: '',
				}]
			}
		};
	}

}
