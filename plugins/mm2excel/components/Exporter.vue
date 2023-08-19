<template>
  <div>
    <h1>Я экспортер в Excel!</h1>
    <button v-on:click="doExport">Экспорт</button>
  </div>
</template>

<script>

  import queries from '../tools/queries';
  const ExcelJS = require('exceljs');
  const columnsIndex = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const DATA_ROWS_LIMIT = 1000;

  export default {
    name: 'MM2ExcelExporter',
    props: {
      // Требуем обязательно передавать профайл документа 
      profile: {
        type: Object,
        required: true
      },
      // Требуем обязательно передавать функцию получения контента
      getContent: {
        type: Function,
        required: true
      },
      // Требуем обязательно передавать функцию доступа к Data Lake
      pullData: {
        type: Function,
        required: true
      },
      // Требуем обязательно сообщать путь к объекту описывающему документ в коде
      path: {
        type: String,
        required: true
      },
      // Запрашиваем параметры рендеринга
      params: {
        type: Object,
        default: null
      },
      // Признак рендеринга для печати
      toPrint: {
        type: Boolean,
        default: false
      }
    },
    data() {
      return {
      };
    },
    methods: {

      async explainJSONSchema(schema, prefix = '', row = 1, parent) {
        if (schema?.type != 'object')
          throw `Я не умею обрабатывать тип [${schema?.type}]`;

        let columns = [];
        let applyParent = parent;

        if (schema.patternProperties) {
          for (const prop in schema?.patternProperties) {
            columns.push({ 
              header: 'ID',
              key: `${prefix}/$id`,
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
          const key = `${prefix}/${propId}`;
          const column = {
            header,
            key,
            width: header.length * 2,
            parent: applyParent
          };
          applyParent = null;
          switch (prop?.type) {
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
              const subColumns = await this.explainJSONSchema(prop, key, row + 1, column);
              column.mergeCols = subColumns.length;
              columns = columns.concat(subColumns);
              break;
            }
          }
          column.type = prop?.type;
          column.row = row;
          if (!column.isHeader)
            columns.push(column);
        }
        return columns;
      },

      async applyHeaderCellStyle(cell) {
        cell.fill = {
          type: 'pattern',
          pattern:'solid',
          fgColor:{argb:'00CCCCCC'}
        };
        cell.border = {
          top: {style:'thin'},
          left: {style:'thin'},
          bottom: {style:'thin'},
          right: {style:'thin'}
        };
      },

      async fillTableHeader(columns, sheet) {
        const rowMax = columns.reduce((value, column) => Math.max(value, column.row), -Infinity);
        
        columns.map((column, index) => {
          const from = `${columnsIndex[index]}${column.row}`;
          const to = `${columnsIndex[index]}${rowMax}`;

          if (column.row < rowMax)
            sheet.mergeCells(`${from}:${to}`);

          const cell = sheet.getCell(from);
          cell.value = column.header;
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
          this.applyHeaderCellStyle(cell);

          for (let parent = column.parent; parent; parent = parent.parent) {
            const from = `${columnsIndex[index]}${parent.row}`;
            const to = `${columnsIndex[index + parent.mergeCols - 1]}${parent.row}`;
            sheet.mergeCells(`${from}:${to}`);
            const cell = sheet.getCell(from);
            cell.value = parent.header;
            this.applyHeaderCellStyle(cell);
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
            if (column.suggest)
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
          }

          /*
          if (column.row) {
            const from = `${columnsIndex[index]}${column.row}`;
            const to = `${columnsIndex[index + column.colDeep]}${column.row}`;
            context.sheet.mergeCells(`${from}:${to}`);
            context.sheet.getCell(from).value = column.header;
          }
          */
        });
      },

      async getSchemaOfObjectProfile(objectId, context) {
        const entityId = objectId.split('.')[0];
        let schema = context.data.schema[entityId];
        const profile = context.data.objects[objectId];
        const route = (profile.route || '/').split('/');
        for (let i = 1; i < route.length; i ++) {
          const pice = route[i];
          pice && (schema = schema?.properties[route[i]] || {});
        }
        return schema;

        /*
        if (schema.patternProperties) {
          for (const prop in schema?.patternProperties) {
            columns.push({ header: 'ID', key: '$id', width: 32});
            schema = schema?.patternProperties[prop];
            break;
          }
        }

        if (!schema) throw `Не могу разобраться что делать тут [${profile.route}] для [${context.id}].`;

        let colIndex = 1;
        for (const propId in schema.properties || {}) {
          const prop = schema.properties[propId];
          const header = prop.title || propId;
          columns.push({
            header,
            key: propId,
            width: header.length * 2
          });
          if (prop.enum) {
            context.sheet.getCell(`${columnsIndex[colIndex]}2:${columnsIndex[colIndex]}9999`).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`"${prop.enum.join(',')}"`]
            };
          }
          colIndex++;
        }
        */

        // context.sheet.columns = columns;
        /*
        sheet.addRow({id: 1, name: 'John Doe', dob: new Date(1970,1,1)});

        sheet.mergeCells('A4:B5');

        sheet.getCell('A1').dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"One,Two,Three,Four"']
        };

        sheet.getCell('B1').dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['B4:B10']
        };
        */
      },

      async appendSheet(path, sheetId, schema, context) {
        const sheet = {
          path,
          sheetId,
          schema,
          sheet: context.workbook.addWorksheet(sheetId)
        };
        context.sheets.push(sheet);

        const columns = await this.explainJSONSchema(schema);
        sheet.sheet.columns = columns;
        await this.fillTableHeader(columns, sheet.sheet);

        await sheet.sheet.protect();

        return sheet;
      },

      async buildWorkbook(workbook) {
        workbook.creator = 'DocHub';
        // Создаем контекст
        const data = await this.pullData(queries.FETCH_ENTITIES);
        const context = {
          workbook,
          data,
          sheets: []
        };
        // Генерируем таблицы
        for(const objectId in data.objects) {
          const profile = data.objects[objectId];
          await this.appendSheet(
            `/${objectId}`,
            profile.title || profile.objectId, 
            await this.getSchemaOfObjectProfile(objectId, context),
            context
          );
        }
       
      },

      async exportWorkbook(workbook) {
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
      },

      async createWorkbook() {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'DocHub';
        workbook.lastModifiedBy = 'DocHub';
        workbook.created = new Date();
        workbook.modified = new Date();
        workbook.properties.date1904 = true;
        return workbook;
      },

      async doExport() {
        const workbook = await this.createWorkbook();
        await this.buildWorkbook(workbook);
        await this.exportWorkbook(workbook);
      }
    }
  };
</script>

<style scoped>
h2 {
  margin-top: 24px;
}

</style>
