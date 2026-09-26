import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { query, transaction } from './db.js';
import { calculateBreakEven } from './domain/breakEven.js';
import {
  authenticate, createSession, hashPassword, publicUser, randomToken, requireRole,
  sessionCookie, sha256, verifyCsrf, verifyPassword,
} from './security.js';

export const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const uuid = z.string().uuid();
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/);
const text = (max) => z.string().trim().min(1).max(max);
const nullableText = (max) => z.string().trim().max(max).optional().nullable();

function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Revise los campos indicados.', fields: parsed.error.flatten().fieldErrors });
    req.validated = parsed.data;
    next();
  };
}

async function logActivity(req, action, entityType, entityId, details = {}) {
  await query('INSERT INTO activity_log (actor_user_id,action,entity_type,entity_id,details,ip) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user?.id || null, action, entityType, entityId ? String(entityId) : null, JSON.stringify(details), req.ip]);
}

const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
router.post('/auth/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { rows: [user] } = await query(`SELECT * FROM users WHERE lower(email)=$1 AND deleted_at IS NULL`, [req.validated.email]);
    const valid = user?.active && (!user.locked_until || new Date(user.locked_until) <= new Date()) && await verifyPassword(user.password_hash, req.validated.password);
    if (!valid) {
      if (user) await query(`UPDATE users SET failed_login_attempts=failed_login_attempts+1,
        locked_until=CASE WHEN failed_login_attempts+1 >= 5 THEN now()+interval '15 minutes' ELSE locked_until END WHERE id=$1`, [user.id]);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    const session = await createSession(user.id, req);
    await query('UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login_at=now() WHERE id=$1', [user.id]);
    res.cookie('cedemco_session', session.token, sessionCookie);
    res.json({ user: publicUser(user), csrfToken: session.csrf });
  } catch (error) { next(error); }
});

router.post('/auth/forgot-password', authLimiter, validate(z.object({ email })), async (req, res, next) => {
  try {
    const { rows: [user] } = await query('SELECT id FROM users WHERE lower(email)=$1 AND active=true AND deleted_at IS NULL', [req.validated.email]);
    if (user) {
      const token = randomToken();
      await query(`INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '30 minutes')`, [user.id, sha256(token)]);
      if (process.env.NODE_ENV !== 'production') req.log.info({ resetToken: token }, 'Token de recuperación (solo desarrollo)');
    }
    res.json({ message: 'Si la cuenta existe, se enviaron instrucciones de recuperación.' });
  } catch (error) { next(error); }
});

router.post('/auth/reset-password', authLimiter, validate(z.object({ token: text(200), password })), async (req, res, next) => {
  try {
    const { rows: [reset] } = await query(`SELECT * FROM password_reset_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now()`, [sha256(req.validated.token)]);
    if (!reset) return res.status(400).json({ error: 'El enlace no es válido o ya expiró.' });
    const passwordHash = await hashPassword(req.validated.password);
    await transaction(async (client) => {
      await client.query('UPDATE users SET password_hash=$1, failed_login_attempts=0, locked_until=NULL WHERE id=$2', [passwordHash, reset.user_id]);
      await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1', [reset.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [reset.user_id]);
    });
    res.json({ message: 'Contraseña actualizada. Ya puede iniciar sesión.' });
  } catch (error) { next(error); }
});

router.use(authenticate);
router.get('/auth/me', (req, res) => res.json({ user: req.user, csrfToken: req.session.csrfToken }));
router.use(verifyCsrf);
router.post('/auth/logout', async (req, res, next) => {
  try { await query('DELETE FROM sessions WHERE id=$1', [req.session.id]); res.clearCookie('cedemco_session', sessionCookie); res.status(204).end(); }
  catch (error) { next(error); }
});

const projectVisibility = (alias = 'p') => `${alias}.deleted_at IS NULL AND ($1='admin' OR ${alias}.owner_user_id=$2)`;

