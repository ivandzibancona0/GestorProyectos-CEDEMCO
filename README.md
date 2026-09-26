# CEDEMCO - UADY (Plataforma de Gestión de Emprendimientos)

Sistema web multiusuario para el registro de emprendimientos, planificación estratégica de objetivos SMART, seguimiento de entregables mediante línea de tiempo vertical, tablero operativo Kanban, calculadora financiera de punto de equilibrio, agenda de acompañamiento y reportería institucional para el Centro de Emprendimiento de la Universidad Autónoma de Yucatán (CEDEMCO UADY).

---

## 🚀 Módulos y Funcionalidades

### 1. Panel de Control (Dashboard)
- **Métricas generales:** Proyectos activos, porcentaje de avance promedio global y próximos vencimientos a 14 días.
- **Acceso rápido:** Proyectos recientes y próximas reuniones programadas.
- **Actividad reciente:** Bitácora en tiempo real con **Scroll Infinito paginado (bloques de 8 en 8)** optimizado para alto rendimiento.

### 2. Directorio de Emprendedores
- Registro y gestión de perfiles de emprendedores con datos de contacto, municipio, escolaridad y notas de seguimiento.
- Filtros de búsqueda rápida y asignación de responsables.

### 3. Portafolio de Proyectos
- Seguimiento por sectores (Alimentos, Tecnología, Servicios, etc.) y etapas (Ideación, Validación, Crecimiento).
- Control de porcentaje de avance global y fechas de ejecución.

### 4. Planificador SMART y Línea de Tiempo
- **Objetivos SMART:** Definición estructurada (*Específico, Medible, Alcanzable, Relevante, Temporal*).
- **Línea de Tiempo Vertical de Entregables:**
  - Visualización cronológica de tareas con código de color por estado (Completado, En proceso, En revisión, Pendiente).
  - Marcador dinámico e interactivo de **`HOY`** integrado en la secuencia temporal.
  - Detección automática de tareas vencidas (`⚠️ Atrasada`) y nivel de prioridad (`P. Alta`, `P. Media`, `P. Baja`).
  - Edición directa de actividades con un clic.

### 5. Tablero Kanban Operativo
- Seguimiento visual de tareas en 4 columnas (*Pendientes*, *En proceso*, *En revisión*, *Completado*).
- Arrastrar y soltar (*Drag & Drop*) con persistencia inmediata de estado en la base de datos.

### 6. Agenda de Acompañamiento y Notas
- Programación de sesiones de asesoría con fecha, hora, duración, ubicación o enlace virtual y participantes.
- Registro histórico de notas y acuerdos por reunión.

### 7. Análisis Financiero (Punto de Equilibrio)
- Calculadora multiproducto para determinar unidades e ingresos de equilibrio a partir de costos fijos mensuales, precios de venta y costos variables unitarios.
- Cálculo automático de margen de contribución ponderado y almacenamiento de escenarios vinculados a proyectos.

### 8. Administración y Reportes (Rol Admin)
- Gestión de usuarios del sistema (Estándar y Administrador) y estado de activación.
- Generación de enlaces de restablecimiento de contraseña temporal.
- Reasignación de emprendedores y proyectos entre asesores.
- Exportación de reportes institucionales en formato CSV: *Proyectos*, *Emprendedores*, *Actividad* y *Seguimiento de Tareas*.

---

## 🛠️ Requisitos del Sistema

- **Node.js:** Versión 20 LTS o superior.
- **PostgreSQL:** Versión 16 o superior.
- **Docker & Docker Compose:** *(Opcional para despliegue en contenedores)*.

---

## 📦 Puesta en Marcha Local

### Opción A: Instalación Manual

1. **Clonar el repositorio y configurar variables de entorno:**
   ```bash
   cp .env.example .env
   ```
   *Edite `.env` y ajuste sus credenciales locales de PostgreSQL (`DATABASE_URL`).*

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Iniciar el servidor en modo desarrollo:**
   ```bash
   npm run dev
   ```

> 💡 **Creación e inicialización automática:**
> Al arrancar con `AUTO_INIT_DB=true` (activo por defecto), el sistema detecta automáticamente si la base de datos no existe en PostgreSQL, la crea, ejecuta las tablas del esquema estructural (`schema.sql`) y carga las credenciales y datos demo de prueba si la base de datos está vacía.
>
> **Credenciales iniciales generadas:**
> - **Administrador:** `admin@cedemco.local` / `Cedemco2026!`
> - **Asesor estándar:** `ana@cedemco.local` / `Cedemco2026!`

