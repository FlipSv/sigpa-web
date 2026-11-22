# Correcciones de SIGPA

El usuario trabaja en paralelo con un compañero. El alcance de esta sesión cubre Director, Tutor y ajustes generales compatibles con ese reparto. Las pantallas y funciones de Estudiante y Asesor están a cargo del compañero. Después del paso 1, el usuario autorizó ejecutar todos los pasos pendientes en una sola ronda.

`PropuestaProyectoIntegrador - QUINTO 2026-2.pdf` aporta contexto académico. `Copia de PI SOLUCIONES.pdf` detalla las correcciones. Ambos están en Descargas.

## Paso 1 completado

- Semestres de práctica del 1 al 3. En los datos de prueba, Mateo Gómez corresponde al 1, Lucía Ramírez al 2 y Daniel Herrera al 3. Sus cuentas se aprovisionan desde la base de datos.
- SQLite y el esquema inicial de Oracle incorporan `USUARIO.SEMESTRE` y una restricción de unicidad para el semestre del tutor. SQLite vincula a Laura con el semestre 1 y a Andrés con el 2 en los datos de prueba. Los demás estudiantes necesitan un semestre confirmado antes de poder listarlos por semestre.
- SQLite conserva las prácticas y asignaciones de bases existentes, incluidas las prácticas históricas de semestres 4 a 6. Una base nueva solo trae prácticas de los semestres 1 a 3. El catálogo del Director y las nuevas altas se limitan a esos tres semestres.
- Verificado en Node.js 24 con SQLite. Se probó el primer y segundo arranque con una base nueva y otra creada con el código anterior, el vínculo de los tres tutores, la preservación de asignaciones y las restricciones. Oracle tiene cambios en su esquema inicial, pendientes de ejecución contra una instancia.

## Pasos 2 a 6 implementados

- Director. Se retiraron la distribución de prácticas, la pantalla de Gestión de Cuentas y sus rutas de escritura. La práctica nueva se llama `Práctica <semestre>`, exige semestre, institución con convenio vigente, modalidad y horas. Una pareja de semestre e institución admite una práctica. Una institución puede recibir prácticas de distintos semestres.
- Asignación. El formulario consulta estudiantes activos por semestre y ofrece las instituciones con convenio vigente, práctica abierta para ese semestre y cupo libre. El servidor selecciona práctica y tutor, valida de nuevo el cupo y reserva la plaza al crear una asignación pendiente. El Director puede aprobarla o rechazarla desde su panel.
- Informes. Los accesos del Director abren una sola opción de informe. El selector permite consultar y descargar el informe de una práctica abierta con las horas, las evaluaciones y las observaciones. Los indicadores del panel usan los datos de la base.
- Tutor. La revisión y las estadísticas están en Bitácoras. Una calificación definitiva de 0 a 5 registra el resultado una sola vez, con horas acreditadas desde 3,0. El Tutor puede consultar la bitácora calificada y descargar su PDF. Las consultas y las calificaciones se limitan por la identidad de la sesión. Se preservaron las calificaciones y horas históricas.
- Cambios generales. Las pantallas trabajadas usan Bitácora para nombrar el registro. La campana consulta asignaciones pendientes para el Director y bitácoras pendientes para Tutor. Coordinador comparte la interfaz de Tutor. Estudiante y Asesor quedan a cargo del compañero.

## Paso 7, verificación

- La API se probó por HTTP autenticado sobre SQLite con Node.js 24. Se cubrieron permisos, retiro de la ruta para crear cuentas, creación concurrente de prácticas, filtro por semestre, cupos, tutor automático, aprobación, notas de 0, 2,9 y 3,0, intento de calificar dos veces en paralelo y reflejo de las horas en la consulta existente de Estudiante.
- La migración de una base SQLite del esquema anterior se probó en dos arranques. Conservó las asignaciones y las prácticas históricas y limitó el catálogo a los semestres 1 a 3. Cuando una práctica histórica tiene asignaciones en varias instituciones, se conserva sin institución única y requiere confirmar el vínculo antes de usarla para nuevas asignaciones.
- Se probaron con DOM y generador simulados el filtrado de opciones, el informe de la práctica seleccionada, el modal de solo lectura y la generación del contenido para PDF e impresión. Pendiente probar la descarga directa en un navegador con acceso a jsDelivr. La vista de impresión permite guardar como PDF si jsPDF no carga.
- El esquema inicial y el CLI de actualización de Oracle contienen los cambios de estructura. Pendiente ejecutarlos contra una instancia Oracle y poblar los vínculos académicos confirmados de las cuentas existentes. `database/schema.sql` inicializa desde cero y contiene sentencias de eliminación de tablas.
- El diff preserva el código dedicado a Estudiante y Asesor. Los archivos JavaScript que cambiaron pasaron `node --check` y el diff pasó `git diff --check`.
