async function loadText(path){
  const res = await fetch(path); if(!res.ok) throw new Error('Falha ao carregar '+path);
  return await res.text();
}
async function loadYAML(path){ return jsyaml.load(await loadText(path)); }
async function loadCSV(path){
  const text = await loadText(path);
  const parsed = Papa.parse(text, {header:true, skipEmptyLines:true});
  return parsed.data;
}

function filtraBusca(aluno, termo){
  if(!termo) return true;
  const t = termo.toLowerCase();
  return Object.values(aluno).some(v => (v||'').toString().toLowerCase().includes(t));
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
  dados.forEach((row, idx)=>{
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
  const turmas = Array.from(new Set(dados.map(d=>d['S/T']).filter(Boolean))).sort();
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
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  camposBase.forEach(k=>{
    html += '<div><strong>'+k+':</strong><br>'+ (row[k]||'') +'</div>';
  });
  html += '</div><hr>';
  // Mostra algumas disciplinas resumidas
  const disciplinas = window.schema.estrutura_dados.disciplinas;
  disciplinas.forEach(d=>{
    const p = d.prefixo;
    const mg = row['MG'+p] ?? '';
    const mf = row['MF'+p] ?? '';
    const sit = row['S'+p] ?? '';
    if(mg || mf || sit){
      html += '<div style="margin:8px 0"><strong>'+d.nome+'</strong><br>';
      html += 'MG: '+mg+' | MF: '+mf+' | Situação: '+sit+'</div>';
    }
  });
  conteudo.innerHTML = html;
  painel.classList.remove('fechado'); painel.classList.add('aberto');
}

async function main(){
  window.schema = await loadYAML('config/schema.yaml');
  const dados = await loadCSV('data/medias_exemplo.csv');

  const cols = [
    {nome:'aluno', rotulo:'Aluno', origem_coluna:'Protagonistas'},
    {nome:'matricula', rotulo:'Matrícula', origem_coluna:'Matrícula'},
    {nome:'turma', rotulo:'Turma', origem_coluna:'S/T'},
    {nome:'tutoria', rotulo:'Tutoria', origem_coluna:'Tutoria'},
    {nome:'conselho', rotulo:'Conselho', origem_coluna:'Conselho'}
  ];

  criaHead(cols);
  populaFiltros(dados);

  const aplicar = ()=>{
    const turma = document.getElementById('filtroTurma').value;
    const cons = document.getElementById('filtroConselho').value;
    const busca = document.getElementById('busca').value.trim();
    const filtrados = dados.filter(d=>
      (!turma || d['S/T']===turma) &&
      (!cons || (d['Conselho']||'').includes(cons)) &&
      filtraBusca(d, busca)
    );
    preencheTabela(filtrados, cols);
  };

  document.getElementById('filtroTurma').addEventListener('change', aplicar);
  document.getElementById('filtroConselho').addEventListener('change', aplicar);
  document.getElementById('busca').addEventListener('input', aplicar);
  document.getElementById('fechar').addEventListener('click', ()=>{
    const painel = document.getElementById('detalhe');
    painel.classList.remove('aberto'); painel.classList.add('fechado');
  });

  aplicar();
}

main().catch(err=>{
  console.error(err);
  alert('Erro ao inicializar: '+err.message);
});
