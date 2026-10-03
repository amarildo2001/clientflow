import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
export function createApp({database='data/clientflow.db',seed=true}={}) {
 if(database!==':memory:') mkdirSync(path.dirname(database),{recursive:true});
 const db=new DatabaseSync(database); db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','member')));
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER);
 CREATE TABLE IF NOT EXISTS clients(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,company TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id INTEGER PRIMARY KEY,name TEXT NOT NULL,client_id INTEGER REFERENCES clients(id),budget INTEGER NOT NULL CHECK(budget>=0),deadline TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active');
 CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL REFERENCES projects(id),title TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),assignee INTEGER REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS time_entries(id INTEGER PRIMARY KEY,task_id INTEGER REFERENCES tasks(id),user_id INTEGER REFERENCES users(id),minutes INTEGER NOT NULL CHECK(minutes>0),note TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS invoices(id INTEGER PRIMARY KEY,project_id INTEGER REFERENCES projects(id),amount INTEGER NOT NULL CHECK(amount>0),status TEXT NOT NULL CHECK(status IN ('draft','sent','paid')),due TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),action TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);`);
 const hash=p=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex')};
 if(seed&&!db.prepare('SELECT id FROM users LIMIT 1').get()) {
 db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Amarildo Prendi','admin@clientflow.local',hash('DemoPass123!'),'admin');
 db.prepare('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)').run('Alex Morgan','member@clientflow.local',hash('DemoPass123!'),'member');
 db.exec(`INSERT INTO clients VALUES(1,'Olivia Reed','olivia@example.com','Northline Studio'),(2,'James Wilson','james@example.com','Oak & Stone'),(3,'Emma Davis','emma@example.com','Harbor Digital');
 INSERT INTO projects VALUES(1,'Northline brand platform',1,480000,'2026-11-12','active'),(2,'Oak & Stone commerce',2,720000,'2026-11-24','active'),(3,'Harbor SEO rollout',3,240000,'2026-11-08','active');
 INSERT INTO tasks VALUES(1,1,'Map the customer journey','done',1),(2,1,'Build responsive component system','doing',1),(3,1,'Accessibility review','todo',2),(4,2,'Implement checkout validation','doing',2),(5,2,'Product catalogue import','todo',1),(6,3,'Audit canonical URLs','done',1),(7,3,'Publish service page templates','todo',2);
 INSERT INTO time_entries(task_id,user_id,minutes,note) VALUES(2,1,150,'Component architecture'),(4,2,90,'Checkout prototype'),(6,1,120,'Technical audit');
 INSERT INTO invoices VALUES(1,1,160000,'paid','2026-10-01'),(2,2,240000,'sent','2026-10-20'),(3,3,80000,'draft','2026-10-28');
 INSERT INTO activity(user_id,action) VALUES(1,'Created the Northline project'),(2,'Started checkout validation'),(1,'Completed the technical SEO audit');`);
 }
 const stmt=(sql,...args)=>db.prepare(sql).all(...args);
 const one=(sql,...args)=>db.prepare(sql).get(...args);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 const audit=(id,action)=>run('INSERT INTO activity(user_id,action) VALUES(?,?)',id,action);
 const text=(v,min=1,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw Object.assign(new Error('Invalid text field'),{status:400});return v.trim()};
 const integer=(v,min=1)=>{if(!Number.isSafeInteger(v)||v<min)throw Object.assign(new Error('Invalid numeric field'),{status:400});return v};
 const date=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Object.assign(new Error('Invalid date'),{status:400});return v};
 const exists=(table,id)=>{integer(id);if(!one(`SELECT id FROM ${table} WHERE id=?`,id))throw Object.assign(new Error('Record not found'),{status:404});return id};
 const attempts=new Map();
 const server=http.createServer(async(req,res)=>{
 const send=(status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data))};
 try {
 const url=new URL(req.url,'http://localhost');const route=url.pathname;
 if(!route.startsWith('/api/')) {
 if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'});
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(!files[route])return send(404,{error:'Not found'});
 res.writeHead(200,{'Content-Type':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'"});return res.end(req.method==='HEAD'?'':readFileSync(path.join(root,'public',files[route])));
 }
 if(!['GET','POST','PATCH'].includes(req.method))return send(405,{error:'Method not allowed'});
 if(req.method!=='GET'&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(403,{error:'Origin rejected'});
 let body={};if(req.method!=='GET'){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)return send(413,{error:'Request too large'});chunks.push(chunk)}try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch{return send(400,{error:'Invalid JSON'})}}
 if(route==='/api/login'&&req.method==='POST') {
 const ip=req.socket.remoteAddress;const limit=attempts.get(ip)||{count:0,until:Date.now()+60000};if(limit.until<Date.now()){limit.count=0;limit.until=Date.now()+60000}if(limit.count>=10)return send(429,{error:'Too many attempts. Try again in a minute.'});limit.count++;attempts.set(ip,limit);
 const user=one('SELECT * FROM users WHERE email=?',text(body.email));const password=text(body.password,1,128);let valid=false;if(user){const [salt,key]=user.password.split(':');valid=timingSafeEqual(Buffer.from(key,'hex'),scryptSync(password,salt,64))}if(!valid)return send(401,{error:'Incorrect email or password'});
 const token=randomBytes(32).toString('hex');run('DELETE FROM sessions WHERE expires<?',Date.now());run('INSERT INTO sessions VALUES(?,?,?)',token,user.id,Date.now()+86400000);return send(200,{ok:true},{'Set-Cookie':`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE==='1'?'; Secure':''}`});
 }
 const token=(req.headers.cookie||'').match(/(?:^|;\s*)session=([a-f0-9]{64})(?:;|$)/)?.[1];const user=token&&one('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?',token,Date.now());if(!user)return send(401,{error:'Please sign in'});
 if(route==='/api/logout'&&req.method==='POST'){run('DELETE FROM sessions WHERE token=?',token);return send(200,{ok:true},{'Set-Cookie':'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'})}
 if(route==='/api/workspace'&&req.method==='GET')return send(200,{user,users:stmt('SELECT id,name,role FROM users'),clients:stmt('SELECT * FROM clients'),projects:stmt('SELECT * FROM projects'),tasks:stmt('SELECT * FROM tasks'),time:stmt('SELECT * FROM time_entries ORDER BY id DESC'),invoices:stmt('SELECT * FROM invoices'),activity:stmt('SELECT a.*,u.name FROM activity a JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 30')});
 const admin=()=>{if(user.role!=='admin')throw Object.assign(new Error('Administrator permission required'),{status:403})};
 if(route==='/api/clients'&&req.method==='POST'){admin();const result=run('INSERT INTO clients(name,email,company) VALUES(?,?,?)',text(body.name),text(body.email),text(body.company));audit(user.id,'Added client '+body.company);return send(201,{id:Number(result.lastInsertRowid)})}
 if(route==='/api/projects'&&req.method==='POST'){admin();const result=run('INSERT INTO projects(name,client_id,budget,deadline) VALUES(?,?,?,?)',text(body.name),exists('clients',body.client_id),integer(body.budget,0),date(body.deadline));audit(user.id,'Created project '+body.name);return send(201,{id:Number(result.lastInsertRowid)})}
 if(route==='/api/tasks'&&req.method==='POST'){const result=run('INSERT INTO tasks(project_id,title,status,assignee) VALUES(?,?,?,?)',exists('projects',body.project_id),text(body.title),'todo',exists('users',body.assignee));audit(user.id,'Added task '+body.title);return send(201,{id:Number(result.lastInsertRowid)})}
 const task=route.match(/^\/api\/tasks\/(\d+)$/);if(task&&req.method==='PATCH'){const id=exists('tasks',Number(task[1]));if(!['todo','doing','done'].includes(body.status))return send(400,{error:'Invalid task status'});run('UPDATE tasks SET status=? WHERE id=?',body.status,id);audit(user.id,`Moved task #${id} to ${body.status}`);return send(200,{ok:true})}
 if(route==='/api/time'&&req.method==='POST'){const result=run('INSERT INTO time_entries(task_id,user_id,minutes,note) VALUES(?,?,?,?)',exists('tasks',body.task_id),user.id,integer(body.minutes),text(body.note));audit(user.id,'Logged '+body.minutes+' minutes');return send(201,{id:Number(result.lastInsertRowid)})}
 if(route==='/api/invoices'&&req.method==='POST'){admin();const result=run('INSERT INTO invoices(project_id,amount,status,due) VALUES(?,?,?,?)',exists('projects',body.project_id),integer(body.amount),'draft',date(body.due));audit(user.id,'Created a draft invoice');return send(201,{id:Number(result.lastInsertRowid)})}
 const invoice=route.match(/^\/api\/invoices\/(\d+)$/);if(invoice&&req.method==='PATCH'){admin();const id=exists('invoices',Number(invoice[1]));const old=one('SELECT status FROM invoices WHERE id=?',id).status;const next={draft:'sent',sent:'paid'}[old];if(body.status!==next)return send(409,{error:'Invoices must move from draft to sent to paid'});run('UPDATE invoices SET status=? WHERE id=?',next,id);audit(user.id,`Invoice #${id} marked ${next}`);return send(200,{ok:true})}
 return send(404,{error:'Not found'});
 }catch(e){if(e.status)return send(e.status,{error:e.message});console.error(e);send(500,{error:'Unexpected server error'})}
 });return {server,db};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const {server}=createApp({database:process.env.DB_PATH||'data/clientflow.db',seed:process.env.SEED_DEMO!=='0'});server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('ClientFlow: http://localhost:'+(process.env.PORT||3000)))}
