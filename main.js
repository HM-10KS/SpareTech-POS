const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { DatabaseSync } = require('node:sqlite');

let db;
let currentUser = null;

// جميع عمليات قاعدة البيانات تتطلب جلسة دخول. إدارة الحسابات للمدير فقط.
const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => originalHandle(channel, async (event, ...args) => {
  if (!channel.startsWith('auth:') && !currentUser) {
    throw new Error('يجب تسجيل الدخول أولاً');
  }
  if ((channel.startsWith('accounts:') || channel === 'backup:restore' || channel === 'backup:create') && currentUser?.role !== 'admin') {
    throw new Error('هذه العملية متاحة لمدير المنظومة فقط');
  }
  return listener(event, ...args);
});

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'mawja_spare_parts.db');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      vehicle_type TEXT DEFAULT 'سيارات وشاحنات',
      brand TEXT DEFAULT '',
      buy_price REAL NOT NULL DEFAULT 0,
      sell_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      min_quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER,
      customer_name TEXT DEFAULT 'زبون نقدي',
      customer_phone TEXT DEFAULT '',
      sale_type TEXT DEFAULT 'نقدي',
      payment_method TEXT DEFAULT 'نقدي',
      total REAL NOT NULL DEFAULT 0,
      paid REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      barcode TEXT DEFAULT '',
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS sale_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT NOT NULL UNIQUE,
      sale_id INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      total REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sale_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      sale_item_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY(return_id) REFERENCES sale_returns(id) ON DELETE CASCADE,
      FOREIGN KEY(sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee' CHECK(role IN ('admin','employee')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (count === 0) {
    const add = db.prepare(`INSERT INTO products (barcode,name,category,vehicle_type,brand,buy_price,sell_price,quantity,min_quantity,location) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    [
      ['622000000001','فلتر زيت','فلاتر','سيارات','عام',18,25,30,5,'A-01'],
      ['622000000002','فلتر هواء شاحنة','فلاتر','شاحنات','عام',45,60,12,3,'B-02'],
      ['622000000003','سير محرك','سيور','سيارات وشاحنات','عام',22,35,20,4,'C-01']
    ].forEach(p => add.run(...p));
  }
}
function all(sql, ...params) { return db.prepare(sql).all(...params); }
function one(sql, ...params) { return db.prepare(sql).get(...params); }
function run(sql, ...params) { return db.prepare(sql).run(...params); }

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'موجة البرمجة | منظومة قطع الغيار',
    backgroundColor: '#f4f7fb',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  const indexPath = path.join(__dirname, 'index.html');
  win.loadURL(pathToFileURL(indexPath).href);
}
app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// المصادقة وإدارة المستخدمين: لا توجد كلمة مرور افتراضية.
ipcMain.handle('auth:status', () => ({
  setupRequired: Number(one('SELECT COUNT(*) n FROM users').n) === 0,
  user: currentUser ? { id: currentUser.id, full_name: currentUser.full_name, username: currentUser.username, role: currentUser.role } : null
}));

ipcMain.handle('auth:setup', (_, data) => {
  if (Number(one('SELECT COUNT(*) n FROM users').n) !== 0) {
    throw new Error('تم إعداد حساب المدير مسبقًا. سجّل الدخول.');
  }
  const fullName = String(data.full_name || '').trim();
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  if (fullName.length < 2) throw new Error('اكتب اسم المدير بشكل صحيح');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) throw new Error('اسم المستخدم يجب أن يكون 3 أحرف على الأقل ويحتوي أحرفًا إنجليزية أو أرقامًا أو . _ -');
  if (password.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
  const { salt, hash } = hashPassword(password);
  run('INSERT INTO users(full_name,username,password_hash,password_salt,role,active) VALUES(?,?,?,?,?,1)', fullName, username, hash, salt, 'admin');
  currentUser = one('SELECT id,full_name,username,role FROM users WHERE username=?', username);
  return { user: currentUser };
});

ipcMain.handle('auth:login', (_, data) => {
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  const user = one('SELECT * FROM users WHERE username=? COLLATE NOCASE', username);
  if (!user || !user.active || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب موقوف');
  }
  currentUser = { id: user.id, full_name: user.full_name, username: user.username, role: user.role };
  return { user: currentUser };
});

ipcMain.handle('auth:logout', () => {
  currentUser = null;
  return { ok: true };
});

ipcMain.handle('accounts:list', () => all('SELECT id,full_name,username,role,active,created_at FROM users ORDER BY id'));

ipcMain.handle('accounts:create', (_, data) => {
  const fullName = String(data.full_name || '').trim();
  const username = String(data.username || '').trim();
  const password = String(data.password || '');
  const role = data.role === 'admin' ? 'admin' : 'employee';
  if (fullName.length < 2) throw new Error('اسم الموظف مطلوب');
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) throw new Error('اسم المستخدم يجب أن يكون 3 أحرف على الأقل وبالإنجليزية');
  if (password.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
  const { salt, hash } = hashPassword(password);
  try {
    run('INSERT INTO users(full_name,username,password_hash,password_salt,role,active) VALUES(?,?,?,?,?,1)', fullName, username, hash, salt, role);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('اسم المستخدم مستخدم من قبل');
    throw e;
  }
  return { ok: true };
});

ipcMain.handle('accounts:toggle', (_, id) => {
  const user = one('SELECT id,role,active FROM users WHERE id=?', Number(id));
  if (!user) throw new Error('الحساب غير موجود');
  if (Number(user.id) === Number(currentUser.id)) throw new Error('لا يمكنك إيقاف حسابك أثناء استخدامه');
  if (user.role === 'admin' && Number(one("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").n) <= 1 && user.active) {
    throw new Error('لا يمكن إيقاف آخر حساب مدير نشط');
  }
  run('UPDATE users SET active=? WHERE id=?', user.active ? 0 : 1, Number(id));
  return { ok: true };
});

ipcMain.handle('dashboard:get', () => {
  const products = one('SELECT COUNT(*) n FROM products').n;
  const stockValue = one('SELECT COALESCE(SUM(quantity*buy_price),0) n FROM products').n;
  const todaySales = one("SELECT COALESCE(SUM(total),0) n FROM sales WHERE date(created_at)=date('now','localtime')").n;
  const todayInvoices = one("SELECT COUNT(*) n FROM sales WHERE date(created_at)=date('now','localtime')").n;
  const lowStock = one('SELECT COUNT(*) n FROM products WHERE quantity<=min_quantity').n;
  const due = one('SELECT COALESCE(SUM(remaining),0) n FROM sales').n;
  return { products, stockValue, todaySales, todayInvoices, lowStock, due, recent: all('SELECT id,invoice_no,customer_name,total,payment_method,created_at FROM sales ORDER BY id DESC LIMIT 7') };
});
ipcMain.handle('products:list', (_, q='') => {
  const term = `%${String(q).trim()}%`;
  return all('SELECT * FROM products WHERE name LIKE ? OR barcode LIKE ? OR category LIKE ? OR brand LIKE ? ORDER BY id DESC LIMIT 1000', term,term,term,term);
});
ipcMain.handle('products:save', (_, p) => {
  const data = [p.barcode || null, p.name.trim(), p.category || '', p.vehicle_type || 'سيارات وشاحنات', p.brand || '', Number(p.buy_price)||0, Number(p.sell_price)||0, Math.max(0,parseInt(p.quantity)||0), Math.max(0,parseInt(p.min_quantity)||0), p.location||''];
  if (!p.name || !p.name.trim()) throw new Error('اسم الصنف مطلوب');
  if (p.id) {
    run('UPDATE products SET barcode=?,name=?,category=?,vehicle_type=?,brand=?,buy_price=?,sell_price=?,quantity=?,min_quantity=?,location=? WHERE id=?', ...data, p.id);
    return { id:p.id };
  }
  run('INSERT INTO products (barcode,name,category,vehicle_type,brand,buy_price,sell_price,quantity,min_quantity,location) VALUES (?,?,?,?,?,?,?,?,?,?)', ...data);
  return { id: Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('products:delete', (_, id) => run('DELETE FROM products WHERE id=?', Number(id)));
ipcMain.handle('customers:list', () => all('SELECT * FROM customers ORDER BY id DESC'));
ipcMain.handle('customers:save', (_, c) => {
  if (!c.name || !c.name.trim()) throw new Error('اسم الزبون مطلوب');
  run('INSERT INTO customers(name,phone,address) VALUES(?,?,?)', c.name.trim(), c.phone||'', c.address||'');
  return { id: Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('sales:create', (_, sale) => {
  if (!Array.isArray(sale.items) || sale.items.length === 0) throw new Error('أضف صنفًا واحدًا على الأقل للفاتورة');
  const insertSale = db.prepare(`INSERT INTO sales(invoice_no,customer_id,customer_name,customer_phone,sale_type,payment_method,total,paid,remaining,note) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  const insertItem = db.prepare('INSERT INTO sale_items(sale_id,product_id,product_name,barcode,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?)');
  const updateStock = db.prepare('UPDATE products SET quantity=quantity-? WHERE id=? AND quantity>=?');
  // node:sqlite لا يوفر db.transaction()؛ نستخدم معاملات SQLite مباشرة.
  db.exec('BEGIN IMMEDIATE');
  try {
    let total = 0;
    const prepared = sale.items.map(it => {
      const product = one('SELECT * FROM products WHERE id=?', Number(it.product_id));
      if (!product) throw new Error('أحد الأصناف غير موجود');
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      if (product.quantity < qty) throw new Error(`الكمية غير كافية للصنف: ${product.name}`);
      const price = Number(it.unit_price ?? product.sell_price);
      if (!Number.isFinite(price) || price < 0) throw new Error(`سعر غير صالح للصنف: ${product.name}`);
      total += qty * price;
      return { product, qty, price };
    });

    const invoiceNo = 'INV-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const paid = Math.max(0, Number(sale.paid) || 0);
    if (paid > total) throw new Error('المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة');

    const info = insertSale.run(
      invoiceNo, sale.customer_id || null, String(sale.customer_name || '').trim() || 'زبون نقدي',
      String(sale.customer_phone || '').trim(), sale.sale_type === 'آجل' ? 'آجل' : 'نقدي',
      sale.payment_method || 'نقدي', total, paid, Math.max(0, total - paid), sale.note || ''
    );
    const saleId = Number(info.lastInsertRowid);

    for (const it of prepared) {
      insertItem.run(saleId, it.product.id, it.product.name, it.product.barcode || '', it.qty, it.price, it.qty * it.price);
      const stock = updateStock.run(it.qty, it.product.id, it.qty);
      if (Number(stock.changes) !== 1) throw new Error(`تعذر خصم المخزون للصنف: ${it.product.name}`);
    }

    db.exec('COMMIT');
    return { id: saleId, invoice_no: invoiceNo, total, paid, remaining: Math.max(0, total - paid) };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw error;
  }
});
ipcMain.handle('sales:list', (_, q='') => {
  const term = `%${String(q).trim()}%`;
  return all('SELECT * FROM sales WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? ORDER BY id DESC LIMIT 1000',term,term,term);
});
ipcMain.handle('sales:items', (_, id) => all('SELECT * FROM sale_items WHERE sale_id=?', Number(id)));

