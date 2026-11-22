-- ====================================================================
-- SIGPA — Sistema de Gestión de Prácticas Académicas (UDI)
-- Script Idempotente de Sincronización DDL para Oracle 10g Express / XE
-- Esquema: SCOTT/ANDRESF485@localhost:1522/orcl
-- Soporte para 10 Tablas Normalizadas + ASIGNACION
-- ====================================================================

-- ── 1. Secuencias Idempotentes ──────────────────────────────────────
DECLARE
    PROCEDURE create_seq_if_missing(p_seq_name VARCHAR2, p_start NUMBER) IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM USER_SEQUENCES WHERE SEQUENCE_NAME = UPPER(p_seq_name);
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'CREATE SEQUENCE ' || UPPER(p_seq_name) || ' START WITH ' || p_start || ' INCREMENT BY 1 NOCACHE';
        END IF;
    END;
BEGIN
    create_seq_if_missing('SEQ_USUARIO', 10);
    create_seq_if_missing('SEQ_MODALIDAD', 10);
    create_seq_if_missing('SEQ_INSTITUCION', 10);
    create_seq_if_missing('SEQ_PRACTICA', 10);
    create_seq_if_missing('SEQ_ASIGNACION', 10);
    create_seq_if_missing('SEQ_BITACORA', 10);
    create_seq_if_missing('SEQ_VISITA', 10);
    create_seq_if_missing('SEQ_EVALUACION', 10);
    create_seq_if_missing('SEQ_EVIDENCIA', 10);
    create_seq_if_missing('SEQ_PREGUNTA', 20);
    create_seq_if_missing('SEQ_PREGUNTA_GUIA', 20);
END;
/

-- ── 2. Creación Idempotente de Tablas ───────────────────────────────

-- 2.1 MODALIDAD
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'MODALIDAD';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE MODALIDAD (
                ID_MODALIDAD   NUMBER(10) PRIMARY KEY,
                NOMBRE         VARCHAR2(100) NOT NULL,
                DESCRIPCION    VARCHAR2(500),
                HORAS_DEFAULT  NUMBER(4) DEFAULT 64,
                ESTADO         VARCHAR2(10) DEFAULT ''ACTIVO'' CHECK (ESTADO IN (''ACTIVO'', ''INACTIVO''))
            )';
    END IF;
END;
/

-- 2.2 INSTITUCION
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'INSTITUCION';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE INSTITUCION (
                ID_INSTITUCION       NUMBER(10) PRIMARY KEY,
                NOMBRE               VARCHAR2(200) NOT NULL,
                DIRECCION            VARCHAR2(250),
                TELEFONO             VARCHAR2(50),
                CONVENIO_ACTIVO      VARCHAR2(10) DEFAULT ''S'' CHECK (CONVENIO_ACTIVO IN (''S'', ''N'')),
                CUPOS_DISPONIBLES    NUMBER(4) DEFAULT 5,
                FECHA_VENC_CONVENIO  DATE
            )';
    END IF;
END;
/

-- 2.3 EVALUACION
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'EVALUACION';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE EVALUACION (
                ID_EVALUACION    NUMBER(10) PRIMARY KEY,
                ID_BITACORA      NUMBER(10) NOT NULL,
                ID_EVALUADOR     NUMBER(10) NOT NULL,
                TIPO_EVALUADOR   VARCHAR2(20) NOT NULL CHECK (TIPO_EVALUADOR IN (''TUTOR'', ''ASESOR'')),
                NOTA             NUMBER(4,2) NOT NULL,
                COMENTARIOS      VARCHAR2(1000),
                FECHA_EVALUACION DATE
            )';
    END IF;
END;
/

-- 2.4 VISITA
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'VISITA';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE VISITA (
                ID_VISITA         NUMBER(10) PRIMARY KEY,
                ID_ASIGNACION     NUMBER(10),
                ID_PRACTICA       NUMBER(10),
                NUMERO_VISITA     NUMBER(4) NOT NULL,
                FECHA_PROGRAMADA  DATE,
                FECHA_REALIZADA   DATE,
                ESTADO            VARCHAR2(20) DEFAULT ''PROGRAMADA'' CHECK (ESTADO IN (''PROGRAMADA'', ''REALIZADA'', ''CANCELADA'')),
                TIPO_VISITA       VARCHAR2(30) DEFAULT ''SEGUIMIENTO'',
                OBSERVACIONES     VARCHAR2(1000)
            )';
    END IF;
END;
/

-- 2.5 EVIDENCIA
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'EVIDENCIA';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE EVIDENCIA (
                ID_EVIDENCIA    NUMBER(10) PRIMARY KEY,
                ID_BITACORA     NUMBER(10),
                NUMERO_VISITA   NUMBER(4) DEFAULT 1,
                NOMBRE_ARCHIVO  VARCHAR2(255),
                RUTA_ARCHIVO    VARCHAR2(500) NOT NULL,
                TIPO_FORMATO    VARCHAR2(50) DEFAULT ''PDF'',
                FECHA_CARGA     DATE
            )';
    END IF;
