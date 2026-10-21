const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = n => `${Number(n||0).toLocaleString('ar-LY',{minimumFractionDigits:2,maximumFractionDigits:2})} د.ل`;
const num = n => Number(n||0).toLocaleString('ar-LY');
const dateText = value => value ? new Date(String(value).replace(' ','T')+'Z').toLocaleString('ar-LY',{dateStyle:'short',timeStyle:'short'}) : '—';
const titles = {dashboard:'لوحة التحكم',products:'الأصناف والمخزون',sales:'فواتير المبيعات',returns:'مردودات المبيعات',customers:'الزبائن',expenses:'المصروفات',reports:'التقارير',settings:'النسخ الاحتياطي',accounts:'حسابات المستخدمين'};
let page = 'dashboard', productsCache = [], saleItems = [], toastTimer, currentUser = null;
function toast(message, error=false){const el=$('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='toast',3400);}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function empty(title,desc,icon='▦'){return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${title}</strong><p>${desc}</p></div>`;}
function setPage(next){page=next;$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#page-title').textContent=titles[page];renderPage();}
function renderPage(){if(page==='accounts'&&currentUser?.role!=='admin'){toast('إدارة الحسابات متاحة للمدير فقط',true);page='dashboard';}({dashboard:renderDashboard,products:renderProducts,sales:renderSales,returns:renderReturns,customers:renderCustomers,expenses:renderExpenses,reports:renderReports,settings:renderSettings,accounts:renderAccounts}[page]||renderDashboard)().catch(e=>toast(e.message||'حدث خطأ غير متوقع',true));}
function heading(title,sub,action=''){return `<div class="section-heading"><div><h2>${title}</h2><p>${sub}</p></div>${action}</div>`;}
function table(rows,heads){return `<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||''}</tbody></table></div>`;}
async function renderDashboard(){
 const d=await window.mawja.dashboard();
 $('#page-content').innerHTML=`
 <div class="welcome"><div><h2>أهلًا بك في موجة البرمجة 👋</h2><p>كل أعمال قطع غيار السيارات والشاحنات في مكان واحد. بياناتك محفوظة محليًا على جهازك.</p></div><div class="welcome-tag">● يعمل دون إنترنت</div></div>
 <div class="stats-grid">
 <div class="stat-card"><div class="stat-top"><span>عدد الأصناف</span><span class="stat-icon">▦</span></div><strong class="stat-number">${num(d.products)}</strong><div class="stat-sub">صنف مسجل في المخزون</div></div>
 <div class="stat-card"><div class="stat-top"><span>مبيعات اليوم</span><span class="stat-icon green">↗</span></div><strong class="stat-number">${money(d.todaySales)}</strong><div class="stat-sub">${num(d.todayInvoices)} فاتورة اليوم</div></div>
 <div class="stat-card"><div class="stat-top"><span>قيمة المخزون (شراء)</span><span class="stat-icon orange">◈</span></div><strong class="stat-number">${money(d.stockValue)}</strong><div class="stat-sub">القيمة التقديرية للأصناف</div></div>
 <div class="stat-card"><div class="stat-top"><span>ديون الزبائن</span><span class="stat-icon red">◷</span></div><strong class="stat-number">${money(d.due)}</strong><div class="stat-sub">${num(d.lowStock)} أصناف وصلت حد التنبيه</div></div>
 </div>
 <div class="dashboard-grid"><div><div class="panel"><div class="panel-head"><div><h3>آخر فواتير المبيعات</h3><p>أحدث العمليات المسجلة في المنظومة</p></div><button class="btn btn-light" data-go="sales">عرض الكل ←</button></div>
 ${d.recent.length?table(d.recent.map(s=>`<tr><td><strong>${esc(s.invoice_no)}</strong></td><td>${esc(s.customer_name)}</td><td class="money">${money(s.total)}</td><td>${esc(s.payment_method)}</td><td>${dateText(s.created_at)}</td></tr>`).join(''),['رقم الفاتورة','الزبون','الإجمالي','الدفع','التاريخ']):empty('لا توجد فواتير بعد','ستظهر هنا أحدث فواتير المبيعات','▤')}</div></div>
 <div><div class="panel"><div class="panel-head"><div><h3>إجراءات سريعة</h3><p>ابدأ عملك بخطوة واحدة</p></div></div><div class="quick-list">
 <button class="quick-action" data-action="new-product"><span class="quick-icon">＋</span><span><strong>إضافة صنف جديد</strong><small>تسجيل قطعة غيار في المخزون</small></span><span class="arrow">←</span></button>
 <button class="quick-action" data-action="new-sale"><span class="quick-icon">▤</span><span><strong>إنشاء فاتورة بيع</strong><small>تسجيل عملية بيع جديدة</small></span><span class="arrow">←</span></button>
 <button class="quick-action" data-action="new-customer"><span class="quick-icon">♙</span><span><strong>إضافة زبون</strong><small>حفظ بيانات الزبائن</small></span><span class="arrow">←</span></button>
 <button class="quick-action" data-action="backup"><span class="quick-icon">⇩</span><span><strong>نسخة احتياطية</strong><small>حماية بيانات منظومتك</small></span><span class="arrow">←</span></button></div>
 ${d.lowStock?`<div class="notice">تنبيه: يوجد ${num(d.lowStock)} صنفًا عند حد التنبيه أو أقل. راجع المخزون.</div>`:''}</div></div></div>`;
}
function productRow(p){return `<tr><td><span class="product-name">${esc(p.name)}</span><div class="muted">${esc(p.brand||'بدون ماركة')}</div></td><td>${esc(p.barcode||'—')}</td><td>${esc(p.category||'—')}</td><td>${esc(p.vehicle_type)}</td><td>${money(p.sell_price)}</td><td>${p.quantity<=p.min_quantity?`<span class="badge danger">${num(p.quantity)} — منخفض</span>`:`<span class="badge">${num(p.quantity)} متوفر</span>`}</td><td>${esc(p.location||'—')}</td><td><div class="actions"><button class="btn btn-light btn-small" data-edit-product="${p.id}">تعديل</button><button class="btn btn-danger btn-small" data-delete-product="${p.id}">حذف</button></div></td></tr>`;}
async function renderProducts(){
 productsCache=await window.mawja.products.list($('#product-search')?.value||'');
 $('#page-content').innerHTML=`${heading('إدارة الأصناف والمخزون','أضف قطع الغيار وتابع الأسعار والكميات بدقة.',`<button class="btn btn-primary" data-action="new-product">＋ إضافة صنف</button>`)}
 <div class="panel"><div class="toolbar"><div class="searchbox"><input id="product-search" placeholder="ابحث بالاسم أو الباركود أو التصنيف..." value="${esc($('#product-search')?.value||'')}"></div><span class="muted">${num(productsCache.length)} صنف</span></div>
 ${productsCache.length?table(productsCache.map(productRow).join(''),['اسم الصنف','الباركود','التصنيف','المركبة','سعر البيع','الكمية','الموقع','إجراءات']):empty('لا توجد أصناف مطابقة','أضف صنفًا جديدًا أو غيّر كلمات البحث')}
 </div>`;
 $('#product-search').addEventListener('input',debounce(async()=>{productsCache=await window.mawja.products.list($('#product-search').value);const body=$('tbody');if(body)body.innerHTML=productsCache.map(productRow).join('')||`<tr><td colspan="8">${empty('لا توجد نتائج','جرّب كلمة بحث أخرى')}</td></tr>`;},180));
}
function openProduct(p=null){const f=$('#product-form');f.reset();f.elements.id.value=p?.id||'';$('#product-modal-title').textContent=p?'تعديل بيانات الصنف':'إضافة صنف جديد';for(const k of ['name','barcode','category','vehicle_type','brand','buy_price','sell_price','quantity','min_quantity','location'])if(p&&f.elements[k])f.elements[k].value=p[k]??'';if(!p){f.elements.buy_price.value=0;f.elements.sell_price.value=0;f.elements.quantity.value=0;f.elements.min_quantity.value=0;}$('#product-dialog').showModal();}
async function renderSales(){const rows=await window.mawja.sales.list($('#sales-search')?.value||'');$('#page-content').innerHTML=`${heading('فواتير المبيعات','تابع الفواتير والمبالغ المدفوعة والمتبقية.',`<button class="btn btn-primary" data-action="new-sale">＋ فاتورة جديدة</button>`)}<div class="panel"><div class="toolbar"><div class="searchbox"><input id="sales-search" placeholder="بحث برقم الفاتورة أو اسم الزبون..." value="${esc($('#sales-search')?.value||'')}"></div><span class="muted">${num(rows.length)} فاتورة</span></div>${rows.length?table(rows.map(s=>`<tr><td><strong>${esc(s.invoice_no)}</strong></td><td>${esc(s.customer_name)}</td><td>${esc(s.customer_phone||'—')}</td><td class="money">${money(s.total)}</td><td>${money(s.paid)}</td><td>${s.remaining>0?`<span class="badge warning">${money(s.remaining)}</span>`:`<span class="badge">مكتملة</span>`}</td><td>${esc(s.payment_method)}</td><td>${dateText(s.created_at)}</td><td><button class="btn btn-light btn-small" data-sale-details="${s.id}">التفاصيل</button></td></tr>`).join(''),['رقم الفاتورة','الزبون','الهاتف','الإجمالي','المدفوع','المتبقي','طريقة الدفع','التاريخ','']) : empty('لا توجد فواتير','أنشئ فاتورتك الأولى لتظهر هنا','▤')}</div>`;$('#sales-search').addEventListener('input',debounce(async()=>{const r=await window.mawja.sales.list($('#sales-search').value);$('tbody').innerHTML=r.map(s=>`<tr><td>${esc(s.invoice_no)}</td><td>${esc(s.customer_name)}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td><td>${money(s.remaining)}</td><td>${esc(s.payment_method)}</td><td>${dateText(s.created_at)}</td><td><button class="btn btn-light btn-small" data-sale-details="${s.id}">التفاصيل</button></td></tr>`).join('')||`<tr><td colspan="8">لا توجد نتائج</td></tr>`;},180));}
async function renderReturns(){const rows=await window.mawja.returns.list();$('#page-content').innerHTML=`${heading('مردودات المبيعات','سجّل إرجاع الأصناف من فواتير البيع، وسيتم تحديث المخزون تلقائيًا.',`<button class="btn btn-primary" data-action="new-return">＋ تسجيل مردود</button>`)}<div class="panel">${rows.length?table(rows.map(r=>`<tr><td><strong>${esc(r.return_no)}</strong></td><td>${esc(r.invoice_no)}</td><td>${esc(r.customer_name||'زبون نقدي')}</td><td>${esc(r.reason||'—')}</td><td class="money">${money(r.total)}</td><td>${dateText(r.created_at)}</td></tr>`).join(''),['رقم المردود','فاتورة البيع','الزبون','السبب','قيمة المردود','التاريخ']):empty('لا توجد مردودات','اضغط تسجيل مردود لإرجاع صنف من فاتورة سابقة','↩')}</div>`;}
function openReturn(){const f=$('#return-form');f.reset();$('#return-item-select').innerHTML='<option value="">حمّل فاتورة أولاً</option>';$('#return-qty').value=1;$('#return-dialog').showModal();$('#return-invoice-no').focus();}
async function loadReturnInvoice(){const no=$('#return-invoice-no').value.trim();if(!no){toast('اكتب رقم فاتورة البيع أولاً',true);return;}try{const items=await window.mawja.returns.invoiceItems(no);const sel=$('#return-item-select');sel.innerHTML=items.filter(i=>Number(i.returnable_quantity)>0).map(i=>`<option value="${i.sale_item_id}" data-max="${i.returnable_quantity}">${esc(i.product_name)} — المتاح للإرجاع ${i.returnable_quantity} — ${money(i.unit_price)}</option>`).join('')||'<option value="">لا توجد كميات قابلة للإرجاع</option>';if(!sel.value)throw new Error('هذه الفاتورة لا تحتوي على كميات قابلة للإرجاع');$('#return-qty').max=sel.selectedOptions[0]?.dataset.max||1;toast('تم تحميل أصناف الفاتورة');}catch(err){$('#return-item-select').innerHTML='<option value="">تعذر تحميل الفاتورة</option>';toast(err.message||'تعذر تحميل الفاتورة',true);}}
async function renderCustomers(){const rows=await window.mawja.customers.list();$('#page-content').innerHTML=`${heading('إدارة الزبائن','احتفظ بأسماء الزبائن وأرقام هواتفهم وعناوينهم.',`<button class="btn btn-primary" data-action="new-customer">＋ إضافة زبون</button>`)}<div class="panel">${rows.length?table(rows.map(c=>`<tr><td><strong>${esc(c.name)}</strong></td><td>${esc(c.phone||'—')}</td><td>${esc(c.address||'—')}</td><td>${dateText(c.created_at)}</td></tr>`).join(''),['اسم الزبون','رقم الهاتف','العنوان','تاريخ الإضافة']):empty('قاعدة الزبائن فارغة','أضف زبائنك لتسهيل تسجيل المبيعات','♙')}</div>`;}
async function renderExpenses(){const rows=await window.mawja.expenses.list();$('#page-content').innerHTML=`${heading('المصروفات','سجّل المصروفات التشغيلية وراجعها.',`<button class="btn btn-primary" data-action="new-expense">＋ إضافة مصروف</button>`)}<div class="panel">${rows.length?table(rows.map(e=>`<tr><td><strong>${esc(e.title)}</strong></td><td class="money">${money(e.amount)}</td><td>${esc(e.note||'—')}</td><td>${dateText(e.created_at)}</td></tr>`).join(''),['المصروف','القيمة','ملاحظات','التاريخ']):empty('لا توجد مصروفات','استخدم زر إضافة مصروف لتسجيل عملية جديدة','↗')}</div>`;}
async function renderReports(){const period=$('#report-period')?.value||'month',r=await window.mawja.reports(period);$('#page-content').innerHTML=`${heading('التقارير المالية','ملخص المبيعات والمدفوعات والمبالغ المتبقية.',`<select id="report-period" style="width:150px"><option value="today" ${period==='today'?'selected':''}>اليوم</option><option value="month" ${period==='month'?'selected':''}>هذا الشهر</option><option value="all" ${period==='all'?'selected':''}>كل الفترات</option></select>`)}<div class="report-cards"><div class="report-card"><small>إجمالي المبيعات</small><strong>${money(r.totals.total)}</strong></div><div class="report-card"><small>المبالغ المحصلة</small><strong>${money(r.totals.paid)}</strong></div><div class="report-card"><small>المبالغ المتبقية</small><strong>${money(r.totals.remaining)}</strong></div><div class="report-card"><small>عدد الفواتير</small><strong>${num(r.totals.invoices)}</strong></div><div class="report-card"><small>المصروفات المسجلة</small><strong>${money(r.expenses)}</strong></div><div class="report-card"><small>صافي تقريبي بعد المصروفات</small><strong>${money(Number(r.totals.total)-Number(r.expenses))}</strong></div></div><div class="panel"><div class="panel-head"><div><h3>تفاصيل المبيعات</h3><p>يمكن تصدير البيانات إلى ملف CSV</p></div><button class="btn btn-light" id="export-report">تصدير CSV ↓</button></div>${r.sales.length?table(r.sales.map(s=>`<tr><td>${esc(s.invoice_no)}</td><td>${esc(s.customer_name)}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td><td>${money(s.remaining)}</td><td>${dateText(s.created_at)}</td></tr>`).join(''),['الفاتورة','الزبون','الإجمالي','المدفوع','المتبقي','التاريخ']):empty('لا توجد بيانات في الفترة','جرّب اختيار فترة أخرى','▥')}</div>`;$('#report-period').addEventListener('change',renderReports);$('#export-report').addEventListener('click',()=>exportCsv('تقرير_المبيعات.csv',[['الفاتورة','الزبون','الهاتف','نوع البيع','طريقة الدفع','الإجمالي','المدفوع','المتبقي','التاريخ'],...r.sales.map(s=>[s.invoice_no,s.customer_name,s.customer_phone,s.sale_type,s.payment_method,s.total,s.paid,s.remaining,s.created_at])]));}
async function renderSettings(){const info=await window.mawja.info();$('#page-content').innerHTML=`${heading('النسخ الاحتياطي والإعدادات','حافظ على بيانات نشاطك التجاري واستعدها عند الحاجة.')}<div class="settings-grid"><div class="panel setting-card"><div class="setting-icon">⇩</div><h3>إنشاء نسخة احتياطية</h3><p>احفظ نسخة من قاعدة البيانات في فلاشة أو قرص خارجي. يُنصح بإنشاء نسخة يوميًا.</p><button class="btn btn-primary" data-action="backup">إنشاء نسخة احتياطية</button></div><div class="panel setting-card"><div class="setting-icon">↻</div><h3>استعادة نسخة احتياطية</h3><p>استعادة قاعدة بيانات من ملف سابق. ستُستبدل البيانات الحالية بالنسخة المختارة.</p><button class="btn btn-light" data-action="restore">اختيار نسخة للاستعادة</button></div><div class="panel setting-card"><div class="setting-icon">◉</div><h3>معلومات المنظومة</h3><p>تطبيق سطح مكتب يعمل محليًا، ولا يحتاج إلى حساب سحابي أو اتصال دائم بالإنترنت.</p><span class="badge">الإصدار ${esc(info.version)}</span></div><div class="panel setting-card"><div class="setting-icon">▤</div><h3>قاعدة البيانات</h3><p>قاعدة SQLite محلية. لا تشارك ملف قاعدة البيانات مع أشخاص غير موثوقين.</p><div style="font-size:10px;word-break:break-all;color:#53617a;direction:ltr;text-align:left">${esc(info.dbPath)}</div></div></div><div class="notice">تنبيه: احتفظ بنسخك الاحتياطية في مكان آمن. الاستعادة تستبدل البيانات الموجودة حاليًا.</div>`;}
async function renderAccounts(){
 const users=await window.mawja.accounts.list();
 const rows=users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td>${u.role==='admin'?'مدير':'موظف'}</td><td><span class="account-status ${u.active?'active':'inactive'}">${u.active?'نشط':'موقوف'}</span></td><td>${esc(u.created_at||'—')}</td><td>${Number(u.id)===Number(currentUser.id)?'الحساب الحالي':`<button class="btn btn-light btn-small" data-toggle-account="${u.id}">${u.active?'إيقاف':'تفعيل'}</button>`}</td></tr>`).join('');
 $('#page-content').innerHTML=`${heading('حسابات المستخدمين','أنشئ حسابات منفصلة للموظفين وتحكم في تفعيلها.')}<div class="panel"><div class="panel-head"><div><h3>إضافة حساب جديد</h3><p>كلمة المرور لا تقل عن 8 أحرف.</p></div></div><form id="account-form" class="account-form"><label>الاسم الكامل<input name="full_name" required minlength="2"></label><label>اسم المستخدم<input name="username" required minlength="3" pattern="[A-Za-z0-9_.-]{3,32}" title="استخدم أحرفًا إنجليزية وأرقامًا و . _ -"></label><label>كلمة المرور<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label>الصلاحية<select name="role"><option value="employee">موظف</option><option value="admin">مدير</option></select></label><button class="btn btn-primary" type="submit">إنشاء الحساب</button></form></div><div class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>الحسابات المسجلة</h3><p>${num(users.length)} حساب</p></div></div>${table(rows,['الاسم','اسم المستخدم','الصلاحية','الحالة','تاريخ الإنشاء','الإجراء'])}</div>`;
 $('#account-form').addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));try{await window.mawja.accounts.create(data);toast('تم إنشاء الحساب بنجاح');renderAccounts();}catch(err){toast(err.message||'تعذر إنشاء الحساب',true);}});
}

function showAuth(setup=false){
 const screen=$('#auth-screen');screen.hidden=false;
 $('#auth-title').textContent=setup?'إنشاء حساب المدير':'تسجيل الدخول';
 $('#auth-description').textContent=setup?'هذه أول مرة تشغّل فيها المنظومة. أنشئ حساب المدير للبدء.':'أدخل اسم المستخدم وكلمة المرور للمتابعة.';
 $('#auth-fullname-wrap').hidden=!setup;$('#auth-confirm-wrap').hidden=!setup;
 $('#auth-fullname').required=setup;$('#auth-confirm').required=setup;
 $('#auth-password').autocomplete=setup?'new-password':'current-password';
 $('#auth-submit').textContent=setup?'إنشاء الحساب والدخول':'دخول';
 $('#auth-error').textContent='';
 $('#auth-form').dataset.mode=setup?'setup':'login';
}
function updateUserUI(){
 $('#auth-screen').hidden=true;
 $('#current-user-name').textContent=currentUser?.full_name||'المستخدم';
 $('#current-user-role').textContent=currentUser?.role==='admin'?'مدير المنظومة':'موظف';
 $('#current-avatar').textContent=(currentUser?.full_name||'م').trim().slice(0,1);
 $('#accounts-nav').hidden=currentUser?.role!=='admin';
}
async function initAuth(){
 try{const state=await window.mawja.auth.status();if(state.user){currentUser=state.user;updateUserUI();setPage('dashboard');}else showAuth(state.setupRequired);}
 catch(e){showAuth(false);$('#auth-error').textContent=e.message||'تعذر فحص الحسابات';}
}
$('#auth-form').addEventListener('submit',async e=>{
 e.preventDefault();const f=e.currentTarget,mode=f.dataset.mode;
 const full_name=$('#auth-fullname').value.trim(),username=$('#auth-username').value.trim(),password=$('#auth-password').value;
 $('#auth-error').textContent='';$('#auth-submit').disabled=true;
 try{
  let result;
  if(mode==='setup'){
   if(password!==$('#auth-confirm').value)throw new Error('كلمتا المرور غير متطابقتين');
   result=await window.mawja.auth.setup({full_name,username,password});
  }else result=await window.mawja.auth.login({username,password});
  currentUser=result.user;updateUserUI();setPage('dashboard');f.reset();
 }catch(err){$('#auth-error').textContent=err.message||'تعذر تسجيل الدخول';}
 finally{$('#auth-submit').disabled=false;}
});
$('#logout-button').addEventListener('click',async()=>{try{await window.mawja.auth.logout();currentUser=null;$('#page-content').innerHTML='';showAuth(false);$('#auth-form').reset();}catch(e){toast(e.message,true);}});

function debounce(fn,wait){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait);};}
function openSale(){saleItems=[];$('#sale-form').reset();$('#sale-form').elements.paid.value=0;$('#sale-total').textContent=money(0);fillSaleProducts().then(()=>{renderSaleItems();$('#sale-dialog').showModal();setTimeout(()=>$('#sale-barcode-input')?.focus(),100);});}
async function fillSaleProducts(){productsCache=await window.mawja.products.list('');const sel=$('#sale-product-select');sel.innerHTML=productsCache.filter(p=>p.quantity>0).map(p=>`<option value="${p.id}">${esc(p.name)} — ${money(p.sell_price)} (المتاح ${p.quantity})</option>`).join('')||'<option value="">لا توجد أصناف متوفرة</option>';}
function addSaleProduct(p,qty){
 if(!p){toast('الباركود غير مسجل في المخزون',true);return false;}
 if(Number(p.quantity)<=0){toast(`الصنف ${p.name} غير متوفر في المخزون`,true);return false;}
 qty=Math.max(1,parseInt(qty)||1);
 const existing=saleItems.find(i=>Number(i.product_id)===Number(p.id));
 const current=existing?.quantity||0;
 if(current+qty>Number(p.quantity)){toast(`الكمية المتوفرة من ${p.name} هي ${p.quantity}`,true);return false;}
 if(existing)existing.quantity+=qty;else saleItems.push({product_id:p.id,name:p.name,quantity:qty,unit_price:Number(p.sell_price)});
 const sel=$('#sale-product-select');if(sel)sel.value=String(p.id);
 renderSaleItems();toast(`تمت إضافة ${p.name} للفاتورة`);return true;
}
function handleBarcodeScan(){
 const input=$('#sale-barcode-input');
 const code=String(input?.value||'').trim();
 if(!code)return;
 const p=productsCache.find(x=>String(x.barcode||'').trim()===code);
 const qty=Math.max(1,parseInt($('#sale-qty')?.value)||1);
 const added=addSaleProduct(p,qty);
 input.value='';input.focus();
 if(added)$('#sale-qty').value='1';
}
function renderSaleItems(){const body=$('#sale-items-body');body.innerHTML=saleItems.length?saleItems.map((it,i)=>`<tr><td>${esc(it.name)}</td><td>${num(it.quantity)}</td><td>${money(it.unit_price)}</td><td class="money">${money(it.quantity*it.unit_price)}</td><td><button type="button" class="btn btn-danger btn-small" data-remove-sale-item="${i}">حذف</button></td></tr>`).join(''):`<tr><td colspan="5" class="empty-cell">أضف أصناف الفاتورة</td></tr>`;$('#sale-total').textContent=money(saleItems.reduce((sum,it)=>sum+it.quantity*it.unit_price,0));}
function exportCsv(filename,rows){const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);toast('تم تجهيز ملف CSV');}
async function backup(){try{const r=await window.mawja.backup.create();if(!r.canceled)toast('تم حفظ النسخة الاحتياطية بنجاح');}catch(e){toast(e.message,true);}}
async function restore(){if(!confirm('هل أنت متأكد؟ ستُستبدل قاعدة البيانات الحالية بالنسخة التي تختارها.'))return;try{const r=await window.mawja.backup.restore();if(!r.canceled)toast('جارٍ استعادة النسخة وإعادة تشغيل المنظومة');}catch(e){toast(e.message,true);}}
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-page]');if(nav){setPage(nav.dataset.page);return;}
 const go=e.target.closest('[data-go]');if(go){setPage(go.dataset.go);return;}
 const close=e.target.closest('[data-close]');if(close){$('#'+close.dataset.close).close();return;}
 const act=e.target.closest('[data-action]')?.dataset.action;
 if(act==='new-product')openProduct();if(act==='new-sale')openSale();if(act==='new-return')openReturn();if(act==='new-customer'){$('#customer-form').reset();$('#customer-dialog').showModal();}if(act==='backup')backup();if(act==='restore')restore();
 const edit=e.target.closest('[data-edit-product]');if(edit){const p=productsCache.find(x=>x.id===Number(edit.dataset.editProduct))|| (await window.mawja.products.list('')).find(x=>x.id===Number(edit.dataset.editProduct));if(p)openProduct(p);}
 const del=e.target.closest('[data-delete-product]');if(del&&confirm('هل تريد حذف هذا الصنف؟')){try{await window.mawja.products.delete(Number(del.dataset.deleteProduct));toast('تم حذف الصنف');renderProducts();}catch(err){toast(err.message,true);}}
 const rm=e.target.closest('[data-remove-sale-item]');if(rm){saleItems.splice(Number(rm.dataset.removeSaleItem),1);renderSaleItems();}
 const toggle=e.target.closest('[data-toggle-account]');if(toggle&&confirm('هل تريد تغيير حالة هذا الحساب؟')){try{await window.mawja.accounts.toggle(Number(toggle.dataset.toggleAccount));toast('تم تحديث حالة الحساب');renderAccounts();}catch(err){toast(err.message,true);}}
 const detail=e.target.closest('[data-sale-details]');if(detail){const items=await window.mawja.sales.items(Number(detail.dataset.saleDetails));alert(items.map(i=>`${i.product_name} × ${i.quantity} = ${money(i.line_total)}`).join('\\n')||'لا توجد تفاصيل');}
 if(e.target.closest('#quick-backup'))backup();
});
$('#product-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,p=Object.fromEntries(new FormData(f));p.id=p.id?Number(p.id):null;try{await window.mawja.products.save(p);$('#product-dialog').close();toast('تم حفظ بيانات الصنف');renderPage();}catch(err){toast(err.message,true);}});
$('#customer-form').addEventListener('submit',async e=>{e.preventDefault();const c=Object.fromEntries(new FormData(e.currentTarget));try{await window.mawja.customers.save(c);$('#customer-dialog').close();toast('تمت إضافة الزبون');renderCustomers();}catch(err){toast(err.message,true);}});
$('#add-sale-item').addEventListener('click',()=>{const id=Number($('#sale-product-select').value),p=productsCache.find(x=>x.id===id),qty=Math.max(1,parseInt($('#sale-qty').value)||1);addSaleProduct(p,qty);});
$('#sale-barcode-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();handleBarcodeScan();}});
$('#focus-barcode').addEventListener('click',()=>$('#sale-barcode-input').focus());
$('#load-return-invoice').addEventListener('click',loadReturnInvoice);
$('#return-item-select').addEventListener('change',e=>{const max=Number(e.target.selectedOptions[0]?.dataset.max||1);$('#return-qty').max=max;$('#return-qty').value=1;});
$('#return-form').addEventListener('submit',async e=>{e.preventDefault();const select=$('#return-item-select');if(!select.value){toast('حمّل فاتورة واختر صنفًا قابلًا للإرجاع',true);return;}const qty=Math.max(1,parseInt($('#return-qty').value,10)||1),max=Number(select.selectedOptions[0]?.dataset.max||0);if(qty>max){toast(`الكمية المتاحة للإرجاع هي ${max}`,true);return;}try{const r=await window.mawja.returns.create({sale_item_id:Number(select.value),quantity:qty,reason:$('#return-reason').value});$('#return-dialog').close();toast(`تم تسجيل المردود ${r.return_no} بقيمة ${money(r.total)}`);if(page==='returns')renderReturns();}catch(err){toast(err.message||'تعذر تسجيل المردود',true);}});
$('#sale-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget;if(!saleItems.length){toast('أضف صنفًا واحدًا على الأقل',true);return;}const total=saleItems.reduce((s,i)=>s+i.quantity*i.unit_price,0),paid=Math.max(0,Number(f.elements.paid.value)||0);if(paid>total){toast('المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة',true);return;}try{const r=await window.mawja.sales.create({customer_name:f.elements.customer_name.value.trim()||'زبون نقدي',customer_phone:f.elements.customer_phone.value,sale_type:f.elements.sale_type.value,payment_method:f.elements.payment_method.value,paid,note:f.elements.note.value,items:saleItems});$('#sale-dialog').close();toast(`تم حفظ الفاتورة ${r.invoice_no} بنجاح`);setPage('sales');}catch(err){toast(err.message,true);}});
$('#page-content').addEventListener('click',async e=>{if(e.target.closest('[data-action="new-expense"]')){const title=prompt('اسم المصروف:');if(!title?.trim())return;const amount=prompt('قيمة المصروف بالدينار الليبي:','0');if(amount===null)return;const note=prompt('ملاحظات (اختياري):','')||'';try{await window.mawja.expenses.add({title,amount,note});toast('تم تسجيل المصروف');renderExpenses();}catch(err){toast(err.message,true);}}if(e.target.closest('#export-report')){}});
$('#year').textContent=new Date().getFullYear();$('#today-label').textContent=new Date().toLocaleDateString('ar-LY',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
initAuth();
