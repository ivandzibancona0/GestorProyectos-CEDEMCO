# 📖 Manual de Usuario — Plataforma CEDEMCO UADY

Bienvenido al **Manual de Usuario** del Sistema de Gestión y Acompañamiento de Emprendimientos del **Centro de Emprendimiento de la Universidad Autónoma de Yucatán (CEDEMCO UADY)**.

Este documento tiene como objetivo guiar a asesores, coordinadores y administradores en el uso óptimo de todas las herramientas y módulos de la plataforma.

---

## 📑 Tabla de Contenidos
1. [Acceso al Sistema y Seguridad](#1-acceso-al-sistema-y-seguridad)
2. [Panel de Control (Dashboard)](#2-panel-de-control-dashboard)
3. [Gestión de Emprendedores](#3-gestión-de-emprendedores)
4. [Portafolio de Proyectos](#4-portafolio-de-proyectos)
5. [Planificador SMART y Línea de Tiempo](#5-planificador-smart-y-línea-de-tiempo)
6. [Tablero Kanban (Seguimiento Operativo)](#6-tablero-kanban-seguimiento-operativo)
7. [Agenda y Minutas de Acompañamiento](#7-agenda-y-minutas-de-acompañamiento)
8. [Calculadora de Punto de Equilibrio](#8-calculadora-de-punto-de-equilibrio)
9. [Módulo de Administración y Reportes (Rol Admin)](#9-módulo-de-administración-y-reportes-rol-admin)
10. [Preguntas Frecuentes y Soporte](#10-preguntas-frecuentes-y-soporte)

---

## 1. Acceso al Sistema y Seguridad

### Iniciar Sesión
1. Ingrese a la dirección web de la plataforma (ej. `http://localhost:3000` o la URL institucional).
2. Introduzca su **Correo electrónico institucional** y **Contraseña**.
3. Haga clic en el botón **Iniciar sesión**.

### Recuperación de Contraseña
1. En la pantalla de inicio de sesión, haga clic en **¿Olvidaste tu contraseña?**.
2. Escriba su correo electrónico registrado y presione **Enviar instrucciones**.
3. Si su cuenta existe, el administrador o el sistema generará un enlace o código de recuperación temporal (con vigencia de 30 minutos).
4. Ingrese el código recibido y establezca una contraseña segura que contenga al menos 12 caracteres (incluyendo mayúsculas, minúsculas, números y caracteres especiales).

### Roles de Usuario
* **Usuario Estándar (Asesor):** Administra los emprendedores y proyectos bajo su responsabilidad, planifica metas, agenda reuniones y ejecuta análisis financieros.
* **Administrador:** Además de las funciones de asesor, puede gestionar usuarios, reasignar proyectos entre asesores y descargar reportes institucionales en CSV.

---

## 2. Panel de Control (Dashboard)

El Dashboard es la pantalla inicial que resume el estado general del portafolio:

* **Métricas Principales (Tarjetas superiores):**
  * **Proyectos activos:** Total de emprendimientos en fase de acompañamiento activo.
  * **Avance promedio:** Porcentaje medio de cumplimiento de objetivos entre todos los proyectos.
  * **Próximos vencimientos:** Número de entregables o proyectos con fecha límite en los siguientes 14 días.
* **Proyectos Recientes:** Lista de los últimos proyectos actualizados con su porcentaje de avance. Al hacer clic sobre cualquier proyecto, se abre directamente su espacio de trabajo.
* **Próximas Reuniones:** Calendario inmediato de citas de asesoría programadas.
* **Actividad Reciente:** Bitácora en vivo de las acciones realizadas en la plataforma.
  > **💡 Función de Scroll Infinito:** La lista de actividad carga automáticamente en bloques de **8 en 8** conforme usted se desplaza hacia abajo en la tarjeta, garantizando una navegación rápida y sin retrasos.

---

## 3. Gestión de Emprendedores

Permite registrar y consultar el directorio de emprendedores acompañados por la universidad.

### Registrar un Nuevo Emprendedor
1. En el menú lateral, diríjase a la sección **Emprendedores**.
2. Haga clic en el botón superior **`+ Nuevo emprendedor`**.
3. Complete los campos obligatorios:
   * **Nombre completo.**
   * **Correo electrónico y Teléfono de contacto.**
   * **Género, Municipio** y **Nivel de escolaridad**.
   * **Notas / Perfil general:** Breve descripción del perfil y antecedentes.
4. Haga clic en **Guardar emprendedor**.

### Búsqueda y Edición
* Utilice la barra de búsqueda superior para filtrar emprendedores por nombre, correo o municipio.
* En la tarjeta del emprendedor, use el botón de **Opciones (⋮)** para editar datos o dar de baja el registro.

---

## 4. Portafolio de Proyectos

Los proyectos representan las iniciativas y modelos de negocio de los emprendedores.

### Crear un Nuevo Proyecto
1. Diríjase a **Proyectos** en el menú de navegación.
2. Haga clic en **`+ Nuevo proyecto`**.
3. Seleccione el **Emprendedor responsable** (o déjelo vacío si es un proyecto institucional propio).
4. Ingrese el **Nombre del proyecto**, **Descripción**, **Sector** (*Alimentos, Tecnología, Servicios, etc.*) y **Etapa** (*Ideación, Validación, Crecimiento*).
5. Defina las fechas estimadas de inicio y conclusión.
6. Haga clic en **Crear proyecto**.

---

## 5. Planificador SMART y Línea de Tiempo

Este módulo permite traducir ideas en un plan de trabajo concreto y medible.

### 5.1 Objetivos SMART
En la parte superior puede definir metas estratégicas bajo la metodología SMART:
* **S (Específico):** ¿Qué resultado concreto se busca lograr?
* **M (Medible):** ¿Con qué indicador o métrica comprobaremos el éxito?
* **A (Alcanzable):** ¿Por qué es viable con los recursos actuales?
* **R (Relevante):** ¿Por qué es crucial para el modelo de negocio?
* **Fecha límite y % de Avance:** Fecha objetivo y porcentaje completado.

### 5.2 Línea de Tiempo Vertical de Entregables
Debajo de los objetivos se encuentra la **Línea de Tiempo Vertical**, que organiza todas las tareas en secuencia cronológica:

* **Indicador de "HOY":** Una insignia roja pulsante marca la fecha actual dentro de la secuencia, permitiendo ver al instante qué tareas ya deberían haberse terminado y cuáles son las siguientes.
* **Códigos de color de las actividades:**
  * 🟢 **Completado:** Tarea finalizada con éxito.
  * 🔵 **En proceso:** Actividad en desarrollo activo.
  * 🟠 **En revisión:** Entregable enviado pendiente de validación del asesor.
  * ⚪ **Pendiente:** Tarea programada por iniciar.
* **Alertas de Retraso:** Si una tarea no completada supera su fecha límite, se marcará automáticamente con la etiqueta roja **`⚠️ Atrasada`**.
* **Edición Rápida:** Haga clic sobre cualquier tarjeta de la línea de tiempo para abrir la ventana de edición y modificar fechas, prioridad o estado.

---

## 6. Tablero Kanban (Seguimiento Operativo)

Herramienta ágil para coordinar el avance de tareas en el día a día.

### Uso del Tablero
1. En el selector superior, elija el **Proyecto activo**.
2. Las tareas están organizadas en 4 columnas: **Pendientes**, **En proceso**, **En revisión** y **Completado**.
3. **Mover tareas:** Haga clic sostenido sobre una tarjeta y **arrástrela y suéltela** en la columna que corresponda. El nuevo estado se guardará automáticamente en el sistema.
4. **Agregar nueva tarea:** Presione el botón **`+ Nueva tarea`**, defina título, prioridad (*Alta, Media, Baja*), fechas de inicio y vencimiento.

---

## 7. Agenda y Minutas de Acompañamiento

Registra las sesiones de asesoría y los compromisos adquiridos.

### Agendar una Reunión
1. Diríjase a **Reuniones**.
2. Presione **`+ Agendar reunión`**.
3. Seleccione el proyecto, capture el **Título**, **Fecha y hora**, **Duración estimada (min)**, **Ubicación/Enlace virtual** y **Participantes**.
4. Presione **Agendar**.

### Registrar Notas y Acuerdos
1. En la tarjeta de la reunión, haga clic en el botón **Agregar nota**.
2. Ingrese los temas tratados en la sesión y los compromisos acordados con sus responsables.
3. Guarde la nota para mantener la memoria histórica del acompañamiento.

---

## 8. Calculadora de Punto de Equilibrio

Herramienta de análisis financiero para determinar el volumen de ventas necesario para no tener pérdidas ni ganancias.

### Pasos para realizar un cálculo:
1. Ingrese a la sección **Punto de equilibrio**.
2. Seleccione el proyecto al que desea asociar el análisis (o elija *"Cálculo sin guardar"* para una simulación rápida).
3. Ingrese los **Costos fijos mensuales ($)** (renta, nóminas fijas, servicios, internet, etc.).
4. En la sección de **Productos**, agregue cada producto o servicio con:
   * **Nombre del producto.**
   * **Precio de venta unitario ($).**
   * **Costo variable unitario ($)** (materia prima, comisiones, empaque).
   * **Participación estimada en ventas (%)** (la suma de todos los productos debe ser 100%).
5. Haga clic en **Calcular punto de equilibrio**.
6. **Resultados mostrados:**
   * Unidades totales e individuales a vender al mes.
   * Ingreso mensual de equilibrio en pesos (MXN).
   * Margen de contribución ponderado y porcentaje de absorción de costos.

---

## 9. Módulo de Administración y Reportes (Rol Admin)

*(Disponible únicamente para usuarios con permisos de Administrador)*

### Gestión de Cuentas de Asesores
* **Crear usuario:** Ingrese a la pestaña **Administración**, presione **`+ Nuevo usuario`**, capture nombre, correo, rol y contraseña temporal.
* **Activar/Desactivar:** Puede inhabilitar accesos sin borrar el historial del usuario.
* **Restablecer clave:** Genere códigos de recuperación de 30 minutos para usuarios que hayan olvidado su acceso.

### Reasignación de Proyectos
Permite transferir la titularidad de emprendedores o proyectos entre asesores cuando haya cambios de personal o reestructuración de cargas de trabajo.

### Exportación de Reportes en Formato CSV
Haga clic sobre cualquiera de las tarjetas de descarga para generar reportes institucionales compatibles con Excel:
* 📥 **Proyectos.csv:** Listado integral con etapa, sector, avance y asesor.
* 📥 **Emprendedores.csv:** Directorio completo de contactos y municipios.
* 📥 **Actividad.csv:** Registro de auditoría de movimientos con fecha y usuario.
* 📥 **Seguimiento.csv:** Estado detallado de todas las tareas y sus plazos.

---

## 10. Preguntas Frecuentes y Soporte

**¿Qué hago si no veo mis proyectos asignados?**
> Verifique que ha iniciado sesión con su cuenta correcta. Si un proyecto fue creado por otro asesor, solicite a un Administrador que se lo reasigne desde el módulo de Administración.

**¿Cómo actualizo la información de la línea de tiempo si cambio una fecha?**
> Al hacer clic en cualquier tarjeta de la línea de tiempo y cambiar su fecha en la ventana modal, la línea vertical se reordenará y actualizará automáticamente.

**¿Los cambios en el tablero Kanban se reflejan en la Línea de Tiempo?**
> Sí. Al arrastrar una tarjeta en Kanban al estado *"Completado"*, el nodo en la Línea de Tiempo cambiará a color verde inmediatamente.

---

*Centro de Emprendimiento y Desarrollo de Modelos de Negocio (CEDEMCO) — Universidad Autónoma de Yucatán.*
