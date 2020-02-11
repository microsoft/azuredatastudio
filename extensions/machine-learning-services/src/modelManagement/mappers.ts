/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as msRest from '@azure/ms-rest-js';

export const Resource: msRest.CompositeMapper = {
	serializedName: 'Resource',
	type: {
		name: 'Composite',
		className: 'Resource',
		modelProperties: {
			id: {
				readOnly: true,
				serializedName: 'id',
				type: {
					name: 'String'
				}
			},
			name: {
				readOnly: true,
				serializedName: 'name',
				type: {
					name: 'String'
				}
			},
			identity: {
				readOnly: true,
				serializedName: 'identity',
				type: {
					name: 'Composite',
					className: 'Identity'
				}
			},
			location: {
				serializedName: 'location',
				type: {
					name: 'String'
				}
			},
			type: {
				readOnly: true,
				serializedName: 'type',
				type: {
					name: 'String'
				}
			},
			tags: {
				serializedName: 'tags',
				type: {
					name: 'Dictionary',
					value: {
						type: {
							name: 'String'
						}
					}
				}
			}
		}
	}
};

export const ListWorkspaceModelsResult: msRest.CompositeMapper = {
	serializedName: 'ListWorkspaceModelsResult',
	type: {
		name: 'Composite',
		className: 'ListWorkspaceModelsResult',
		modelProperties: {
			value: {
				serializedName: '',
				type: {
					name: 'Sequence',
					element: {
						type: {
							name: 'Composite',
							className: 'WorkspaceModel'
						}
					}
				}
			},
			nextLink: {
				serializedName: 'nextLink',
				type: {
					name: 'String'
				}
			}
		}
	}
};

export const WorkspaceModel: msRest.CompositeMapper = {
	serializedName: 'WorkspaceModel',
	type: {
		name: 'Composite',
		className: 'WorkspaceModel',
		modelProperties: {
			...Resource.type.modelProperties,
			framework: {
				readOnly: true,
				serializedName: 'framework',
				type: {
					name: 'String'
				}
			},
		}
	}
};

export const MachineLearningServiceError: msRest.CompositeMapper = {
	serializedName: 'MachineLearningServiceError',
	type: {
		name: 'Composite',
		className: 'MachineLearningServiceError',
		modelProperties: {
			error: {
				readOnly: true,
				serializedName: 'error',
				type: {
					name: 'Composite',
					className: 'ErrorResponse'
				}
			}
		}
	}
};