END;
/

-- 2.6 PREGUNTA (Banco de preguntas de reflexión pedagógica UDI)
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'PREGUNTA';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE PREGUNTA (
                ID_PREGUNTA     NUMBER(10) PRIMARY KEY,
                ID_PRACTICA     NUMBER(10) DEFAULT 1,
                NUMERO_VISITA   NUMBER(4) DEFAULT 1,
                TEXTO_PREGUNTA  VARCHAR2(500) NOT NULL,
                CATEGORIA       VARCHAR2(100) DEFAULT ''PEDAGOGICA'',
                ORDEN           NUMBER(4) DEFAULT 1
            )';
    END IF;
END;
/

-- 2.7 PREGUNTA_GUIA (Guía pedagógica parametrizable)
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM USER_TABLES WHERE TABLE_NAME = 'PREGUNTA_GUIA';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE PREGUNTA_GUIA (
                ID_PREGUNTA      NUMBER(10) PRIMARY KEY,
                ID_PREGUNTA_GUIA NUMBER(10),
                ID_PRACTICA      NUMBER(10) DEFAULT 1,
                ID_MODALIDAD     NUMBER(10),
                NUMERO_VISITA    NUMBER(4) DEFAULT 1,
                TEXTO_PREGUNTA   VARCHAR2(500) NOT NULL,
                CATEGORIA        VARCHAR2(100) DEFAULT ''PEDAGOGICA'',
                ORDEN            NUMBER(4) DEFAULT 1
            )';
    END IF;
END;
/

-- ── 3. Sincronización Idempotente de Columnas ───────────────────────
DECLARE
    PROCEDURE add_col_if_missing(p_table VARCHAR2, p_col VARCHAR2, p_type VARCHAR2) IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count FROM USER_TAB_COLS
        WHERE TABLE_NAME = UPPER(p_table) AND COLUMN_NAME = UPPER(p_col);
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ' || UPPER(p_table) || ' ADD (' || UPPER(p_col) || ' ' || p_type || ')';
        END IF;
    END;
BEGIN
    -- PRACTICA
    add_col_if_missing('PRACTICA', 'ID_MODALIDAD', 'NUMBER(10)');
    add_col_if_missing('PRACTICA', 'SEMESTRE', 'NUMBER(2) DEFAULT 1');
    add_col_if_missing('PRACTICA', 'TIPO', 'VARCHAR2(30) DEFAULT ''OBSERVACION''');
    add_col_if_missing('PRACTICA', 'HORAS_REQUERIDAS', 'NUMBER(4) DEFAULT 64');
    add_col_if_missing('PRACTICA', 'DESCRIPCION', 'VARCHAR2(500)');

    -- INSTITUCION
    add_col_if_missing('INSTITUCION', 'CONVENIO_ACTIVO', 'VARCHAR2(10) DEFAULT ''S''');
    add_col_if_missing('INSTITUCION', 'CUPOS_DISPONIBLES', 'NUMBER(4) DEFAULT 5');
    add_col_if_missing('INSTITUCION', 'FECHA_VENC_CONVENIO', 'DATE');

    -- ASIGNACION
    add_col_if_missing('ASIGNACION', 'ID_ESTUDIANTE', 'NUMBER(10)');
    add_col_if_missing('ASIGNACION', 'ID_TUTOR', 'NUMBER(10)');
    add_col_if_missing('ASIGNACION', 'ID_INSTITUCION', 'NUMBER(10)');
    add_col_if_missing('ASIGNACION', 'HORAS_ACUMULADAS', 'NUMBER(6,2) DEFAULT 0');
    add_col_if_missing('ASIGNACION', 'ESTADO', 'VARCHAR2(20) DEFAULT ''APROBADA''');
    add_col_if_missing('ASIGNACION', 'ESTADO_APROBACION', 'VARCHAR2(20) DEFAULT ''APROBADA''');
    add_col_if_missing('ASIGNACION', 'ESTADO_PRACTICA', 'VARCHAR2(20) DEFAULT ''EN_CURSO''');
    add_col_if_missing('ASIGNACION', 'FECHA_ASIGNACION', 'DATE');

    -- BITACORA
    add_col_if_missing('BITACORA', 'NUMERO_VISITA', 'NUMBER(4) DEFAULT 1');
    add_col_if_missing('BITACORA', 'FECHA_REGISTRO', 'DATE DEFAULT SYSDATE');
    add_col_if_missing('BITACORA', 'HORAS_SESION', 'NUMBER(5,2) DEFAULT 16');
    add_col_if_missing('BITACORA', 'URL_EVIDENCIA', 'VARCHAR2(500)');
    add_col_if_missing('BITACORA', 'ESTADO_REVISION', 'VARCHAR2(20) DEFAULT ''PENDIENTE''');

    -- PREGUNTA
    add_col_if_missing('PREGUNTA', 'CATEGORIA', 'VARCHAR2(100) DEFAULT ''PEDAGOGICA''');
    add_col_if_missing('PREGUNTA', 'ORDEN', 'NUMBER(4) DEFAULT 1');

    -- PREGUNTA_GUIA
    add_col_if_missing('PREGUNTA_GUIA', 'ID_PREGUNTA_GUIA', 'NUMBER(10)');
    add_col_if_missing('PREGUNTA_GUIA', 'ID_MODALIDAD', 'NUMBER(10)');
    add_col_if_missing('PREGUNTA_GUIA', 'CATEGORIA', 'VARCHAR2(100) DEFAULT ''PEDAGOGICA''');
    add_col_if_missing('PREGUNTA_GUIA', 'ORDEN', 'NUMBER(4) DEFAULT 1');
