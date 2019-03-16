/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//#region --- workbench/editor core

import 'vs/editor/editor.all';

import 'vs/workbench/api/electron-browser/extensionHost.contribution';

import 'vs/workbench/electron-browser/main.contribution';
import 'vs/workbench/browser/workbench.contribution';

import 'vs/workbench/electron-browser/main';

//#endregion


//#region --- workbench actions

import 'vs/workbench/browser/actions/layoutActions';
import 'vs/workbench/browser/actions/listCommands';
import 'vs/workbench/browser/actions/navigationActions';
import 'vs/workbench/browser/parts/quickopen/quickopenActions';
import 'vs/workbench/browser/parts/quickinput/quickInputActions';

//#endregion


//#region --- API Extension Points

import 'vs/workbench/api/common/menusExtensionPoint';
import 'vs/workbench/api/common/configurationExtensionPoint';
import 'vs/workbench/api/browser/viewsExtensionPoint';

//#endregion


//#region --- workbench services

import 'vs/workbench/services/bulkEdit/electron-browser/bulkEditService';

//#endregion


//#region --- workbench contributions

// Localizations
import 'vs/workbench/contrib/localizations/electron-browser/localizations.contribution';

// Preferences
import 'vs/workbench/contrib/preferences/electron-browser/preferences.contribution';
import 'vs/workbench/contrib/preferences/browser/keybindingsEditorContribution';

// Logs
import 'vs/workbench/contrib/logs/electron-browser/logs.contribution';

// Quick Open Handlers
import 'vs/workbench/contrib/quickopen/browser/quickopen.contribution';

// Explorer
import 'vs/workbench/contrib/files/electron-browser/explorerViewlet';
import 'vs/workbench/contrib/files/electron-browser/fileActions.contribution';
import 'vs/workbench/contrib/files/electron-browser/files.contribution';

// Backup
import 'vs/workbench/contrib/backup/common/backup.contribution';

// Stats
import 'vs/workbench/contrib/stats/node/stats.contribution';

// Rapid Render Splash
import 'vs/workbench/contrib/splash/electron-browser/partsSplash.contribution';

// Search
import 'vs/workbench/contrib/search/browser/search.contribution';
import 'vs/workbench/contrib/search/browser/searchView';
import 'vs/workbench/contrib/search/browser/openAnythingHandler';

// SCM
import 'vs/workbench/contrib/scm/electron-browser/scm.contribution';
import 'vs/workbench/contrib/scm/electron-browser/scmViewlet';

// {{SQL CARBON EDIT}}
// Debug
// import 'vs/workbench/contrib/debug/electron-browser/debug.contribution';
// import 'vs/workbench/contrib/debug/browser/debugQuickOpen';
// import 'vs/workbench/contrib/debug/electron-browser/repl';
// import 'vs/workbench/contrib/debug/browser/debugViewlet';

// Markers
import 'vs/workbench/contrib/markers/electron-browser/markers.contribution';

// Comments
import 'vs/workbench/contrib/comments/electron-browser/comments.contribution';

// HTML Preview
import 'vs/workbench/contrib/html/electron-browser/html.contribution';

// URL Support
import 'vs/workbench/contrib/url/electron-browser/url.contribution';

// {{SQL CARBON EDIT}}
// Webview
// import 'vs/workbench/contrib/webview/electron-browser/webview.contribution';

// Extensions Management
import 'vs/workbench/contrib/extensions/electron-browser/extensions.contribution';
import 'vs/workbench/contrib/extensions/browser/extensionsQuickOpen';
import 'vs/workbench/contrib/extensions/electron-browser/extensionsViewlet';

// Output Panel
import 'vs/workbench/contrib/output/electron-browser/output.contribution';
import 'vs/workbench/contrib/output/browser/outputPanel';

// Terminal
import 'vs/workbench/contrib/terminal/electron-browser/terminal.contribution';
import 'vs/workbench/contrib/terminal/browser/terminalQuickOpen';
import 'vs/workbench/contrib/terminal/electron-browser/terminalPanel';

// Relauncher
import 'vs/workbench/contrib/relauncher/electron-browser/relauncher.contribution';

// Tasks
import 'vs/workbench/contrib/tasks/electron-browser/task.contribution';

// {{SQL CARBON EDIT}}
// Emmet
// import 'vs/workbench/contrib/emmet/browser/emmet.browser.contribution';
// import 'vs/workbench/contrib/emmet/electron-browser/emmet.contribution';

// CodeEditor Contributions
import 'vs/workbench/contrib/codeEditor/electron-browser/codeEditor.contribution';

// Execution
import 'vs/workbench/contrib/execution/electron-browser/execution.contribution';

// Snippets
import 'vs/workbench/contrib/snippets/browser/snippets.contribution';
import 'vs/workbench/contrib/snippets/browser/snippetsService';
import 'vs/workbench/contrib/snippets/browser/insertSnippet';
import 'vs/workbench/contrib/snippets/browser/configureSnippets';
import 'vs/workbench/contrib/snippets/browser/tabCompletion';

