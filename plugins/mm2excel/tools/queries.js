export default {
    // Возвращает информацию о существуюбщих сущностях и декларируемых объектах
    FETCH_ENTITIES: `
    (
        $items := entities[*.objects].$spread().(
            $entityId := $keys()[0];
            {
                "schema": { $entityId: *.schema},
                "objects": *.objects.$spread().(
                    $objectId := $keys()[0];
                    {
                        $entityId & "." & $objectId: *
                    }
                )
            }
        );
        {
            "schema": $merge($items.schema),
            "objects": $merge($items.objects)
        }
    )`
};