router.get('/dashboard', async (req, res, next) => {
  try {
    const params = [req.user.role, req.user.id];
    const [stats, projects, meetings, activity] = await Promise.all([
      query(`SELECT count(*) FILTER (WHERE status='active')::int active_projects,
        coalesce(round(avg(progress)),0)::int average_progress,
        count(*) FILTER (WHERE end_date BETWEEN current_date AND current_date+14)::int upcoming_deadlines
        FROM projects p WHERE ${projectVisibility()}`, params),
      query(`SELECT p.id,p.name,p.sector,p.stage,p.status,p.progress,p.end_date,e.full_name entrepreneur
        FROM projects p LEFT JOIN entrepreneurs e ON e.id=p.entrepreneur_id WHERE ${projectVisibility()} ORDER BY p.updated_at DESC LIMIT 5`, params),
      query(`SELECT m.id,m.title,m.scheduled_at,m.location,m.duration_minutes,p.name project_name
        FROM meetings m JOIN projects p ON p.id=m.project_id WHERE ${projectVisibility()} AND m.scheduled_at>=now() ORDER BY m.scheduled_at LIMIT 5`, params),
      query(`SELECT a.action,a.entity_type,a.created_at,u.name actor FROM activity_log a LEFT JOIN users u ON u.id=a.actor_user_id
        WHERE ($1='admin' OR a.actor_user_id=$2) ORDER BY a.created_at DESC LIMIT 8`, params),
    ]);
    res.json({ stats: stats.rows[0], projects: projects.rows, meetings: meetings.rows, activity: activity.rows });
  } catch (error) { next(error); }
});

router.get('/activity', async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const params = [req.user.role, req.user.id, limit, offset];
    const [{ rows: items }, { rows: [countRow] }] = await Promise.all([
      query(
        `SELECT a.action, a.entity_type, a.created_at, u.name actor
         FROM activity_log a
         LEFT JOIN users u ON u.id = a.actor_user_id
         WHERE ($1 = 'admin' OR a.actor_user_id = $2)
         ORDER BY a.created_at DESC
         LIMIT $3 OFFSET $4`,
        params
      ),
      query(
        `SELECT count(*)::int total FROM activity_log a WHERE ($1 = 'admin' OR a.actor_user_id = $2)`,
        [req.user.role, req.user.id]
      )
    ]);
    const total = countRow?.total || 0;
    res.json({
      items,
      hasMore: offset + items.length < total,
      total,
      nextOffset: offset + items.length
    });
  } catch (error) { next(error); }
});