// مردودات المبيعات: إعادة الكمية للمخزون ومنع تجاوز الكمية المباعة.
ipcMain.handle('returns:list', () => all(`
  SELECT r.id, r.return_no, s.invoice_no, s.customer_name, r.reason, r.total, r.created_at
  FROM sale_returns r JOIN sales s ON s.id = r.sale_id ORDER BY r.id DESC LIMIT 1000
`));
ipcMain.handle('returns:invoice-items', (_, invoiceNo) => {
  const sale = one('SELECT id, invoice_no, customer_name FROM sales WHERE invoice_no = ?', String(invoiceNo || '').trim());
  if (!sale) throw new Error('رقم الفاتورة غير موجود');
  return all(`
    SELECT si.id AS sale_item_id, si.product_id, si.product_name, si.quantity AS sold_quantity,
      si.unit_price,
      si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM sale_return_items ri WHERE ri.sale_item_id = si.id), 0) AS returnable_quantity
    FROM sale_items si WHERE si.sale_id = ? ORDER BY si.id
  `, sale.id).map(item => ({...item, sale_id: sale.id, invoice_no: sale.invoice_no, customer_name: sale.customer_name}));
});
ipcMain.handle('returns:create', (_, data) => {
  const saleItemId = Number(data.sale_item_id);
  const qty = Number.parseInt(data.quantity, 10);
  if (!Number.isSafeInteger(saleItemId) || saleItemId <= 0) throw new Error('اختر صنفًا صحيحًا من الفاتورة');
  if (!Number.isSafeInteger(qty) || qty <= 0) throw new Error('كمية المردود يجب أن تكون عددًا صحيحًا أكبر من صفر');
  db.exec('BEGIN IMMEDIATE');
  try {
    const item = one(`
      SELECT si.*, s.id AS parent_sale_id, s.invoice_no,
        si.quantity - COALESCE((SELECT SUM(ri.quantity) FROM sale_return_items ri WHERE ri.sale_item_id = si.id), 0) AS returnable_quantity
      FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.id = ?
    `, saleItemId);
    if (!item) throw new Error('الصنف غير موجود في الفاتورة');
    if (qty > Number(item.returnable_quantity)) throw new Error(`الكمية المتاحة للإرجاع هي ${item.returnable_quantity}`);
    if (!item.product_id) throw new Error('الصنف محذوف من المخزون ولا يمكن إعادة كميته تلقائيًا');
    const total = qty * Number(item.unit_price);
    const returnNo = 'RET-' + new Date().toISOString().replace(/\D/g, '').slice(0,14) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const r = run('INSERT INTO sale_returns(return_no, sale_id, reason, total) VALUES(?,?,?,?)', returnNo, item.parent_sale_id, String(data.reason || '').trim(), total);
    const returnId = Number(r.lastInsertRowid);
    run('INSERT INTO sale_return_items(return_id, sale_item_id, product_id, product_name, quantity, unit_price, line_total) VALUES(?,?,?,?,?,?,?)', returnId, item.id, item.product_id, item.product_name, qty, item.unit_price, total);
    run('UPDATE products SET quantity = quantity + ? WHERE id = ?', qty, item.product_id);
    db.exec('COMMIT');
    return { id: returnId, return_no: returnNo, total };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw error;
  }
});
ipcMain.handle('expenses:list', () => all('SELECT * FROM expenses ORDER BY id DESC LIMIT 500'));
ipcMain.handle('expenses:add', (_, e) => {
  if (!e.title || !e.title.trim()) throw new Error('اسم المصروف مطلوب');
  run('INSERT INTO expenses(title,amount,note) VALUES(?,?,?)',e.title.trim(),Math.max(0,Number(e.amount)||0),e.note||'');
  return { id:Number(one('SELECT last_insert_rowid() id').id) };
});
ipcMain.handle('reports:get', (_, period='month') => {
  let where = "date(created_at)>=date('now','start of month','localtime')";
  if (period === 'today') where = "date(created_at)=date('now','localtime')";
  if (period === 'all') where = '1=1';
  const sales = all(`SELECT * FROM sales WHERE ${where} ORDER BY id DESC`);
  const totals = one(`SELECT COALESCE(SUM(total),0) total,COALESCE(SUM(paid),0) paid,COALESCE(SUM(remaining),0) remaining,COUNT(*) invoices FROM sales WHERE ${where}`);
  const expenses = one(`SELECT COALESCE(SUM(amount),0) amount FROM expenses WHERE ${where}`);
  return { sales, totals, expenses: expenses.amount };
});
ipcMain.handle('backup:create', async () => {
  const result = await dialog.showSaveDialog({ title:'حفظ نسخة احتياطية', defaultPath:`Mawja_Backup_${new Date().toISOString().slice(0,10)}.db`, filters:[{name:'SQLite Database',extensions:['db']}] });
  if (result.canceled || !result.filePath) return { canceled:true };
  db.exec('PRAGMA wal_checkpoint(FULL)');
  fs.copyFileSync(path.join(app.getPath('userData'),'mawja_spare_parts.db'),result.filePath);
  return { canceled:false, filePath:result.filePath };
});
ipcMain.handle('backup:restore', async () => {
  const result = await dialog.showOpenDialog({ title:'اختيار نسخة احتياطية', properties:['openFile'], filters:[{name:'SQLite Database',extensions:['db']}] });
  if (result.canceled || !result.filePaths[0]) return { canceled:true };
  let test;
  try {
    const sourcePath = result.filePaths[0];
    test = new DatabaseSync(sourcePath, { readOnly: true });
    const integrity = test.prepare('PRAGMA quick_check').get();
    if (!integrity || integrity.quick_check !== 'ok') throw new Error('فشل فحص سلامة قاعدة البيانات');
    const requiredTables = ['products','customers','sales','sale_items','expenses','users'];
    const tables = new Set(test.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const missing = requiredTables.filter(name => !tables.has(name));
    if (missing.length) throw new Error('النسخة لا تحتوي على جداول المنظومة المطلوبة');
    test.close();
    test = null;
    const targetPath = path.join(app.getPath('userData'),'mawja_spare_parts.db');
    db.exec('PRAGMA wal_checkpoint(FULL)');
    db.close();
    db = null;
    fs.copyFileSync(sourcePath, targetPath);
    app.relaunch(); app.exit(0);
    return { canceled:false };
  } catch(e) {
    try { test?.close(); } catch (_) {}
    if (!db) initDb();
    throw new Error('تعذرت استعادة النسخة الاحتياطية: '+e.message);
  }
});
ipcMain.handle('app:info', () => ({ version: app.getVersion(), dbPath:path.join(app.getPath('userData'),'mawja_spare_parts.db') }));
