/* 同路人管理员后台 SPA 逻辑（原生 JS，无框架） */
const API = '/api/admin';
const AUTH_KEY = 'carpool_admin_token';
const NAME_KEY = 'carpool_admin_name';

let token = localStorage.getItem(AUTH_KEY) || '';
let currentPage = 'dashboard';

// ---------- 工具 ----------
function fmtTime(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { headers, ...opts });
  if (res.status === 401) {
    toast('登录已失效，请重新登录');
    logout();
    throw new Error('unauthorized');
  }
  const data = await res.json();
  if (data.code && data.code !== 0) {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}

async function apiRaw(path, opts = {}) {
  const headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(API + path, { headers, ...opts });
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- 登录 ----------
function showLogin() {
  document.getElementById('loginMask').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('loginMask').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('adminName').textContent = localStorage.getItem(NAME_KEY) || '管理员';
}

function logout() {
  token = '';
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(NAME_KEY);
  showLogin();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginErr');
  err.textContent = '';
  try {
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    token = data.token;
    localStorage.setItem(AUTH_KEY, token);
    localStorage.setItem(NAME_KEY, data.name);
    toast('登录成功');
    showApp();
    switchPage('dashboard');
  } catch (ex) {
    err.textContent = ex.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', logout);

// ---------- 导航 ----------
const PAGE_TITLES = {
  dashboard: '数据看板', reports: '举报中心', users: '用户管理',
  trips: '行程管理', reviews: '评价查看', stations: '站点管理',
  announcements: '公告管理', logs: '操作日志',
};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchPage(item.dataset.page));
});

document.getElementById('refreshBtn').addEventListener('click', () => renderPage(currentPage));

async function switchPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[page] || '';
  document.getElementById('content').innerHTML = '<p class="empty">加载中…</p>';
  await renderPage(page);
  // 更新举报角标
  if (page === 'reports') updateReportBadge();
}