END;
/

-- ── 4. Triggers de Autoincremento Oracle 10g ─────────────────────────
CREATE OR REPLACE TRIGGER TRG_USUARIO_ID
BEFORE INSERT ON USUARIO FOR EACH ROW
BEGIN IF :NEW.ID_USUARIO IS NULL THEN SELECT SEQ_USUARIO.NEXTVAL INTO :NEW.ID_USUARIO FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_PRACTICA_ID
BEFORE INSERT ON PRACTICA FOR EACH ROW
BEGIN IF :NEW.ID_PRACTICA IS NULL THEN SELECT SEQ_PRACTICA.NEXTVAL INTO :NEW.ID_PRACTICA FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_ASIGNACION_ID
BEFORE INSERT ON ASIGNACION FOR EACH ROW
BEGIN IF :NEW.ID_ASIGNACION IS NULL THEN SELECT SEQ_ASIGNACION.NEXTVAL INTO :NEW.ID_ASIGNACION FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_BITACORA_ID
BEFORE INSERT ON BITACORA FOR EACH ROW
BEGIN IF :NEW.ID_BITACORA IS NULL THEN SELECT SEQ_BITACORA.NEXTVAL INTO :NEW.ID_BITACORA FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_MODALIDAD_ID
BEFORE INSERT ON MODALIDAD FOR EACH ROW
BEGIN IF :NEW.ID_MODALIDAD IS NULL THEN SELECT SEQ_MODALIDAD.NEXTVAL INTO :NEW.ID_MODALIDAD FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_INSTITUCION_ID
BEFORE INSERT ON INSTITUCION FOR EACH ROW
BEGIN IF :NEW.ID_INSTITUCION IS NULL THEN SELECT SEQ_INSTITUCION.NEXTVAL INTO :NEW.ID_INSTITUCION FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_VISITA_ID
BEFORE INSERT ON VISITA FOR EACH ROW
BEGIN IF :NEW.ID_VISITA IS NULL THEN SELECT SEQ_VISITA.NEXTVAL INTO :NEW.ID_VISITA FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_EVALUACION_ID
BEFORE INSERT ON EVALUACION FOR EACH ROW
BEGIN IF :NEW.ID_EVALUACION IS NULL THEN SELECT SEQ_EVALUACION.NEXTVAL INTO :NEW.ID_EVALUACION FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_EVIDENCIA_ID
BEFORE INSERT ON EVIDENCIA FOR EACH ROW
BEGIN IF :NEW.ID_EVIDENCIA IS NULL THEN SELECT SEQ_EVIDENCIA.NEXTVAL INTO :NEW.ID_EVIDENCIA FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_PREGUNTA_ID
BEFORE INSERT ON PREGUNTA FOR EACH ROW
BEGIN IF :NEW.ID_PREGUNTA IS NULL THEN SELECT SEQ_PREGUNTA.NEXTVAL INTO :NEW.ID_PREGUNTA FROM DUAL; END IF; END;
/

CREATE OR REPLACE TRIGGER TRG_PREGUNTA_GUIA_ID
BEFORE INSERT ON PREGUNTA_GUIA FOR EACH ROW
BEGIN
    IF :NEW.ID_PREGUNTA IS NULL THEN
        SELECT SEQ_PREGUNTA_GUIA.NEXTVAL INTO :NEW.ID_PREGUNTA FROM DUAL;
    END IF;
    IF :NEW.ID_PREGUNTA_GUIA IS NULL THEN
        :NEW.ID_PREGUNTA_GUIA := :NEW.ID_PREGUNTA;
    END IF;
END;
/

-- ── 5. Datos Semilla Idempotentes ───────────────────────────────────

