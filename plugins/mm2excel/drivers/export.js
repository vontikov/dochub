const ExcelJS = require('exceljs');
const columnsIndex = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DATA_ROWS_LIMIT = 1000;

async function explainJSONSchema(schema, path, row = 1, parent) {
    if (schema?.type != 'object') {
        throw `Я не умею обрабатывать тип [${schema?.type}]`;
    }

    let columns = [];
    let applyParent = parent;

    if (schema.patternProperties) {
        for (const prop in schema?.patternProperties) {
            columns.push({
                header: 'ID',
                path: `${path}/$id`,
                width: 32,
                row,
                parent: applyParent
            });
            applyParent = null;
            schema = schema?.patternProperties[prop];
            break;
        }
    }

    for (const propId in schema.properties || {}) {
        const prop = schema.properties[propId];
        const header = prop.title || propId;
        const note = prop.description;
        const column = {
            header,
            path: `${path}/${propId}`,
            width: header.length * 2,
            parent: applyParent
        };

        if ((prop['$ref'] || '').startsWith('#/$rels/')) {
            column.rel = prop['$ref'].slice(7);
            prop.type = 'string';
        }

        applyParent = null;
        switch (prop.type || 'string') {
            case 'integer':
                column.numFmt = '#0';
                column.alignment = { vertical: 'middle', horizontal: 'right' };
                break;
            case 'number':
                column.numFmt = '#,##0.00';
                column.alignment = { vertical: 'middle', horizontal: 'right' };
                break;
            case 'string':
                column.alignment = { vertical: 'middle', horizontal: 'left' };
                if (prop.enum) {
                    column.suggest = {
                        type: 'enum',
                        enum: prop.enum
                    };
                }
                break;
            case 'object': {
                column.isHeader = true;
                const subColumns = await explainJSONSchema(prop, path, row + 1, column);
                column.mergeCols = subColumns.length;
                columns = columns.concat(subColumns);
                break;
            }
            case 'array':
                column.alignment = { vertical: 'middle', horizontal: 'left' };
                break;
            default:
                throw `Не могу обработать тип поля [${prop?.type}]`;
        }
        column.type = prop?.type;
        column.row = row;
        column.note = note;
        if (!column.isHeader)
            columns.push(column);
    }
    return columns;
}

async function applyHeaderCellStyle(cell) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '00CCCCCC' }
    };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
}

async function fillTableHeader(columns, sheet, relResolver) {
    const rowMax = columns.reduce((value, column) => Math.max(value, column.row), -Infinity);

    columns.map((column, index) => {
        const from = `${columnsIndex[index]}${column.row}`;
        const to = `${columnsIndex[index]}${rowMax}`;
        column.rowMax = rowMax;

        if (column.row < rowMax)
            sheet.mergeCells(`${from}:${to}`);

        const cell = sheet.getCell(from);
        cell.value = column.header;
        column.note && (cell.note = column.note);
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        applyHeaderCellStyle(cell);

        for (let parent = column.parent; parent; parent = parent.parent) {
            const from = `${columnsIndex[index]}${parent.row}`;
            const to = `${columnsIndex[index + parent.mergeCols - 1]}${parent.row}`;
            sheet.mergeCells(`${from}:${to}`);
            const cell = sheet.getCell(from);
            cell.value = parent.header;
            applyHeaderCellStyle(cell);
        }

        for (let i = rowMax + 1; i < DATA_ROWS_LIMIT; i++) {
            const address = `${columnsIndex[index]}${i}`;
            const cell = sheet.getCell(address);

            column.alignment && (cell.alignment = column.alignment);
            column.numFmt && (cell.numFmt = column.numFmt);
            cell.protection = {
                locked: false,
                hidden: false
            };
            if (column.suggest) {
                switch (column.suggest?.type) {
                    case 'enum': {
                        cell.dataValidation = {
                            type: 'list',
                            allowBlank: true,
                            formulae: [`"${column.suggest.enum.join(',')}"`]
                        };
                        break;
                    }
                    default:
                        throw `Я не имею обрабатывать подсказки [${column.suggest?.type}].`;
                }
            } else if (column.rel) {
                relResolver(column.rel, (source) => {
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: false,
                        formulae: [source]
                    };
                });
            }
        }
    });
}

async function getSchemaOfObjectProfile(objectId, context) {
    const entityId = objectId.split('.').slice(0, -1).join('.');
    let schema = context.data.schema[entityId];
    const profile = context.data.objects[objectId];
    const route = (profile.route || '/').split('/');
    for (let i = 1; i < route.length; i++) {
        const pice = route[i];
        pice && (schema = schema?.properties[route[i]] || {});
    }
    return schema;
}

async function appendSheet(path, sheetId, schema, context) {
    const sheet = {
        path,
        sheetId,
        schema,
        sheet: context.workbook.addWorksheet(sheetId),
        columns: []
    };
    context.sheets.push(sheet);

    try {
        const columns = await explainJSONSchema(schema, path);
        sheet.sheet.columns = (sheet.columns = columns);
        await fillTableHeader(columns, sheet.sheet, (rel, callback) => {
            context.relResolvers.push({
                rel,
                callback
            });
        });
        await sheet.sheet.protect();
    } catch (e) {
        throw `Возникла ошибка при генерации листа [${sheetId}] путь [${path}]: ${e}`;
    }

    return sheet;
}

async function buildWorkbook(workbook, config) {
    workbook.creator = 'DocHub';
    // Создаем контекст
    const data = await config.pullData(`
        (
            $entities := entities;
            $targets := ["${config.entities.join('", "')}"];
            $items := $targets.(
                $entityId := $;
                $entity := $lookup($entities, $entityId);
                {
                    "schema": { $entityId: $entity.schema},
                    "objects": $entity.objects.$spread().(
                        $objectId := $keys()[0];
                        {
                            $entityId & "." & $objectId: $entity
                        }
                    )
                }
            );
            {
                "schema": $merge($items.schema),
                "objects": $merge($items.objects)
            }
        )
    `);
    const context = {
        workbook,
        data,
        sheets: [],
        relResolvers: []
    };

    // Генерируем таблицы
    for (const objectId in data.objects) {
        const profile = data.objects[objectId];
        await appendSheet(
            `/${objectId}`,
            profile.title || profile.objectId,
            await getSchemaOfObjectProfile(objectId, context),
            context
        );
    }

    // Разрешаем связи
    context.relResolvers.map((relation) => {
        context.sheets.map((sheet) => {
            sheet.columns.map((column, colIndex) => {
                if (column.path === `${relation.rel}/$id`) {
                    const colChar = columnsIndex[colIndex + 1];
                    const sheetName = sheet.sheet.name;
                    const name = column.path.slice(1).split('/').join('___');
                    context.workbook.definedNames.add(`'${sheetName}'!$${colChar}$${column.rowMax + 1}:${colChar}$${DATA_ROWS_LIMIT}`, name);
                    relation.callback(name);
                }
            });
        });
    });

}

async function exportWorkbook(workbook) {
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer],
        {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'download.xls';
    anchor.click();
    window.URL.revokeObjectURL(url);
}

async function createWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DocHub';
    workbook.lastModifiedBy = 'DocHub';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = true;
    return workbook;
}


export default async function(config) {
    const workbook = await createWorkbook();
    await buildWorkbook(workbook, config);
    await exportWorkbook(workbook);
}
