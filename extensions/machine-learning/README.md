# Machine Learning extension for Azure Data Studio

The Machine Learning extension for Azure Data Studio enables you to manage packages, import machine learning models, make predictions, and create notebooks to run experiments for SQL databases.

For more information, see the [Machine Learning extension documentation](https://go.microsoft.com/fwlink/?linkid=2129918).

## Installation

Find the **Machine Learning** extension in Azure Data Studio and install the latest available version.

The following prerequisites need to be installed on the computer you run Azure Data Studio on:

- Python 3. Specify the local path to a preexisting Python installation under **Settings**. If you have used a Python kernel notebook in Azure Data Studio, the extension will use the path from the notebook by default.
- [Microsoft ODBC driver 17 for SQL Server](https://go.microsoft.com/fwlink/?linkid=2129818) for Windows, macOS, or Linux.
- R 3.5 (optional). Enable R and specify the local path to a preexisting R installation under **Settings**. This is only required if you want to manage R packages in your database.

For more information on how to install and configure the prerequisites, see the [Machine Learning extension documentation](https://go.microsoft.com/fwlink/?linkid=2129918).

## Manage packages

You can install and uninstall Python and R packages in your SQL database with Azure Data Studio. The packages you install can be used in Python or R scripts running in-database using the `sp_execute_external_script` T-SQL statement. This feature is currently limited to work with [SQL Server Machine Learning Services](https://go.microsoft.com/fwlink/?linkid=2128672).

Click on **Manage packages in database** to install or uninstall a Python or R package. For more information, see [how to manage packages with the Machine Learning extension](https://go.microsoft.com/fwlink/?linkid=2129919).

## Make predictions

With the extension, you can use an ONNX model to make predictions. The model can either be an existing model stored in your database or an imported model. This feature is currently limited to work with [Azure SQL Edge](https://go.microsoft.com/fwlink/?linkid=2129794).

Click on **Make predictions** and choose between importing an ONNX model or use an existing model stored in your database. A T-SQL script will then be generated, which you can use to make predictions. For more information, see [how to make predictions with the Machine Learning extension](https://go.microsoft.com/fwlink/?linkid=2129795).

## Import models

The Machine Learning extension can import ONNX models into your database. You can then use these models to make predictions. This feature is currently limited to work with [Azure SQL Edge](https://go.microsoft.com/fwlink/?linkid=2129794).

Click on **Import models** and choose between importing a model from a file or from Azure Machine Learning. For more information, see [how to import models with the Machine Learning extension](https://go.microsoft.com/fwlink/?linkid=2129796).

## Create notebook

You can run experiments and create models in Python with a notebook in Azure Data Studio. You can also run T-SQL code, and run Python and R with SQL Server Machine Learning Services, in a notebook.

Click on **Create notebook** to create a new notebook in Azure Data Studio. For more information, see [how to create a notebook with the Machine Learning extension](https://go.microsoft.com/fwlink/?linkid=2129920).

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