-- 5.1 Modalidades
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM MODALIDAD;
    IF v_count = 0 THEN
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (1, 'OBSERVACION', 'Práctica de Observación en Infancia', 64, 'ACTIVO');
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (2, 'INTERVENCION', 'Práctica de Contextualización e Intervención Inicial', 64, 'ACTIVO');
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (3, 'DOCENTE', 'Práctica Pedagógica y Didáctica Docente', 64, 'ACTIVO');
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (4, 'INVESTIGATIVA', 'Práctica de Investigación en Primera Infancia', 64, 'ACTIVO');
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (5, 'COMUNITARIA', 'Práctica Integral Comunitaria (Formato P5)', 80, 'ACTIVO');
        INSERT INTO MODALIDAD (ID_MODALIDAD, NOMBRE, DESCRIPCION, HORAS_DEFAULT, ESTADO) VALUES (6, 'PROFESIONAL', 'Práctica de Grado y Liderazgo Infantil (Formato P6)', 96, 'ACTIVO');
    END IF;
END;
/

-- 5.2 Preguntas Guía Pedagógicas (PREGUNTA y PREGUNTA_GUIA)
DECLARE
    v_count NUMBER;
    PROCEDURE ins_preg(p_id NUMBER, p_prac NUMBER, p_vis NUMBER, p_txt VARCHAR2, p_cat VARCHAR2, p_ord NUMBER) IS
        v_c NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_c FROM PREGUNTA WHERE ID_PREGUNTA = p_id;
        IF v_c = 0 THEN
            INSERT INTO PREGUNTA (ID_PREGUNTA, ID_PRACTICA, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
            VALUES (p_id, p_prac, p_vis, p_txt, p_cat, p_ord);
        END IF;

        SELECT COUNT(*) INTO v_c FROM PREGUNTA_GUIA WHERE ID_PREGUNTA = p_id;
        IF v_c = 0 THEN
            INSERT INTO PREGUNTA_GUIA (ID_PREGUNTA, ID_PREGUNTA_GUIA, ID_PRACTICA, ID_MODALIDAD, NUMERO_VISITA, TEXTO_PREGUNTA, CATEGORIA, ORDEN)
            VALUES (p_id, p_id, p_prac, p_prac, p_vis, p_txt, p_cat, p_ord);
        END IF;
    END;
BEGIN
    ins_preg(1, 1, 1, '¿Cómo caracterizarías el ambiente socioemocional del aula en esta primera visita?', 'CONTEXTO', 1);
    ins_preg(2, 1, 1, '¿Qué estrategias utilizó la docente para captar la atención de los infantes y fomentar la participación?', 'DIDACTICA', 2);
    ins_preg(3, 1, 1, '¿Qué acuerdos pedagógicos de convivencia facilitaron el desarrollo armónico de la jornada?', 'CONVIVENCIA', 3);
    ins_preg(4, 1, 2, '¿Qué recursos didácticos y lúdicos facilitaron el aprendizaje activo en la sesión?', 'RECURSOS', 1);
    ins_preg(5, 1, 2, '¿Cómo se integraron las actividades motrices y de expresión corporal en el plan curricular?', 'CURRICULO', 2);
    ins_preg(6, 1, 2, '¿De qué manera se retroalimentó el trabajo cooperativo de los niños durante el cierre formativo?', 'EVALUACION', 3);
    ins_preg(7, 1, 3, '¿Cómo se articularon los tres momentos pedagógicos (inicio, desarrollo y cierre) con el objetivo de aprendizaje?', 'PLANEACION', 1);
    ins_preg(8, 1, 3, '¿Qué adaptaciones o mediaciones se implementaron para atender la diversidad y necesidades individuales?', 'INCLUSION', 2);
    ins_preg(9, 1, 4, '¿Qué impacto formativo y transformador tuvo la intervención pedagógica en el grupo de infantes?', 'IMPACTO', 1);
    ins_preg(10, 1, 4, '¿Cuáles son las reflexiones docentes y oportunidades de mejora para la futura labor profesional?', 'SISTEMATIZACION', 2);
END;
/

-- Sincronizar datos de asignación
BEGIN
    UPDATE ASIGNACION SET ID_ESTUDIANTE = ID_USUARIO WHERE ID_ESTUDIANTE IS NULL;
    UPDATE ASIGNACION SET ID_USUARIO = ID_ESTUDIANTE WHERE ID_USUARIO IS NULL;
    UPDATE PREGUNTA_GUIA SET ID_PREGUNTA_GUIA = ID_PREGUNTA WHERE ID_PREGUNTA_GUIA IS NULL;
    UPDATE PREGUNTA_GUIA SET ID_MODALIDAD = ID_PRACTICA WHERE ID_MODALIDAD IS NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

COMMIT;
