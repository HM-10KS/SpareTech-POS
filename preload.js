const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mawja', {
  auth: { status: () => ipcRenderer.invoke('auth:status'), setup: data => ipcRenderer.invoke('auth:setup', data), login: data => ipcRenderer.invoke('auth:login', data), logout: () => ipcRenderer.invoke('auth:logout') },
  accounts: { list: () => ipcRenderer.invoke('accounts:list'), create: data => ipcRenderer.invoke('accounts:create', data), toggle: id => ipcRenderer.invoke('accounts:toggle', id) },
  dashboard: () => ipcRenderer.invoke('dashboard:get'),
  products: {
    list: q => ipcRenderer.invoke('products:list',q),
    save: p => ipcRenderer.invoke('products:save',p),
    delete: id => ipcRenderer.invoke('products:delete',id)
  },
  customers: { list: () => ipcRenderer.invoke('customers:list'), save: c => ipcRenderer.invoke('customers:save',c) },
  sales: {
    create: s => ipcRenderer.invoke('sales:create',s),
    list: q => ipcRenderer.invoke('sales:list',q),
    items: id => ipcRenderer.invoke('sales:items',id)
  },
  returns: {
    list: () => ipcRenderer.invoke('returns:list'),
    invoiceItems: invoiceNo => ipcRenderer.invoke('returns:invoice-items', invoiceNo),
    create: data => ipcRenderer.invoke('returns:create', data)
  },
  expenses: { list: () => ipcRenderer.invoke('expenses:list'), add: e => ipcRenderer.invoke('expenses:add',e) },
  reports: period => ipcRenderer.invoke('reports:get',period),
  backup: { create: () => ipcRenderer.invoke('backup:create'), restore: () => ipcRenderer.invoke('backup:restore') },
  info: () => ipcRenderer.invoke('app:info')
});