4. Abra su navegador en [http://localhost:3000](http://localhost:3000).

---

### Opción B: Despliegue con Docker Compose

1. **Configurar el entorno:**
   Cree su archivo `.env` o defina las variables `POSTGRES_PASSWORD` y `APP_ORIGIN`.

2. **Levantar los servicios en segundo plano:**
   ```bash
   docker compose up -d
   ```
   *La base de datos y los esquemas se inicializan automáticamente al levantar el contenedor de la aplicación.*

3. Abra su navegador en [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `NODE_ENV` | Entorno de ejecución (`development` / `production`) | `development` |
| `PORT` | Puerto HTTP del servidor Express | `3000` |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://postgres:postgres@localhost:5432/cedemco` |
| `DATABASE_SSL` | Activa SSL/TLS estricto para conexión a la BD | `false` |
| `AUTO_INIT_DB` | Crea la BD, aplica `schema.sql` y carga seed si no existen | `true` |
| `APP_ORIGIN` | Origen permitido para CSP, CORS y encabezados seguros | `http://localhost:3000` |
| `SESSION_TTL_HOURS` | Duración máxima de sesión activa (horas) | `12` |
| `TRUST_PROXY` | Configuración de saltos para proxy inverso (`0` para deshabilitar) | `0` |
| `LOG_LEVEL` | Nivel de registro de Pino (`debug`, `info`, `warn`, `error`) | `info` |

---

## 📜 Scripts Disponibles

En el archivo `package.json` se encuentran los siguientes comandos:

```bash
# Iniciar servidor en desarrollo con recarga automática ante cambios de código
npm run dev

# Iniciar servidor en modo estándar / producción
npm start

# Ejecutar o verificar migraciones de base de datos manualmente
npm run db:migrate

# Cargar datos iniciales y usuarios de demostración manualmente
npm run db:seed

# Ejecutar pruebas unitarias automatizadas con el test runner nativo de Node.js
npm test

# Verificación de sintaxis estricta de todos los archivos JavaScript
npm run check
```

---

## 🔒 Arquitectura de Seguridad

- **Cifrado de contraseñas:** Algoritmo Argon2id con parámetros recomendados de memoria y tiempo.
- **Manejo de sesiones:** Sesiones opacas almacenadas en base de datos con cookies `HttpOnly`, `SameSite=Strict` y `Secure` en producción.
- **Protección CSRF:** Tokens de verificación `x-csrf-token` validados en cada mutación de datos (`POST`, `PATCH`, `DELETE`).
- **Seguridad en cabeceras:** Protección HTTP con Helmet (Content Security Policy estricta, HSTS, X-Frame-Options, bloqueo de MIME sniffing).
- **Control de acceso basado en roles (RBAC):** Restricción y aislamiento de datos por usuario y permisos de administrador validados en capa de API.
- **Auditoría:** Registro de movimientos y acciones en `activity_log` con borrado lógico (`deleted_at`).
- **Gestión de caché:** Encabezados anti-caché para archivos dinámicos y parámetros de versionado para actualización inmediata de clientes.

---

## 🏛️ Estructura del Proyecto

```text
├── database/
│   └── schema.sql         # Esquema DDL de tablas, índices, enums y triggers
├── public/
│   ├── app.js             # Lógica de cliente SPA interactiva
│   ├── index.html         # Estructura principal y plantillas modales
│   └── styles.css         # Sistema de diseño, temas y estilos responsive
├── scripts/
│   ├── migrate.js         # Script CLI para aplicar migraciones manuales
│   └── seed.js            # Script CLI para sembrar datos demo manuales
├── src/
│   ├── domain/
│   │   └── breakEven.js   # Lógica pura del cálculo de punto de equilibrio
│   ├── config.js          # Configuración centralizada y lectura de variables de entorno
│   ├── db.js              # Pool de conexiones y ejecutor de transacciones PostgreSQL
│   ├── dbInit.js          # Módulo de inicialización automática de BD, esquema y seed
│   ├── routes.js          # Rutas de la API REST, validaciones Zod y auditoría
│   ├── security.js        # Criptografía, hashing Argon2, tokens y gestión de sesiones
│   └── server.js          # Servidor Express, middlewares de seguridad y estáticos
├── tests/
│   └── breakEven.test.js  # Pruebas unitarias de dominio financiero
├── .env.example           # Plantilla base de configuración de entorno
├── .gitignore             # Reglas de exclusión para control de versiones
├── compose.yaml           # Orquestación de contenedores Docker (App + PostgreSQL)
├── Dockerfile             # Definición de contenedor para producción
├── MANUAL_DE_USUARIO.md   # Guía completa de uso para asesores y administradores
├── package.json           # Dependencias, scripts y configuración de Node.js
└── README.md              # Documentación técnica del proyecto
```

---

## 📄 Licencia y Créditos

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](file:///c:/Users/ivand/Downloads/cedemco-uady-pm-master/LICENSE) para más detalles.

Desarrollado para el **Centro de Emprendimiento y Desarrollo de Modelos de Negocio (CEDEMCO)** de la **Universidad Autónoma de Yucatán (UADY)**.
