function stripBOM(s){return (s||'').replace(/^\uFEFF/, '');}
function deaccent(s){return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function normalizeKey(k){
  return deaccent(stripBOM(k)).replace(/\u00A0/g,' ').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
}
function findSep(line){
  const m = (line||'').trim().match(/^sep=(.)/i);
  return m ? m[1] : null;
}

async function loadBinary(path){
  const res = await fetch(path);
  if(!res.ok) throw new Error('Falha ao carregar '+path);
  return await res.arrayBuffer();
}

function decodeWithFallback(buf){
  let text = new TextDecoder('utf-8', {fatal:false}).decode(buf);
  const bad = (text.match(/Ã.|�/g)||[]).length;
  if(bad > 5){
    try { text = new TextDecoder('windows-1252').decode(buf); }
    catch(e){ try { text = new TextDecoder('iso-8859-1').decode(buf); } catch(_){} }
  }
  return text;
}

function sliceFromHeader(text){
  const lines = text.split(/\r?\n/);
  // remove "sep=" se existir na primeira linha
  let start = 0;
  if(findSep(lines[0])) start = 1;
  // encontra a primeira linha que parece ser o cabeçalho real
  const headerIdx = lines.findIndex((ln,i)=> i>=start && /Protagonistas|Matr[ií]cula|Aluno|Nome/i.test(ln));
  return lines.slice(headerIdx >= 0 ? headerIdx : start).join('\n');
}

function tryParse(text, delimiter){
  return Papa.parse(text, {header:true, skipEmptyLines:true, delimiter});
}
function chooseBestParse(text){
  const first = text.split(/\r?\n/)[0] || '';
  const sep = findSep(first);
  if(sep) return tryParse(text, sep);

  const cands = [';', ',', '\t', '|'];
  let best = null;
  let bestScore = -1;
  for(const d of cands){
    const r = tryParse(text, d);
    const headers = r.meta.fields || [];
    const headerSet = new Set(headers.map(h => normalizeKey(h)));
    const want = ['protagonistas','aluno','nome','st','serieeturma','serieturma','siturma'];
    const hasId = ['protagonistas','aluno','nome'].some(k=> headerSet.has(k));
    const hasTurma = ['st','serieturma','serieeturma','sturmaserie'].some(k=> headerSet.has(k));
    const score = (hasId?10:0) + (hasTurma?5:0) + headers.length;
    if(score > bestScore){ best = r; bestScore = score; }
  }
  return best;
}

async function loadYAML(path){
  const buf = await loadBinary(path);
  const text = decodeWithFallback(buf);
  return jsyaml.load(text);
}

async function loadCSV(path){
  const buf = await loadBinary(path);
  let text = decodeWithFallback(buf);
  text = sliceFromHeader(text);
  const res = chooseBestParse(text);
  return {rows: res.data, headers: res.meta.fields || Object.keys(res.data[0]||{}), rawFirstLine: text.split(/\r?\n/)[0]};
}

function buildHeaderMap(headers){
  const map = {};
  headers.forEach(h=>{ map[normalizeKey(h)] = h; });
  return map;
}
function resolveHeader(map, expected){
  const n = normalizeKey(expected);
  return map[n] || null;
}
function resolveAny(map, candidates){
  for(const c of candidates){
    const r = resolveHeader(map, c);
    if(r) return r;
  }
  // fallback: substring match
  const nCands = candidates.map(c=>normalizeKey(c));
  for(const key in map){
    if(nCands.some(nc => key.includes(nc))) return map[key];
  }
  return null;
}

function filtraBusca(row, termo){
  if(!termo) return true;
  const t = termo.toLowerCase();
  return Object.values(row).some(v => (v||'').toString().toLowerCase().includes(t));
}

function criaHead(colunas){
  const thead = document.getElementById('thead');
  thead.innerHTML = '';
  const tr = document.createElement('tr');
  colunas.forEach(c=>{
    const th = document.createElement('th');
    th.textContent = c.rotulo;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

function preencheTabela(dados, colunas){
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  dados.forEach(row=>{
    const tr = document.createElement('tr');
    tr.addEventListener('click', ()=>mostrarDetalhe(row));
    colunas.forEach(c=>{
      const td = document.createElement('td');
      td.textContent = row[c.key] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function populaFiltros(dados, headerMap){
  const turmaKey = resolveAny(headerMap, ['S/T','ST','Serie/Turma','Série/Turma','Série - Turma']);
  const turmaSel = document.getElementById('filtroTurma');
  const turmas = Array.from(new Set(dados.map(d=>d[turmaKey]).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  turmas.forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    turmaSel.appendChild(opt);
  });
}

function mostrarDetalhe(row){
  const painel = document.getElementById('detalhe');
  const conteudo = document.getElementById('detalheConteudo');
  const hm = window.headerMap;

  const alunoKey = resolveAny(hm, ['Protagonistas','Aluno','Nome']);
  const matriculaKey = resolveAny(hm, ['Matrícula','Matricula','RA']);
  const turmaKey = resolveAny(hm, ['S/T','ST','Serie/Turma','Série/Turma','Série - Turma']);
  const tutoriaKey = resolveAny(hm, ['Tutoria','Tutor','Professor']);
  const conselhoKey = resolveAny(hm, ['Conselho','Situacao Geral','Situação Geral']);

  let html = '<h2>'+ (row[alunoKey]||'Aluno') +'</h2>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  [[alunoKey,'Aluno'],[matriculaKey,'Matrícula'],[turmaKey,'Turma'],[tutoriaKey,'Tutoria'],[conselhoKey,'Conselho']].forEach(([k,rot])=>{
    if(k) html += '<div><strong>'+rot+':</strong><br>'+ (row[k]||'') +'</div>';
  });
  html += '</div><hr>';

  const disciplinas = window.schema.estrutura_dados.disciplinas || [];
  function deacc(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  disciplinas.forEach(d=>{
    const p = d.prefixo;
    const pAlt = deacc(p);
    const hmKeys = (arr)=> resolveAny(hm, arr);
    const keys = {
      n1: hmKeys([p+'1', pAlt+'1']),
      n2: hmKeys([p+'2', pAlt+'2']),
      n3: hmKeys([p+'3', pAlt+'3']),
      n4: hmKeys([p+'4', pAlt+'4']),
      pb: hmKeys(['P'+p, 'P'+pAlt, 'P-'+p, 'P-'+pAlt]),
      mg: hmKeys(['MG'+p, 'MG'+pAlt]),
      pre: hmKeys(['Pre-'+p, 'Pre-'+pAlt, 'Pré-'+p, 'Pré-'+pAlt, 'Pre '+p, 'Pre '+pAlt]),
      f: hmKeys(['F'+p, 'F'+pAlt]),
      mf: hmKeys(['MF'+p, 'MF'+pAlt]),
      s: hmKeys(['S'+p, 'S'+pAlt])
    };
    const vals = Object.fromEntries(Object.entries(keys).map(([k, key])=>[k, key ? row[key] : '']));
    if(Object.values(vals).some(v => (v!=='' && v!=null))){
      const line1 = `N1:${vals.n1} | N2:${vals.n2} | N3:${vals.n3} | N4:${vals.n4}`;
      const line2 = `P:${vals.pb} | MG:${vals.mg} | Pré:${vals.pre} | F:${vals.f} | MF:${vals.mf} | Sit:${vals.s}`;
      conteudo.innerHTML += `<div style="margin:8px 0"><strong>${d.nome}</strong><br>${line1}<br>${line2}</div>`;
    }
  });

  painel.classList.remove('fechado'); painel.classList.add('aberto');
}

function buildColumns(headers, visao){
  const hm = window.headerMap;
  const cols = [];
  const alunoKey = resolveAny(hm, ['Protagonistas','Aluno','Nome']);
  const matriculaKey = resolveAny(hm, ['Matrícula','Matricula','RA']);
  const turmaKey = resolveAny(hm, ['S/T','ST','Serie/Turma','Série/Turma','Série - Turma']);
  const tutoriaKey = resolveAny(hm, ['Tutoria','Tutor','Professor']);
  const conselhoKey = resolveAny(hm, ['Conselho','Situacao Geral','Situação Geral']);

  if(alunoKey) cols.push({rotulo:'Aluno', key: alunoKey});
  if(matriculaKey) cols.push({rotulo:'Matrícula', key: matriculaKey});
  if(turmaKey) cols.push({rotulo:'Turma', key: turmaKey});
  if(tutoriaKey) cols.push({rotulo:'Tutoria', key: tutoriaKey});
  if(conselhoKey) cols.push({rotulo:'Conselho', key: conselhoKey});

  const disciplinas = window.schema.estrutura_dados.disciplinas || [];
  function deacc(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  disciplinas.forEach(d=>{
    const p = d.prefixo, pAlt = deacc(p);
    function addCol(cands, rotulo){
      const r = resolveAny(hm, cands);
      if(r) cols.push({rotulo, key:r});
    }
    if(visao==='resumo'){
      addCol(['MG'+p,'MG'+pAlt], 'MG '+d.sigla);
      addCol(['MF'+p,'MF'+pAlt], 'MF '+d.sigla);
      addCol(['S'+p,'S'+pAlt], 'S '+d.sigla);
    }else{
      [['1',''+d.sigla+'1'],['2',''+d.sigla+'2'],['3',''+d.sigla+'3'],['4',''+d.sigla+'4']].forEach(([s,rot])=>{
        addCol([p+s,pAlt+s], rot);
      });
      addCol(['P'+p,'P'+pAlt,'P-'+p,'P-'+pAlt], 'P '+d.sigla);
      addCol(['MG'+p,'MG'+pAlt], 'MG '+d.sigla);
      addCol(['Pre-'+p,'Pre-'+pAlt,'Pré-'+p,'Pré-'+pAlt,'Pre '+p,'Pre '+pAlt], 'Pré '+d.sigla);
      addCol(['F'+p,'F'+pAlt], 'F '+d.sigla);
      addCol(['MF'+p,'MF'+pAlt], 'MF '+d.sigla);
      addCol(['S'+p,'S'+pAlt], 'S '+d.sigla);
    }
  });
  return cols;
}

async function main(){
  try{
    window.schema = await loadYAML('config/schema.yaml');
  }catch(e){
    alert('Erro ao inicializar: Falha ao carregar config/schema.yaml');
    throw e;
  }
  const {rows, headers, rawFirstLine} = await loadCSV('data/medias_exemplo.csv');
  window._allRows = rows;
  window.headerMap = buildHeaderMap(headers);

  console.info('Cabeçalho escolhido:', rawFirstLine);
  console.info('Headers detectados:', headers);

  populaFiltros(rows, window.headerMap);

  const statusEl = document.getElementById('status');
  const visaoSel = document.getElementById('visao');

  const turmaKey = resolveAny(window.headerMap, ['S/T','ST','Serie/Turma','Série/Turma','Série - Turma']);
  const consKey = resolveAny(window.headerMap, ['Conselho','Situacao Geral','Situação Geral']);

  const aplicar = ()=>{
    const turma = document.getElementById('filtroTurma').value;
    const cons = document.getElementById('filtroConselho').value;
    const busca = document.getElementById('busca').value.trim();
    const filtrados = window._allRows.filter(d=>
      (!turma || d[turmaKey]===turma) &&
      (!cons || (d[consKey]||'').toString().includes(cons)) &&
      filtraBusca(d, busca)
    );
    const cols = buildColumns(headers, visaoSel.value);
    criaHead(cols);
    preencheTabela(filtrados, cols);
    statusEl.textContent = `Exibindo ${filtrados.length} de ${window._allRows.length} alunos`;
  };

  ['change','input'].forEach(ev=>{
    document.getElementById('filtroTurma').addEventListener(ev, aplicar);
    document.getElementById('filtroConselho').addEventListener(ev, aplicar);
    document.getElementById('busca').addEventListener(ev, aplicar);
    document.getElementById('visao').addEventListener(ev, aplicar);
  });
  document.getElementById('fechar').addEventListener('click', ()=>{
    const painel = document.getElementById('detalhe');
    painel.classList.remove('aberto'); painel.classList.add('fechado');
  });

  aplicar();
}

main().catch(err=>{ console.error(err); });