async function updateReportBadge() {
  try {
    const stats = await api('/stats');
    const badge = document.getElementById('reportBadge');
    if (stats.pendingReports > 0) {
      badge.textContent = stats.pendingReports > 99 ? '99+' : stats.pendingReports;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } catch {}
}

// ---------- 各页面渲染 ----------
async function renderPage(page) {
  switch (page) {
    case 'dashboard': return renderDashboard();
    case 'reports': return renderReports();
    case 'users': return renderUsers();
    case 'trips': return renderTrips();
    case 'reviews': return renderReviews();
    case 'stations': return renderStations();
    case 'announcements': return renderAnnouncements();
    case 'logs': return renderLogs();
  }
}

// ====== 看板 ======
async function renderDashboard() {
  const s = await api('/stats');
  const html = `
    <div class="cards">
      <div class="card"><div class="card-label">今日新增用户</div><div class="card-value">${s.todayNewUsers}</div></div>
      <div class="card green"><div class="card-label">正在进行拼车</div><div class="card-value">${s.activeRides}</div></div>
      <div class="card red"><div class="card-label">待处理举报</div><div class="card-value">${s.pendingReports}</div></div>
      <div class="card purple"><div class="card-label">总用户数</div><div class="card-value">${s.totalUsers}</div></div>
      <div class="card yellow"><div class="card-label">今日完成拼车</div><div class="card-value">${s.todayCompleted}</div></div>
      <div class="card orange"><div class="card-label">累计举报数</div><div class="card-value">${s.totalReports}</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-toolbar"><strong>快捷入口</strong><div class="spacer"></div></div>
      <table>
        <tr><td style="padding:16px">
          <button class="btn-primary btn-sm" onclick="switchPage('reports')">处理待办举报 (${s.pendingReports})</button>
          <button class="btn-ghost btn-sm" onclick="switchPage('users')" style="margin-left:8px">查看用户列表</button>
          <button class="btn-ghost btn-sm" onclick="switchPage('trips')" style="margin-left:8px">查看进行中行程</button>
        </td></tr>
      </table>
    </div>`;
  document.getElementById('content').innerHTML = html;
}

// ====== 举报中心 ======
let reportFilter = 'all';
async function renderReports() {
  const list = await api('/reports?status=' + reportFilter);
  const tags = { pending: 'tag-blue', handled: 'tag-green', rejected: 'tag-gray' };
  const statusText = { pending: '待处理', handled: '已处理', rejected: '已驳回' };
  const rows = list.length === 0 ? `<tr><td colspan="7" class="empty">暂无举报</td></tr>` :
    list.map(r => `
      <tr>
        <td>${fmtTime(r.createTime)}</td>
        <td>${r.reporterName || r.reporterOpenid}</td>
        <td>${r.reportedName || r.reportedOpenid}</td>
        <td>${r.reason}</td>
        <td>${(r.images || []).map(img => `<img class="thumb" src="${img}" onclick="viewImg('${img}')" alt="" />`).join('')}</td>
        <td><span class="tag ${tags[r.status]}">${statusText[r.status]}</span></td>
        <td>
          <button class="action-btn ghost" onclick="viewReport('${r.id}')">详情</button>
          ${r.status === 'pending' ? `<button class="action-btn primary" onclick="handleReport('${r.id}')">处理</button>` : ''}
        </td>
      </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <select id="reportStatusFilter">
          <option value="all" ${reportFilter==='all'?'selected':''}>全部状态</option>
          <option value="pending" ${reportFilter==='pending'?'selected':''}>待处理</option>
          <option value="handled" ${reportFilter==='handled'?'selected':''}>已处理</option>
          <option value="rejected" ${reportFilter==='rejected'?'selected':''}>已驳回</option>
        </select>
        <div class="spacer"></div>
        <button class="btn-ghost" onclick="exportCsv('reports')"><i class="fa fa-download"></i> 导出CSV</button>
      </div>
      <table>
        <thead><tr><th>举报时间</th><th>举报人</th><th>被举报人</th><th>原因</th><th>证据截图</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  document.getElementById('reportStatusFilter').addEventListener('change', e => {
    reportFilter = e.target.value; renderReports();
  });
}

function viewImg(src) {
  document.getElementById('imgViewerImg').src = src;
  document.getElementById('imgViewer').classList.remove('hidden');
}
document.querySelector('.img-viewer-close').addEventListener('click', () => {
  document.getElementById('imgViewer').classList.add('hidden');
});
document.getElementById('imgViewer').addEventListener('click', e => {
  if (e.target.id === 'imgViewer') document.getElementById('imgViewer').classList.add('hidden');
});

async function viewReport(id) {
  const list = await api('/reports');
  const r = list.find(x => x.id === id);
  if (!r) return;
  openModal('举报详情', `
    <div class="field"><label>举报时间</label><div>${fmtTime(r.createTime)}</div></div>
    <div class="field"><label>举报人</label><div>${r.reporterName} (${r.reporterOpenid})</div></div>
    <div class="field"><label>被举报人</label><div>${r.reportedName} (${r.reportedOpenid})</div></div>
    <div class="field"><label>举报原因</label><div>${r.reason}</div></div>
    <div class="field"><label>情况描述</label><div style="white-space:pre-wrap">${r.description || '（无）'}</div></div>
    <div class="field"><label>证据截图</label><div class="evidence-row">${(r.images||[]).map(i => `<img class="thumb" src="${i}" onclick="viewImg('${i}')" alt="" />`).join('') || '（无）'}</div></div>
    <div class="field"><label>管理员备注</label><div>${r.adminNote || '（暂无）'}</div></div>
  `, [{ text: '关闭', cls: 'btn-ghost', onclick: closeModal }]);
}

function handleReport(id) {
  openModal('处理举报', `
    <div class="field">
      <label>处置方式</label>
      <select id="rpAction">
        <option value="handle">仅标记已处理</option>
        <option value="reject">驳回举报</option>
        <option value="punish">处罚被举报人</option>
      </select>
    </div>
    <div id="punishBox" class="hidden">
      <div class="field">
        <label>处罚类型</label>
        <select id="rpPunish">
          <option value="credit">扣信用分</option>
          <option value="freeze">冻结账号</option>
          <option value="delete">注销账号</option>
        </select>
      </div>
      <div id="creditBox" class="field">
        <label>扣分数值（正数表示扣分）</label>
        <input id="rpDelta" type="number" value="5" />
      </div>
      <div id="freezeBox" class="field hidden">
        <label>冻结天数</label>
        <input id="rpDays" type="number" value="30" />
      </div>
    </div>
    <div class="field">
      <label>处置备注</label>
      <textarea id="rpNote" placeholder="填写处理结果，将记录在案"></textarea>
    </div>
  `, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '确认提交', cls: 'btn-primary', onclick: () => submitHandle(id) },
  ]);
  document.getElementById('rpAction').addEventListener('change', e => {
    document.getElementById('punishBox').classList.toggle('hidden', e.target.value !== 'punish');
  });
  document.getElementById('rpPunish').addEventListener('change', e => {
    document.getElementById('creditBox').classList.toggle('hidden', e.target.value !== 'credit');
    document.getElementById('freezeBox').classList.toggle('hidden', e.target.value !== 'freeze');
  });
}

async function submitHandle(id) {
  const action = document.getElementById('rpAction').value;
  const body = { action, note: document.getElementById('rpNote').value.trim() };
  if (action === 'punish') {
    body.punishType = document.getElementById('rpPunish').value;
    if (body.punishType === 'credit') {
      const d = parseInt(document.getElementById('rpDelta').value) || 0;
      body.creditDelta = -Math.abs(d); // 扣分转负数
    } else if (body.punishType === 'freeze') {
      body.freezeDays = parseInt(document.getElementById('rpDays').value) || 30;
    }
  }
  try {
    await api('/reports/' + id + '/handle', { method: 'POST', body: JSON.stringify(body) });
    toast('处置已提交');
    closeModal();
    renderReports();
    updateReportBadge();
  } catch (ex) { toast(ex.message); }
}

// ====== 用户管理 ======
let userKw = '', userStatus = 'all', userSort = 'credit_desc';
async function renderUsers() {
  const list = await api(`/users?keyword=${encodeURIComponent(userKw)}&status=${userStatus}&sort=${userSort}`);
  const statusTag = { normal: 'tag-green', warned: 'tag-orange', frozen: 'tag-red', deleted: 'tag-gray' };
  const statusText = { normal: '正常', warned: '警告', frozen: '冻结', deleted: '已注销' };
  const rows = list.length === 0 ? `<tr><td colspan="8" class="empty">暂无用户</td></tr>` :
    list.filter(u => !u.isBot).map(u => {
      const sc = u.creditScore;
      const scoreCls = sc >= 85 ? 'score-high' : sc >= 75 ? 'score-mid' : 'score-low';
      return `<tr>
        <td><img class="avatar" src="${u.avatar || ''}" alt="" />${u.realName || u.nickName || '-'}</td>
        <td>${u.school || '-'}</td>
        <td class="${scoreCls}">${sc}</td>
        <td><span class="tag ${statusTag[u.status]}">${statusText[u.status]}</span></td>
        <td>${u.finishedCount}</td>
        <td>${fmtTime(u.createTime)}</td>
        <td>
          <button class="action-btn ghost" onclick="adjustCredit('${u.openid}', ${sc})">调信用分</button>
          ${u.status === 'frozen'
            ? `<button class="action-btn primary" onclick="unfreezeUser('${u.openid}')">解冻</button>`
            : u.status === 'deleted'
            ? `<button class="action-btn primary" onclick="restoreUser('${u.openid}')">解封</button>`
            : `<button class="action-btn primary" onclick="freezeUser('${u.openid}')">冻结</button>`}
          ${u.status !== 'deleted' ? `<button class="action-btn danger" onclick="confirmDeleteUser('${u.openid}')">注销</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <input id="userKw" placeholder="搜索姓名/学校" value="${userKw}" />
        <select id="userStatus">
          <option value="all" ${userStatus==='all'?'selected':''}>全部状态</option>
          <option value="normal" ${userStatus==='normal'?'selected':''}>正常</option>
          <option value="warned" ${userStatus==='warned'?'selected':''}>警告</option>
          <option value="frozen" ${userStatus==='frozen'?'selected':''}>冻结</option>
          <option value="deleted" ${userStatus==='deleted'?'selected':''}>已注销</option>
        </select>
        <select id="userSort">
          <option value="credit_desc" ${userSort==='credit_desc'?'selected':''}>信用分↓</option>
          <option value="credit_asc" ${userSort==='credit_asc'?'selected':''}>信用分↑</option>
          <option value="finished_desc" ${userSort==='finished_desc'?'selected':''}>完成次数↓</option>
          <option value="created_desc" ${userSort==='created_desc'?'selected':''}>注册时间↓</option>
        </select>
        <div class="spacer"></div>
        <button class="btn-ghost" onclick="exportCsv('users')"><i class="fa fa-download"></i> 导出CSV</button>
      </div>
      <table>
        <thead><tr><th>用户</th><th>学校</th><th>信用分</th><th>状态</th><th>完成次数</th><th>注册时间</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  document.getElementById('userKw').addEventListener('input', e => { userKw = e.target.value; });
  document.getElementById('userKw').addEventListener('change', renderUsers);
  document.getElementById('userStatus').addEventListener('change', e => { userStatus = e.target.value; renderUsers(); });
  document.getElementById('userSort').addEventListener('change', e => { userSort = e.target.value; renderUsers(); });
}

function adjustCredit(openid, cur) {
  openModal('调整信用分', `
    <div class="field"><label>当前信用分</label><div>${cur}</div></div>
    <div class="field"><label>增减值（正数加分，负数扣分）</label>
      <input id="adjDelta" type="number" value="-5" /></div>
  `, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '确认', cls: 'btn-primary', onclick: async () => {
      try {
        await api('/users/' + openid + '/adjust-credit', { method: 'POST', body: JSON.stringify({ delta: parseInt(document.getElementById('adjDelta').value) }) });
        toast('已更新'); closeModal(); renderUsers();
      } catch (ex) { toast(ex.message); }
    }},
  ]);
}

function freezeUser(openid) {
  openModal('冻结账号', `
    <div class="field"><label>冻结天数</label><input id="fzDays" type="number" value="30" /></div>
  `, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '确认冻结', cls: 'btn-danger', onclick: async () => {
      try {
        await api('/users/' + openid + '/freeze', { method: 'POST', body: JSON.stringify({ days: parseInt(document.getElementById('fzDays').value) }) });
        toast('已冻结'); closeModal(); renderUsers();
      } catch (ex) { toast(ex.message); }
    }},
  ]);
}

async function unfreezeUser(openid) {
  try { await api('/users/' + openid + '/unfreeze', { method: 'POST' }); toast('已解冻'); renderUsers(); }
  catch (ex) { toast(ex.message); }
}

async function restoreUser(openid) {
  try { await api('/users/' + openid + '/restore', { method: 'POST' }); toast('已解封'); renderUsers(); }
  catch (ex) { toast(ex.message); }
}

function confirmDeleteUser(openid) {
  openModal('注销账号', `<p>确定要注销该账号吗？注销后该用户将无法登录。</p>`, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '确认注销', cls: 'btn-danger', onclick: async () => {
      try { await api('/users/' + openid + '/delete', { method: 'POST' }); toast('已注销'); closeModal(); renderUsers(); }
      catch (ex) { toast(ex.message); }
    }},
  ]);
}

// ====== 行程管理 ======
async function renderTrips() {
  const list = await api('/trips');
  const statusTag = { active: 'tag-blue', completed: 'tag-green', canceled: 'tag-gray' };
  const statusText = { active: '进行中', completed: '已完成', canceled: '已取消' };
  const dirText = { metro2school: '地铁→学校', school2metro: '学校→地铁' };
  const rows = list.length === 0 ? `<tr><td colspan="7" class="empty">暂无行程</td></tr>` :
    list.map(g => `<tr>
      <td>${g.id.slice(-8)}</td>
      <td>${dirText[g.direction] || g.direction}</td>
      <td>${g.stationName} ${g.exitName ? '/' + g.exitName : ''}</td>
      <td>${(g.members||[]).length}/${g.targetSize}</td>
      <td><span class="tag ${statusTag[g.status]}">${statusText[g.status]}</span></td>
      <td>${fmtTime(g.createTime)}</td>
      <td>${g.completedAt ? fmtTime(g.completedAt) : g.canceledAt ? fmtTime(g.canceledAt) : '-'}</td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>编号</th><th>方向</th><th>站点/出口</th><th>人数</th><th>状态</th><th>创建时间</th><th>完成/取消时间</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ====== 评价查看 ======
async function renderReviews() {
  const list = await api('/reviews');
  const rows = list.length === 0 ? `<tr><td colspan="6" class="empty">暂无评价</td></tr>` :
    list.map(r => `<tr>
      <td>${r.fromName}</td>
      <td>${r.toName}</td>
      <td>${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</td>
      <td>${(r.tags||[]).join('、')}</td>
      <td>${r.comment || '-'}</td>
      <td>${fmtTime(r.createTime)}</td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>评价人</th><th>被评价人</th><th>评分</th><th>标签</th><th>评论</th><th>时间</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ====== 站点管理 ======
async function renderStations() {
  const list = await api('/stations');
  const dirText = { metro2school: '地铁→学校', school2metro: '学校→地铁' };
  const typeText = { subway: '地铁站', school: '学校' };
  const rows = list.length === 0 ? `<tr><td colspan="7" class="empty">暂无站点</td></tr>` :
    list.map((s, i) => `<tr>
      <td>${i + 1}</td>
      <td>${dirText[s.direction] || s.direction}</td>
      <td>${s.name}${s.toName ? ' → ' + s.toName : ''}</td>
      <td>${typeText[s.type] || s.type}</td>
      <td>${s.latitude != null ? s.latitude.toFixed(6) : '-'}</td>
      <td>${s.longitude != null ? s.longitude.toFixed(6) : '-'}</td>
      <td>
        <button class="action-btn primary" onclick="editStation('${s.id}')">编辑</button>
        <button class="action-btn danger" onclick="delStation('${s.id}')">删除</button>
      </td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <strong>站点管理</strong><div class="spacer"></div>
        <button class="btn-primary btn-sm" onclick="editStation('')"><i class="fa fa-plus"></i> 新增站点</button>
      </div>
      <table>
        <thead><tr><th>序号</th><th>方向</th><th>名称</th><th>类型</th><th>纬度</th><th>经度</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function editStation(id) {
  api('/stations').then(list => {
    const s = list.find(x => x.id === id) || { direction: 'metro2school', name: '', toName: '', type: 'subway', latitude: '', longitude: '', exitName: '', sort: list.length + 1 };
    const defaultSort = id ? s.sort : (list.length + 1);
    openModal(id ? '编辑站点' : '新增站点', `
      <div class="field"><label>方向</label>
        <select id="stDir"><option value="metro2school" ${s.direction==='metro2school'?'selected':''}>地铁→学校</option><option value="school2metro" ${s.direction==='school2metro'?'selected':''}>学校→地铁</option></select></div>
      <div class="field"><label>从</label><input id="stName" value="${s.name || ''}" placeholder="出发地，如：昌平西山口站" /></div>
      <div class="field"><label>到</label><input id="stToName" value="${s.toName || ''}" placeholder="目的地，如：北京化工大学" /></div>
      <div class="field"><label>类型</label>
        <select id="stType"><option value="subway" ${s.type==='subway'?'selected':''}>地铁站</option><option value="school" ${s.type==='school'?'selected':''}>学校</option></select></div>
      <div class="field"><label>纬度（GCJ02 火星坐标）</label><input id="stLat" type="number" step="0.000001" value="${s.latitude != null ? s.latitude : ''}" placeholder="如：40.244810" /></div>
      <div class="field"><label>经度（GCJ02 火星坐标）</label><input id="stLng" type="number" step="0.000001" value="${s.longitude != null ? s.longitude : ''}" placeholder="如：116.193813" /></div>
      <div class="field"><label>序号（排序，越小越靠前）</label><input id="stSort" type="number" value="${defaultSort}" /></div>
    `, [
      { text: '取消', cls: 'btn-ghost', onclick: closeModal },
      { text: '保存', cls: 'btn-primary', onclick: async () => {
        try {
          const lat = document.getElementById('stLat').value;
          const lng = document.getElementById('stLng').value;
          const fromName = document.getElementById('stName').value.trim();
          const toName = document.getElementById('stToName').value.trim();
          if (!fromName) { toast('请填写出发地'); return; }
          if (!lat || !lng) { toast('请填写纬度和经度'); return; }
          await api('/stations/save', { method: 'POST', body: JSON.stringify({
            id, direction: document.getElementById('stDir').value,
            name: fromName, toName, type: document.getElementById('stType').value,
            latitude: parseFloat(lat), longitude: parseFloat(lng),
            sort: parseInt(document.getElementById('stSort').value) || 1,
          })});
          toast('已保存'); closeModal(); renderStations();
        } catch (ex) { toast(ex.message); }
      }},
    ]);
  });
}

function delStation(id) {
  openModal('删除站点', `<p>确定删除该站点吗？</p>`, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '删除', cls: 'btn-danger', onclick: async () => {
      try { await api('/stations/' + id + '/delete', { method: 'POST' }); toast('已删除'); closeModal(); renderStations(); }
      catch (ex) { toast(ex.message); }
    }},
  ]);
}

// ====== 公告管理 ======
async function renderAnnouncements() {
  const list = await api('/announcements');
  const rows = list.length === 0 ? `<tr><td colspan="4" class="empty">暂无公告</td></tr>` :
    list.map(a => `<tr>
      <td>${a.title}</td>
      <td style="max-width:400px">${a.content}</td>
      <td>${a.sort}</td>
      <td>
        <button class="action-btn primary" onclick="editAnn('${a.id}')">编辑</button>
        <button class="action-btn danger" onclick="delAnn('${a.id}')">删除</button>
      </td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <div class="table-toolbar">
        <strong>公告管理</strong><div class="spacer"></div>
        <button class="btn-primary btn-sm" onclick="editAnn('')"><i class="fa fa-plus"></i> 新增公告</button>
      </div>
      <table>
        <thead><tr><th>标题</th><th>内容</th><th>排序</th><th>操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function editAnn(id) {
  api('/announcements').then(list => {
    const a = list.find(x => x.id === id) || { title: '', content: '', sort: 0 };
    openModal(id ? '编辑公告' : '新增公告', `
      <div class="field"><label>标题</label><input id="anTitle" value="${a.title}" /></div>
      <div class="field"><label>内容</label><textarea id="anContent">${a.content}</textarea></div>
      <div class="field"><label>排序</label><input id="anSort" type="number" value="${a.sort}" /></div>
    `, [
      { text: '取消', cls: 'btn-ghost', onclick: closeModal },
      { text: '保存', cls: 'btn-primary', onclick: async () => {
        try {
          await api('/announcements/save', { method: 'POST', body: JSON.stringify({
            id, title: document.getElementById('anTitle').value,
            content: document.getElementById('anContent').value,
            sort: parseInt(document.getElementById('anSort').value) || 0,
          })});
          toast('已保存'); closeModal(); renderAnnouncements();
        } catch (ex) { toast(ex.message); }
      }},
    ]);
  });
}

function delAnn(id) {
  openModal('删除公告', `<p>确定删除该公告吗？</p>`, [
    { text: '取消', cls: 'btn-ghost', onclick: closeModal },
    { text: '删除', cls: 'btn-danger', onclick: async () => {
      try { await api('/announcements/' + id + '/delete', { method: 'POST' }); toast('已删除'); closeModal(); renderAnnouncements(); }
      catch (ex) { toast(ex.message); }
    }},
  ]);
}

// ====== 操作日志 ======
async function renderLogs() {
  const list = await api('/logs');
  const rows = list.length === 0 ? `<tr><td colspan="5" class="empty">暂无操作记录</td></tr>` :
    list.map(l => `<tr>
      <td>${fmtTime(l.createTime)}</td>
      <td>${l.adminName}</td>
      <td>${l.action}</td>
      <td>${l.target}</td>
      <td>${l.detail || '-'}</td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>时间</th><th>管理员</th><th>动作</th><th>对象</th><th>详情</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ====== 导出 ======
function exportCsv(kind) {
  const a = document.createElement('a');
  a.href = API + '/export/' + kind + '?t=' + Date.now();
  a.style.display = 'none';
  document.body.appendChild(a);
  // 携带 token：改用 fetch 下载
  apiRaw('/export/' + kind).then(res => res.blob()).then(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = kind + '.csv';
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  });
  a.remove();
}

// ---------- 模态框 ----------
function openModal(title, bodyHtml, buttons) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const foot = document.getElementById('modalFoot');
  foot.innerHTML = '';
  (buttons || []).forEach(b => {
    const btn = document.createElement('button');
    btn.className = b.cls || 'btn-ghost';
    btn.textContent = b.text;
    btn.addEventListener('click', b.onclick);
    foot.appendChild(btn);
  });
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
document.querySelector('.modal-mask').addEventListener('click', closeModal);

// ---------- 启动 ----------
if (token) {
  // 校验 token 是否仍有效
  api('/me').then(() => { showApp(); switchPage('dashboard'); updateReportBadge(); }).catch(logout);
} else {
  showLogin();
}

// 暴露给内联 onclick
window.switchPage = switchPage;
window.viewImg = viewImg;
window.viewReport = viewReport;
window.handleReport = handleReport;
window.adjustCredit = adjustCredit;
window.freezeUser = freezeUser;
window.unfreezeUser = unfreezeUser;
window.restoreUser = restoreUser;
window.confirmDeleteUser = confirmDeleteUser;
window.editStation = editStation;
window.delStation = delStation;
window.editAnn = editAnn;
window.delAnn = delAnn;
window.exportCsv = exportCsv;