// Formatter Help
import 'vs/workbench/contrib/format/browser/format.contribution';

// Send a Smile
import 'vs/workbench/contrib/feedback/electron-browser/feedback.contribution';

// Update
import 'vs/workbench/contrib/update/electron-browser/update.contribution';

// Surveys
import 'vs/workbench/contrib/surveys/electron-browser/nps.contribution';
import 'vs/workbench/contrib/surveys/electron-browser/languageSurveys.contribution';

// Performance
import 'vs/workbench/contrib/performance/electron-browser/performance.contribution';

// CLI
import 'vs/workbench/contrib/cli/electron-browser/cli.contribution';

// Themes Support
import 'vs/workbench/contrib/themes/electron-browser/themes.contribution';
import 'vs/workbench/contrib/themes/test/electron-browser/themes.test.contribution';

// Watermark
import 'vs/workbench/contrib/watermark/electron-browser/watermark';

// Welcome
import 'vs/workbench/contrib/welcome/walkThrough/electron-browser/walkThrough.contribution';
import 'vs/workbench/contrib/welcome/gettingStarted/electron-browser/gettingStarted.contribution';
import 'vs/workbench/contrib/welcome/overlay/browser/welcomeOverlay';
import 'vs/workbench/contrib/welcome/page/electron-browser/welcomePage.contribution';

// Outline
import 'vs/workbench/contrib/outline/browser/outline.contribution';

// Experiments
import 'vs/workbench/contrib/experiments/electron-browser/experiments.contribution';

// Code Insets
import 'vs/workbench/contrib/codeinset/electron-browser/codeInset.contribution';

// Issues
import 'vs/workbench/contrib/issue/electron-browser/issue.contribution';

// {{SQL CARBON EDIT}}
// SQL
import 'sql/parts/taskHistory/common/taskHistory.contribution';
import 'sql/parts/taskHistory/viewlet/taskHistoryViewlet';
import 'sql/parts/tasks/common/tasks.contribution';

// data explorer
import 'sql/parts/dataExplorer/common/dataExplorer.contribution';
import 'sql/parts/dataExplorer/viewlet/dataExplorerViewlet';
import 'sql/parts/dataExplorer/common/dataExplorerExtensionPoint';
import 'sql/workbench/parts/dataExplorer/electron-browser/nodeActions.contribution';

import 'sql/parts/objectExplorer/common/registeredServer.contribution';
import 'sql/workbench/parts/connection/electron-browser/connectionViewlet';
import 'sql/workbench/api/node/sqlExtHost.contribution';
import 'sql/parts/connection/common/connection.contribution';
import 'sql/parts/query/common/query.contribution';
import 'sql/parts/query/editor/resultsGridContribution';
import 'sql/parts/profiler/contrib/profiler.contribution';
import 'sql/parts/profiler/contrib/profilerActions.contribution';
import 'sql/parts/objectExplorer/serverGroupDialog/serverGroup.contribution';
import 'sql/parts/accountManagement/common/accountManagement.contribution';
/* Insights */
import 'sql/parts/dashboard/widgets/insights/views/charts/types/barChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/doughnutChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/horizontalBarChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/lineChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/pieChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/scatterChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/charts/types/timeSeriesChart.contribution';
import 'sql/parts/dashboard/widgets/insights/views/countInsight.contribution';
import 'sql/parts/dashboard/widgets/insights/views/imageInsight.contribution';
import 'sql/parts/dashboard/widgets/insights/views/tableInsight.contribution';
/* Tasks */
import 'sql/workbench/common/actions.contribution';
/* Widgets */
import 'sql/parts/dashboard/widgets/insights/insightsWidget.contribution';
import 'sql/parts/dashboard/widgets/explorer/explorerWidget.contribution';
import 'sql/parts/dashboard/widgets/tasks/tasksWidget.contribution';
import 'sql/parts/dashboard/widgets/webview/webviewWidget.contribution';
import 'sql/parts/dashboard/dashboardConfig.contribution';
/* Model-based Views */
import 'sql/parts/modelComponents/components.contribution';
/* View Model Editor */
import 'sql/parts/modelComponents/modelEditor/modelViewEditor.contribution';
/* Notebook Editor */
import 'sql/parts/notebook/notebook.contribution';
/* Containers */
import 'sql/parts/dashboard/containers/dashboardWebviewContainer.contribution';
import 'sql/parts/dashboard/containers/dashboardControlHostContainer.contribution';
import 'sql/parts/dashboard/containers/dashboardGridContainer.contribution';
import 'sql/parts/dashboard/containers/dashboardWidgetContainer.contribution';
import 'sql/parts/dashboard/containers/dashboardContainer.contribution';
import 'sql/parts/dashboard/containers/dashboardNavSection.contribution';
import 'sql/parts/dashboard/containers/dashboardModelViewContainer.contribution';
import 'sql/parts/dashboard/common/dashboardTab.contribution';
