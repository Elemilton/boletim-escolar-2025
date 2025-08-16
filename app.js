async function loadText(path){
  const res = await fetch(path); 
  if(!res.ok) throw new Error('Falha ao carregar '+path);
  return await res.text();
}
async function loadYAML(path){ return jsyaml.load(await loadText(path)); }
async function loadCSV(path){
  const text = await loadText(path);
  const parsed = Papa.parse(text, {header:true, skipEmptyLines:true, dynamicTyping:false}); // auto-delimiter
  return {rows: parsed.data, meta: parsed.meta};
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
      td.textContent = row[c.origem_coluna] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function populaFiltros(dados){
  const turmaSel = document.getElementById('filtroTurma');
  const turmas = Array.from(new Set(dados.map(d=>d['S/T']).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  turmas.forEach(t=>{
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    turmaSel.appendChild(opt);
  });
}

function mostrarDetalhe(row){
  const painel = document.getElementById('detalhe');
  const conteudo = document.getElementById('detalheConteudo');
  const camposBase = ['Protagonistas','Matrícula','S/T','Tutoria','Conselho'];
  let html = '<h2>'+ (row['Protagonistas']||'Aluno') +'</h2>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  camposBase.forEach(k=>{ html += '<div><strong>'+k+':</strong><br>'+ (row[k]||'') +'</div>'; });
  html += '</div><hr>';
  const disciplinas = window.schema.estrutura_dados.disciplinas || [];
  disciplinas.forEach(d=>{
    const p = d.prefixo;
    const n1 = row[p+'1'] ?? '', n2 = row[p+'2'] ?? '', n3 = row[p+'3'] ?? '', n4 = row[p+'4'] ?? '';
    const pb = row['P'+p] ?? '', mg = row['MG'+p] ?? '', pre = row['Pre-'+p] ?? '', f = row['F'+p] ?? '';
    const mf = row['MF'+p] ?? '', s = row['S'+p] ?? '';
    if([n1,n2,n3,n4,pb,mg,pre,f,mf,s].some(v => (v!=='' && v!=null))){
      html += `<div style="margin:8px 0"><strong>${d.nome}</strong><br>
        N1:${n1} | N2:${n2} | N3:${n3} | N4:${n4}<br>
        P:${pb} | MG:${mg} | Pré:${pre} | F:${f} | MF:${mf} | Sit:${s}
      </div>`;
    }
  });
  conteudo.innerHTML = html;
  painel.classList.remove('fechado'); painel.classList.add('aberto');
}

function buildColumns(metaHeaders, visao){
  const cols = [
    {nome:'aluno', rotulo:'Aluno', origem_coluna:'Protagonistas'},
    {nome:'matricula', rotulo:'Matrícula', origem_coluna:'Matrícula'},
    {nome:'turma', rotulo:'Turma', origem_coluna:'S/T'},
    {nome:'tutoria', rotulo:'Tutoria', origem_coluna:'Tutoria'},
    {nome:'conselho', rotulo:'Conselho', origem_coluna:'Conselho'}
  ];

  const present = new Set(metaHeaders);
  const disciplinas = window.schema.estrutura_dados.disciplinas || [];
  const pushIfPresent = (origem, rotulo)=>{
    if(present.has(origem)) cols.push({nome: origem, rotulo, origem_coluna: origem});
  };

  disciplinas.forEach(d=>{
    const p = d.prefixo;
    if(visao==='resumo'){
      pushIfPresent('MG'+p, 'MG '+d.sigla);
      pushIfPresent('MF'+p, 'MF '+d.sigla);
      pushIfPresent('S'+p,  'S '+d.sigla);
    } else {
      [p+'1', p+'2', p+'3', p+'4'].forEach((k,i)=> pushIfPresent(k, d.sigla+(i+1)));
      pushIfPresent('P'+p,    'P '+d.sigla);
      pushIfPresent('MG'+p,   'MG '+d.sigla);
      pushIfPresent('Pre-'+p, 'Pré '+d.sigla);
      pushIfPresent('F'+p,    'F '+d.sigla);
      pushIfPresent('MF'+p,   'MF '+d.sigla);
      pushIfPresent('S'+p,    'S '+d.sigla);
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
  const {rows, meta} = await loadCSV('data/medias_exemplo.csv');
  window._allRows = rows;
  window._headers = meta.fields || Object.keys(rows[0]||{});
  populaFiltros(rows);

  const statusEl = document.getElementById('status');
  const visaoSel = document.getElementById('visao');

  const aplicar = ()=>{
    const turma = document.getElementById('filtroTurma').value;
    const cons = document.getElementById('filtroConselho').value;
    const busca = document.getElementById('busca').value.trim();
    const filtrados = window._allRows.filter(d=>
      (!turma || d['S/T']===turma) &&
      (!cons || (d['Conselho']||'').toString().includes(cons)) &&
      filtraBusca(d, busca)
    );
    const cols = buildColumns(window._headers, visaoSel.value);
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
