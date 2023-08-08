# Azure Data Studio AI Documentation Generator

The Azure Data Studio AI Documentation Generator is an extension designed to automate the process of generating comprehensive database documentation using artificial intelligence. This tool simplifies the task of creating detailed database diagrams and provides explanations for tables, relationships, and fields within the tables. It can also provide useful database summary documentation for large databases. The resulting documentation is saved in a markdown file format, allowing authorized users to easily access and make edits as needed.

## How it works
Within the Azure Data Studio Object Explorer, right click on either a database, schema, table, or view. Choose the "View Documentation" option, and wait for your documentation to be generated!

## Usage
The entry point for the extension is shown below:

![Right click on database object, and select "View Documentation"](https://github.com/microsoft/azuredatastudio/blob/laurennathan/database-documentation/extensions/database-documentation/images/EntryPoint.png)
Right click on database object, and select "View Documentation"

![To regenerate documentation, choose the refresh button on the top right of your active editor](https://github.com/microsoft/azuredatastudio/blob/laurennathan/database-documentation/extensions/database-documentation/images/Regenerate.png)
To regenerate documentation, choose the refresh button on the top right of your active editor

![To save documentation, choose the save button on the top right of your active editor](https://github.com/microsoft/azuredatastudio/blob/laurennathan/database-documentation/extensions/database-documentation/images/Save.png)
To save documentation, choose the save button on the top right of your active editor

![In the database summary documentation, links to pre-existing documentation are generated. Click them to be taken to the documentation.](https://github.com/microsoft/azuredatastudio/blob/laurennathan/database-documentation/extensions/database-documentation/images/Links.png)
In the database summary documentation, links to pre-existing documentation are generated. Click them to be taken to the documentation.

![To set a specific number of objects to document in a database before switching over to database summary documentation, use Ctrl + Shift + P and choose Database Documentation: Set Max Number of Objects to Document](https://github.com/microsoft/azuredatastudio/blob/laurennathan/database-documentation/extensions/database-documentation/images/MaxObjects.png)
To set a specific number of objects to document in a database before switching over to database summary documentation, use Ctrl + Shift + P and choose Database Documentation: Set Max Number of Objects to Document

## Features
- Automated Database Documentation: The extension utilizes AI algorithms to automatically generate detailed database documentation, saving significant time and effort.
- Comprehensive Database Diagrams: The tool creates comprehensive and visually appealing diagrams that represent the structure of the database, including tables, relationships, and fields.
- Explanations for Tables, Relationships, and Fields: The generated documentation provides clear explanations for each table, relationship, and field within the database, making it easier for users to understand and navigate.
- Markdown File Format: The documentation is saved in a markdown file format, which is widely supported and allows for easy editing and collaboration among authorized users.

## Dependencies
This extension is packaged with a mermaid rendering extension, which will render the mermaid diagrams generated. Upon installation and activation of this extension, you can choose whether you want to install the mermaid extension.


