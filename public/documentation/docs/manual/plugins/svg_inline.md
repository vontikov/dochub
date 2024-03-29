# Страница для проверки встраивания SVG файла в другой документ


Оригинальный шаблон:
![Шаблон](templates/test.svg)

Результат применения данных к шаблону:
```yaml
 docs:
   dochub.plugins.svg_file:
     title: Проверка svg
     type: svg
     location: DocHub/Руководство/Плагины/Примеры/SVG/Пример svg
     template: templates/test.svg
     source: >
       (
       {
           "component1": "Название компонента 1",
           "component2": "Название компонента 2"
          /* "line1_text1": "Текст для стрелки" */
       }
       )
```

Результат: 
```
![svg-документ](@document/dochub.plugins.svg_file)
```

![svg-документ](@document/dochub.plugins.svg_file)


Проверка заполнения параметров в шаблоне:
для этого отображение делается с параметром check=1
В результате будет список не найденных параметров в самом шаблоне и в запросе.

```
![svg-документ](@document/dochub.plugins.svg_file?check=1)
```

![svg-документ](@document/dochub.plugins.svg_file?check=1)



