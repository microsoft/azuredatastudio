/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { generateUuid } from 'vs/base/common/uuid';

export namespace NotebookViewsUpgrades {
	export class V1ToV2NotebookViewsExtensionUpgrade {
		sourceVersion = 1;
		targetVersion = 2;

		versionCheck(version: number): boolean {
			return version > this.targetVersion;
		}

		apply(notebookViewsExtension: NotebookViewsExtension): void {
			const extensions = notebookViewsExtension.notebook.getMetaValue('extensions');
			const notebookviews = extensions['notebookviews'];
			const views = notebookviews['views'];

			const newmeta = {
				version: 2,
				activeView: null,
				views: []
			};

			views.forEach((view, viewIdx) => {
				const viewData = {
					guid: view.guid,
					name: view.name,
					cards: []
				};

				const cells = notebookViewsExtension.notebook.cells;
				cells.forEach((cell) => {
					const cellmeta = cell.metadata['extensions']?.['notebookviews']?.['views']?.[viewIdx];
					if (cellmeta && !cellmeta?.hidden) {
						const card = {
							guid: generateUuid(),
							y: cellmeta.y,
							x: cellmeta.x,
							width: cellmeta.width,
							height: cellmeta.height,
							tabs: [{
								title: 'Untitled',
								guid: generateUuid(),
								cell: {
									guid: cell.cellGuid
								}
							}]
						};

						viewData.cards.push(card);
					}
				});

				newmeta.views.push(viewData);
			});

			notebookViewsExtension.setExtensionMetadata(notebookViewsExtension.notebook, newmeta);
		}
	}
}
