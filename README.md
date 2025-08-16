# Boletim Escolar 2025 — Starter (GitHub Pages)

Este projeto lê **data/medias_exemplo.csv** e **config/schema.yaml** e monta uma interface web:
- Filtros por Turma e Conselho
- Busca textual
- Tabela dinâmica (colunas definidas pelo YAML)
- Visões: **Resumo** (MG, MF, S) e **Completo** (N1..N4, P, MG, Pré, F, MF, S)
- Painel lateral com detalhes do aluno

## Como usar
1. Ative o GitHub Pages (Settings → Pages → Deploy from a branch → main).
2. Substitua `data/medias_exemplo.csv` pelo seu CSV real (mesmas colunas).
3. Ajuste as disciplinas/prefixos em `config/schema.yaml` se necessário.
4. Recarregue a página (Ctrl+F5).

## Dicas
- O contador mostra: `Exibindo X de Y alunos`. Se Y não bater com o seu CSV, verifique:
  - Nome do arquivo: deve ser `data/medias_exemplo.csv`.
  - Cabeçalho: tem que conter as colunas de identificação (Protagonistas, Matrícula, S/T, Tutoria, Conselho).
  - Delimitador: o PapaParse detecta automaticamente vírgula/;.
- Para mostrar **todas** as colunas por disciplina, mude a “Visão” para **Completo**.