const entrepreneurSchema = z.object({ fullName: text(160), email: z.union([email, z.literal('')]).optional(), phone: nullableText(30), gender: nullableText(50), municipality: nullableText(120), education: nullableText(120), notes: nullableText(3000) });
router.get('/entrepreneurs', async (req, res, next) => {
  try { const { rows } = await query(`SELECT e.*,u.name owner_name FROM entrepreneurs e JOIN users u ON u.id=e.owner_user_id WHERE e.deleted_at IS NULL AND ($1='admin' OR e.owner_user_id=$2) ORDER BY e.created_at DESC`, [req.user.role,req.user.id]); res.json(rows); }
  catch (error) { next(error); }
});
router.post('/entrepreneurs', validate(entrepreneurSchema), async (req, res, next) => {
  try { const v=req.validated; const { rows:[row] }=await query(`INSERT INTO entrepreneurs (owner_user_id,full_name,email,phone,gender,municipality,education,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[req.user.id,v.fullName,v.email||null,v.phone,v.gender,v.municipality,v.education,v.notes]); await logActivity(req,'create','entrepreneur',row.id,{name:row.full_name}); res.status(201).json(row); }
  catch (error) { next(error); }
});

router.patch('/entrepreneurs/:id', validate(entrepreneurSchema.partial()), async (req, res, next) => {
  try {
    const id = uuid.parse(req.params.id);
    const v = req.validated;
    const { rows: [row] } = await query(`UPDATE entrepreneurs SET
      full_name = COALESCE($1, full_name),
      email = CASE WHEN $8 = true THEN $2 ELSE email END,
      phone = COALESCE($3, phone),
      gender = COALESCE($4, gender),
      municipality = COALESCE($5, municipality),
      education = COALESCE($6, education),
      notes = COALESCE($7, notes),
      updated_at = now()
      WHERE id=$9 AND deleted_at IS NULL AND ($10='admin' OR owner_user_id=$11) RETURNING *`,
      [v.fullName, v.email || null, v.phone, v.gender, v.municipality, v.education, v.notes, 'email' in v, id, req.user.role, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Emprendedor no encontrado o sin permisos.' });
    await logActivity(req, 'update', 'entrepreneur', id, { name: row.full_name });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/entrepreneurs/:id', async (req, res, next) => {
  try {
    const id = uuid.parse(req.params.id);
    const { rows: linkedProjects } = await query(
      `SELECT name FROM projects WHERE entrepreneur_id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (linkedProjects.length > 0) {
      const projectNames = linkedProjects.map(p => `"${p.name}"`).join(', ');
      return res.status(400).json({
        error: `No es posible eliminar al emprendedor porque tiene ${linkedProjects.length} proyecto(s) asignado(s): ${projectNames}. Primero reasigna o elimina los proyectos asociados.`
      });
    }
    const { rowCount } = await query(`UPDATE entrepreneurs SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL AND ($2='admin' OR owner_user_id=$3)`, [id, req.user.role, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Emprendedor no encontrado o sin permisos.' });
    await logActivity(req, 'delete', 'entrepreneur', id);
    res.status(204).end();
  } catch (e) { next(e); }
});

const projectSchema = z.object({ name:text(180), entrepreneurId:uuid.optional().nullable(), description:nullableText(5000), sector:nullableText(100), stage:nullableText(100), status:z.enum(['active','paused','completed','archived']).default('active'), progress:z.coerce.number().int().min(0).max(100).default(0), startDate:z.string().optional().nullable(), endDate:z.string().optional().nullable() });
router.get('/projects', async (req,res,next)=>{ try { const {rows}=await query(`SELECT p.*,e.full_name entrepreneur,u.name owner_name FROM projects p LEFT JOIN entrepreneurs e ON e.id=p.entrepreneur_id JOIN users u ON u.id=p.owner_user_id WHERE ${projectVisibility()} ORDER BY p.updated_at DESC`,[req.user.role,req.user.id]);res.json(rows);}catch(e){next(e)} });
router.post('/projects',validate(projectSchema),async(req,res,next)=>{try{const v=req.validated;if(v.entrepreneurId){const {rows:[allowed]}=await query(`SELECT id FROM entrepreneurs WHERE id=$3 AND deleted_at IS NULL AND ($1='admin' OR owner_user_id=$2)`,[req.user.role,req.user.id,v.entrepreneurId]);if(!allowed)return res.status(403).json({error:'No tiene acceso al emprendedor seleccionado.'})}const {rows:[row]}=await query(`INSERT INTO projects(owner_user_id,entrepreneur_id,name,description,sector,stage,status,progress,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[req.user.id,v.entrepreneurId,v.name,v.description,v.sector,v.stage,v.status,v.progress,v.startDate||null,v.endDate||null]);await logActivity(req,'create','project',row.id,{name:row.name});res.status(201).json(row)}catch(e){next(e)}});

router.patch('/projects/:id', validate(projectSchema.partial()), async (req, res, next) => {
  try {
    const id = uuid.parse(req.params.id);
    const v = req.validated;
    if (v.entrepreneurId) {
      const { rows: [allowed] } = await query(`SELECT id FROM entrepreneurs WHERE id=$3 AND deleted_at IS NULL AND ($1='admin' OR owner_user_id=$2)`, [req.user.role, req.user.id, v.entrepreneurId]);
      if (!allowed) return res.status(403).json({ error: 'No tiene acceso al emprendedor seleccionado.' });
    }
    const { rows: [row] } = await query(`UPDATE projects SET
      name = COALESCE($1, name),
      entrepreneur_id = CASE WHEN $12 = true THEN $2 ELSE entrepreneur_id END,
      description = COALESCE($3, description),
      sector = COALESCE($4, sector),
      stage = COALESCE($5, stage),
      status = COALESCE($6, status),
      progress = COALESCE($7, progress),
      start_date = COALESCE($8, start_date),
      end_date = COALESCE($9, end_date),
      updated_at = now()
      WHERE id=$10 AND deleted_at IS NULL AND ($11='admin' OR owner_user_id=$13) RETURNING *`,
      [v.name, v.entrepreneurId || null, v.description, v.sector, v.stage, v.status, v.progress, v.startDate || null, v.endDate || null, id, req.user.role, 'entrepreneurId' in v, req.user.id]);
    if (!row) return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos.' });
    await logActivity(req, 'update', 'project', id, { name: row.name });
    res.json(row);
  } catch (e) { next(e); }
});

router.delete('/projects/:id', async (req, res, next) => {
  try {
    const id = uuid.parse(req.params.id);
    const { rowCount } = await query(`UPDATE projects SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL AND ($2='admin' OR owner_user_id=$3)`, [id, req.user.role, req.user.id]);
    if (!rowCount) return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos.' });
    await logActivity(req, 'delete', 'project', id);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/projects/:id/workspace',async(req,res,next)=>{try{const id=uuid.parse(req.params.id);const {rows:[project]}=await query(`SELECT p.*,e.full_name entrepreneur FROM projects p LEFT JOIN entrepreneurs e ON e.id=p.entrepreneur_id WHERE p.id=$3 AND ${projectVisibility()}`,[req.user.role,req.user.id,id]);if(!project)return res.status(404).json({error:'Proyecto no encontrado.'});const [objectives,tasks,meetings,analyses]=await Promise.all([query('SELECT * FROM objectives WHERE project_id=$1 ORDER BY due_date',[id]),query('SELECT * FROM tasks WHERE project_id=$1 ORDER BY status,position,created_at',[id]),query(`SELECT m.*,coalesce(json_agg(n.*) FILTER(WHERE n.id IS NOT NULL),'[]') notes FROM meetings m LEFT JOIN meeting_notes n ON n.meeting_id=m.id WHERE m.project_id=$1 GROUP BY m.id ORDER BY m.scheduled_at`,[id]),query('SELECT * FROM break_even_analyses WHERE project_id=$1 ORDER BY created_at DESC LIMIT 10',[id])]);res.json({project,objectives:objectives.rows,tasks:tasks.rows,meetings:meetings.rows,analyses:analyses.rows})}catch(e){next(e)}});

const objectiveSchema=z.object({projectId:uuid,title:text(200),specific:text(2000),measurable:text(2000),achievable:text(2000),relevant:text(2000),dueDate:z.string(),progress:z.coerce.number().int().min(0).max(100).default(0)});
router.post('/objectives',validate(objectiveSchema),async(req,res,next)=>{try{const v=req.validated;const {rows:[allowed]}=await query(`SELECT id FROM projects p WHERE p.id=$3 AND ${projectVisibility()}`,[req.user.role,req.user.id,v.projectId]);if(!allowed)return res.status(403).json({error:'Sin acceso al proyecto.'});const {rows:[row]}=await query(`INSERT INTO objectives(project_id,title,specific,measurable,achievable,relevant,due_date,progress) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[v.projectId,v.title,v.specific,v.measurable,v.achievable,v.relevant,v.dueDate,v.progress]);await logActivity(req,'create','objective',row.id,{projectId:v.projectId});res.status(201).json(row)}catch(e){next(e)}});

const updateObjectiveSchema=z.object({title:text(200),specific:text(2000),measurable:text(2000),achievable:text(2000),relevant:text(2000),dueDate:z.string(),progress:z.coerce.number().int().min(0).max(100)});
router.patch('/objectives/:id',validate(updateObjectiveSchema),async(req,res,next)=>{
  try{
    const id=uuid.parse(req.params.id);
    const v=req.validated;
    const {rows:[row]}=await query(`UPDATE objectives o SET title=$4,specific=$5,measurable=$6,achievable=$7,relevant=$8,due_date=$9,progress=$10 FROM projects p WHERE o.id=$3 AND p.id=o.project_id AND ${projectVisibility('p')} RETURNING o.*`,[req.user.role,req.user.id,id,v.title,v.specific,v.measurable,v.achievable,v.relevant,v.dueDate,v.progress]);
    if(!row)return res.status(404).json({error:'Objetivo no encontrado.'});
    await logActivity(req,'update','objective',id,{title:row.title,progress:row.progress});
    res.json(row);
  }catch(e){next(e)}
});
router.delete('/objectives/:id',async(req,res,next)=>{
  try{
    const id=uuid.parse(req.params.id);
    const {rows:[deleted]}=await query(`DELETE FROM objectives o USING projects p WHERE o.id=$3 AND p.id=o.project_id AND ${projectVisibility('p')} RETURNING o.id,o.title,o.project_id`,[req.user.role,req.user.id,id]);
    if(!deleted)return res.status(404).json({error:'Objetivo no encontrado.'});
    await logActivity(req,'delete','objective',id,{title:deleted.title});
    res.status(204).end();
  }catch(e){next(e)}
});

const taskSchema=z.object({projectId:uuid,title:text(200),description:nullableText(3000),status:z.enum(['pending','in_progress','review','completed']).default('pending'),priority:z.coerce.number().int().min(1).max(3).default(2),startDate:z.string().optional().nullable(),dueDate:z.string().optional().nullable()});
router.post('/tasks',validate(taskSchema),async(req,res,next)=>{try{const v=req.validated;const {rows:[row]}=await query(`INSERT INTO tasks(project_id,title,description,status,priority,start_date,due_date,assigned_to) SELECT $3,$4,$5,$6,$7,$8,$9,$2 FROM projects p WHERE p.id=$3 AND ${projectVisibility()} RETURNING *`,[req.user.role,req.user.id,v.projectId,v.title,v.description,v.status,v.priority,v.startDate||null,v.dueDate||null]);if(!row)return res.status(403).json({error:'Sin acceso al proyecto.'});await logActivity(req,'create','task',row.id,{title:row.title});res.status(201).json(row)}catch(e){next(e)}});

const updateTaskSchema=z.object({title:text(200),description:nullableText(3000),status:z.enum(['pending','in_progress','review','completed']),priority:z.coerce.number().int().min(1).max(3),startDate:z.string().optional().nullable(),dueDate:z.string().optional().nullable()});
router.patch('/tasks/:id',validate(updateTaskSchema),async(req,res,next)=>{
  try{
    const id=uuid.parse(req.params.id);
    const v=req.validated;
    const {rows:[row]}=await query(`UPDATE tasks t SET title=$4,description=$5,status=$6,priority=$7,start_date=$8,due_date=$9 FROM projects p WHERE t.id=$3 AND p.id=t.project_id AND ${projectVisibility('p')} RETURNING t.*`,[req.user.role,req.user.id,id,v.title,v.description,v.status,v.priority,v.startDate||null,v.dueDate||null]);
    if(!row)return res.status(404).json({error:'Tarea no encontrada.'});
    await logActivity(req,'update','task',id,{title:row.title,status:row.status});
    res.json(row);
  }catch(e){next(e)}
});
router.delete('/tasks/:id',async(req,res,next)=>{
  try{
    const id=uuid.parse(req.params.id);
    const {rows:[deleted]}=await query(`DELETE FROM tasks t USING projects p WHERE t.id=$3 AND p.id=t.project_id AND ${projectVisibility('p')} RETURNING t.id,t.title,t.project_id`,[req.user.role,req.user.id,id]);
    if(!deleted)return res.status(404).json({error:'Tarea no encontrada.'});
    await logActivity(req,'delete','task',id,{title:deleted.title});
    res.status(204).end();
  }catch(e){next(e)}
});
router.patch('/tasks/:id/status',validate(z.object({status:z.enum(['pending','in_progress','review','completed']),position:z.coerce.number().int().min(0).default(0)})),async(req,res,next)=>{try{const id=uuid.parse(req.params.id);const {rows:[row]}=await query(`UPDATE tasks t SET status=$4,position=$5 FROM projects p WHERE t.id=$3 AND p.id=t.project_id AND ${projectVisibility('p')} RETURNING t.*`,[req.user.role,req.user.id,id,req.validated.status,req.validated.position]);if(!row)return res.status(404).json({error:'Tarea no encontrada.'});await logActivity(req,'move','task',id,{status:row.status});res.json(row)}catch(e){next(e)}});

const meetingSchema=z.object({projectId:uuid,title:text(200),scheduledAt:z.string().datetime(),durationMinutes:z.coerce.number().int().min(15).max(480),location:nullableText(250),attendees:nullableText(2000)});
router.post('/meetings',validate(meetingSchema),async(req,res,next)=>{try{const v=req.validated;const {rows:[row]}=await query(`INSERT INTO meetings(project_id,created_by,title,scheduled_at,duration_minutes,location,attendees) SELECT $3,$2,$4,$5,$6,$7,$8 FROM projects p WHERE p.id=$3 AND ${projectVisibility()} RETURNING *`,[req.user.role,req.user.id,v.projectId,v.title,v.scheduledAt,v.durationMinutes,v.location,v.attendees]);if(!row)return res.status(403).json({error:'Sin acceso al proyecto.'});await logActivity(req,'create','meeting',row.id);res.status(201).json(row)}catch(e){next(e)}});
router.post('/meetings/:id/notes',validate(z.object({content:text(10000),agreements:nullableText(5000)})),async(req,res,next)=>{try{const id=uuid.parse(req.params.id);const {rows:[row]}=await query(`INSERT INTO meeting_notes(meeting_id,author_id,content,agreements) SELECT m.id,$2,$4,$5 FROM meetings m JOIN projects p ON p.id=m.project_id WHERE m.id=$3 AND ${projectVisibility('p')} RETURNING *`,[req.user.role,req.user.id,id,req.validated.content,req.validated.agreements]);if(!row)return res.status(403).json({error:'Sin acceso a la reunión.'});await logActivity(req,'create','meeting_note',row.id);res.status(201).json(row)}catch(e){next(e)}});

const calcSchema=z.object({projectId:uuid.optional().nullable(),fixedCosts:z.coerce.number().min(0),products:z.array(z.object({name:text(160),price:z.coerce.number().positive(),variableCost:z.coerce.number().min(0),salesMix:z.coerce.number().positive().default(1)})).min(1).max(50)});
router.post('/break-even',validate(calcSchema),async(req,res,next)=>{try{const v=req.validated;let result;try{result=calculateBreakEven(v)}catch(error){if(error instanceof RangeError)return res.status(400).json({error:error.message});throw error}if(v.projectId){const {rows:[allowed]}=await query(`SELECT id FROM projects p WHERE p.id=$3 AND ${projectVisibility()}`,[req.user.role,req.user.id,v.projectId]);if(!allowed)return res.status(403).json({error:'Sin acceso al proyecto.'});await query('INSERT INTO break_even_analyses(project_id,created_by,fixed_costs,result) VALUES($1,$2,$3,$4)',[v.projectId,req.user.id,v.fixedCosts,JSON.stringify(result)]);await logActivity(req,'calculate','break_even',v.projectId)}res.json(result)}catch(e){next(e)}});

router.use('/admin',requireRole('admin'));
router.get('/admin/users',async(req,res,next)=>{try{const {rows}=await query('SELECT id,name,email,role,active,last_login_at,created_at FROM users WHERE deleted_at IS NULL ORDER BY name');res.json(rows.map(publicUser))}catch(e){next(e)}});
const userSchema=z.object({name:text(120),email,password,role:z.enum(['standard','admin']).default('standard'),active:z.boolean().default(true)});
router.post('/admin/users',validate(userSchema),async(req,res,next)=>{try{const v=req.validated;const hash=await hashPassword(v.password);const {rows:[row]}=await query('INSERT INTO users(name,email,password_hash,role,active) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,active,created_at',[v.name,v.email,hash,v.role,v.active]);await logActivity(req,'create','user',row.id,{email:row.email,role:row.role});res.status(201).json(publicUser(row))}catch(e){next(e)}});
router.patch('/admin/users/:id',validate(z.object({name:text(120),email,role:z.enum(['standard','admin']),active:z.boolean()})),async(req,res,next)=>{try{const id=uuid.parse(req.params.id);if(id===req.user.id&&!req.validated.active)return res.status(400).json({error:'No puede desactivar su propia cuenta.'});const v=req.validated;const {rows:[row]}=await query('UPDATE users SET name=$2,email=$3,role=$4,active=$5 WHERE id=$1 AND deleted_at IS NULL RETURNING id,name,email,role,active,created_at',[id,v.name,v.email,v.role,v.active]);if(!row)return res.status(404).json({error:'Usuario no encontrado.'});await logActivity(req,'update','user',id);res.json(publicUser(row))}catch(e){next(e)}});
router.delete('/admin/users/:id',async(req,res,next)=>{try{const id=uuid.parse(req.params.id);if(id===req.user.id)return res.status(400).json({error:'No puede eliminar su propia cuenta.'});const {rowCount}=await query('UPDATE users SET active=false,deleted_at=now() WHERE id=$1 AND deleted_at IS NULL',[id]);if(!rowCount)return res.status(404).json({error:'Usuario no encontrado.'});await query('DELETE FROM sessions WHERE user_id=$1',[id]);await logActivity(req,'delete','user',id);res.status(204).end()}catch(e){next(e)}});
router.post('/admin/users/:id/reset',async(req,res,next)=>{try{const id=uuid.parse(req.params.id);const token=randomToken();const {rowCount}=await query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at,created_by) SELECT id,$2,now()+interval '30 minutes',$3 FROM users WHERE id=$1 AND deleted_at IS NULL`,[id,sha256(token),req.user.id]);if(!rowCount)return res.status(404).json({error:'Usuario no encontrado.'});await logActivity(req,'password_reset','user',id);res.json({resetToken:token,expiresInMinutes:30})}catch(e){next(e)}});
router.post('/admin/reassign',validate(z.object({entityType:z.enum(['project','entrepreneur']),entityId:uuid,userId:uuid})),async(req,res,next)=>{try{const v=req.validated;const {rows:[target]}=await query('SELECT id FROM users WHERE id=$1 AND active=true AND deleted_at IS NULL',[v.userId]);if(!target)return res.status(400).json({error:'El responsable seleccionado no está activo.'});const table=v.entityType==='project'?'projects':'entrepreneurs';const {rowCount}=await query(`UPDATE ${table} SET owner_user_id=$1 WHERE id=$2 AND deleted_at IS NULL`,[v.userId,v.entityId]);if(!rowCount)return res.status(404).json({error:'Registro no encontrado.'});await logActivity(req,'reassign',v.entityType,v.entityId,{userId:v.userId});res.json({message:'Asignación actualizada.'})}catch(e){next(e)}});

const csvEscape=(value)=>`"${String(value??'').replaceAll('"','""')}"`;
router.get('/admin/reports/:type.csv',async(req,res,next)=>{try{const type=req.params.type;const reports={projects:{headers:['Proyecto','Emprendedor','Responsable','Sector','Etapa','Estado','Avance','Creado'],sql:`SELECT p.name,e.full_name,u.name owner,p.sector,p.stage,p.status,p.progress,p.created_at FROM projects p LEFT JOIN entrepreneurs e ON e.id=p.entrepreneur_id JOIN users u ON u.id=p.owner_user_id WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC`},entrepreneurs:{headers:['Emprendedor','Correo','Teléfono','Municipio','Responsable','Creado'],sql:`SELECT e.full_name,e.email,e.phone,e.municipality,u.name owner,e.created_at FROM entrepreneurs e JOIN users u ON u.id=e.owner_user_id WHERE e.deleted_at IS NULL ORDER BY e.created_at DESC`},activity:{headers:['Fecha','Usuario','Acción','Entidad','Identificador'],sql:`SELECT a.created_at,u.name,a.action,a.entity_type,a.entity_id FROM activity_log a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC`},tracking:{headers:['Proyecto','Tarea','Estado','Prioridad','Inicio','Vencimiento','Actualizado'],sql:`SELECT p.name,t.title,t.status,t.priority,t.start_date,t.due_date,t.updated_at FROM tasks t JOIN projects p ON p.id=t.project_id ORDER BY t.updated_at DESC`}};const report=reports[type];if(!report)return res.status(404).json({error:'Reporte no disponible.'});const {rows}=await query(report.sql);const csv='\uFEFF'+[report.headers,...rows.map(row=>Object.values(row))].map(line=>line.map(csvEscape).join(',')).join('\r\n');res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="cedemco-${type}-${new Date().toISOString().slice(0,10)}.csv"`});await logActivity(req,'export','report',type,{rows:rows.length});res.send(csv)}catch(e){next(e)}});
