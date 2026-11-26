# Regras de Negócio & Funcionamento da Área de Triagem — JurisTriage

Este documento especifica formalmente todas as regras de negócio, critérios de classificação, fluxo de memória persistente, guardrails anti-alucinação e governança de consumo de tokens implementados na pipeline **100% Python + React/Vite** do **JurisTriage**.

---

## 1. Ingestão Universal de Documentos (`.pdf`, `.txt`, `.md`)

O JurisTriage foi projetado para operar em produção sobre **qualquer tipo de documento** — petições judiciais, decisões interlocutórias, contratos empresariais, ofícios administrativos, pareceres, atas ou textos gerais — sem depender de modelos fixos de layout.

### Regras de Validação na Entrada
1. **Extensões permitidas:** `.pdf`, `.txt` e `.md`. Qualquer outra extensão é rejeitada com HTTP `400`.
2. **Limite de tamanho:** máximo de **10 MB** por arquivo (`MAX_FILE_SIZE = 10 * 1024 * 1024`). Arquivos vazios ou acima do limite são rejeitados antes do processamento.
3. **Validação de integridade (assinatura/conteúdo):**
   - Arquivos `.pdf` devem obrigatoriamente iniciar com a assinatura binária `%PDF-`.
   - Arquivos `.txt` e `.md` são decodificados com fallback `UTF-8 → Latin-1` e rejeitados se contiverem bytes nulos (`\x00`), bloqueando binários renomeados.
4. **Higienização de nome de arquivo:** caracteres de diretório (`/` e `\`) são removidos no backend para prevenir *path traversal*.

### Paginação Padronizada (`[Pág. X]`)
- **PDFs:** cada página extraída é delimitada no texto consolidado pelo marcador padronizado `[Pág. X]`, preservando o número exato da página original (iniciando em 1).
- **TXT / Markdown:** documentos contínuos sem quebra física de página são divididos automaticamente em páginas lógicas de aproximadamente **3.000 caracteres** (respeitando quebras de parágrafo sempre que possível) e marcados igualmente com `[Pág. 1]`, `[Pág. 2]`, etc.
- **Motivo arquitetural:** esse marcador único garante rastreabilidade exata em citações no chat RAG e permite que o **Auditor de Texto Paginado** na interface salte diretamente para a página clicada.

---

## 2. Normalização Universal da Ficha de Triagem

Todo documento analisado passa por extração estruturada (*Structured Output* / JSON Schema estrito) e é normalizado em uma única ficha visual padronizada:

| Campo da Ficha | Tipo | Comportamento para Documentos Jurídicos | Fallback para Documentos Não-Jurídicos |
| :--- | :--- | :--- | :--- |
| `tipo_documento` | Texto | Ex.: *Sentença*, *Petição Inicial*, *Contrato Social* | Ex.: *Relatório Técnico*, *Ata de Reunião*, *Documento Geral* |
| `numero_processo` | Texto | Padrão CNJ (ex.: `0012345-67.2026.8.26.0100`) | `"Não aplicável"` |
| `tribunal_orgao` | Texto | Ex.: *TJSP — 5ª Vara Cível*, *TRT-2* | Órgão/empresa emissora ou `"Não aplicável"` |
| `partes` | Lista | Autor, Réu, Requerente, Advogados | Partes, signatários, autores ou envolvidos citados |
| `urgencia` | Enum | `ALTA`, `MEDIA` ou `BAIXA` | Mesma matriz aplicada a prazos e riscos do documento |
| `prazo_critico` | Texto | Data/prazo processual explícito encontrado | Prazo contratual/operacional ou `"Sem prazo identificado"` |
| `valor_causa` | Texto | Valor da causa ou condenação em R$ | Valor financeiro principal ou `"Não informado"` |
| `resumo_executivo` | Texto | Síntese factual em 3–5 frases com `[Pág. X]` | Síntese factual em 3–5 frases com `[Pág. X]` |
| `pontos_atencao` | Lista | Riscos processuais, tutelas, multas, omissões | Cláusulas críticas, obrigações, riscos ou pendências |
| `perguntas_sugeridas` | Lista (3–4 itens) | Perguntas diretas ligadas a prazos, valores e riscos | Perguntas contextuais ancoradas nos fatos do texto |

**Regra de preenchimento estrito:** o modelo é explicitamente proibido de inferir, completar ou inventar metadados ausentes (como gerar um número CNJ fictício ou estimar uma data). Quando ausente, deve retornar exatamente o fallback definido.

---

## 3. Critérios de Classificação de Urgência (`ALTA`, `MEDIA`, `BAIXA`)

A classificação de prioridade orienta a fila de triagem e os filtros da interface:

- **`ALTA` (Prioridade Crítica):**
  - Prazos fatais curtos (ex.: até 5 dias úteis, 24h, 48h, 72h, intimações urgentes);
  - Liminares, tutelas de urgência/antecipadas, mandados de segurança, bloqueios judiciais (SISBAJUD/RENAJUD), busca e apreensão ou ordens com multa diária (*astreintes*);
  - Rescisões imediatas, notificações extrajudiciais com prazo peremptório ou riscos financeiros/operacionais graves e iminentes.
- **`MEDIA` (Atenção Programada):**
  - Prazos ordinários (ex.: 10 a 30 dias úteis, contestação comum, réplica, recursos ordinários sem risco imediato);
  - Contratos em negociação, aditivos, pareceres ou obrigações recorrentes com data definida porém não iminente.
- **`BAIXA` (Informativo / Sem Risco Imediato):**
  - Documentos meramente informativos, despachos de mero expediente, atas, manuais, comunicados internos ou textos sem prazo crítico nem obrigação coercitiva imediata.

---

## 4. Geração Dinâmica de Perguntas Contextuais

Durante a própria etapa de extração estruturada (`POST /api/documents/analyze`), o LLM gera de **3 a 4 perguntas sugeridas** (`perguntas_sugeridas`) sob medida para o conteúdo real daquele documento:

1. **Ancoragem factual:** cada pergunta deve ser respondível com base no texto analisado, focando nos pontos de maior valor prático (prazos críticos, valores/multas, obrigações das partes, cláusulas de risco ou pedidos principais).
2. **Persistência:** ao salvar o documento na memória (`POST /api/documents`), as perguntas são armazenadas junto ao registro na tabela `documents` (`suggested_questions` em JSON) e carregam instantaneamente como atalhos clicáveis no chat do documento.
3. **Sem hardcoding genérico:** perguntas estáticas só atuam como fallback mínimo caso um documento legado salvo em versão anterior não possua `suggested_questions`.

---

## 5. Persistência Explícita na Memória da IA (*Staging* → Botão "Salvar")

Para evitar poluição da base de conhecimento com arquivos temporários, testes ou documentos enviados por engano, a ingestão ocorre em **dois estágios explícitos**:

1. **Estágio 1 — Análise em Pré-Visualização (*Staging*):**
   - O upload chama `POST /api/documents/analyze`.
   - O backend extrai o texto paginado (`[Pág. X]`), executa a triagem via LLM e captura o consumo real de tokens (`usage_metadata`), retornando o payload completo para a interface **sem gravar nada no SQLite**.
   - A interface exibe o documento em modo de revisão (*Pré-visualização em Staging*), permitindo auditar a ficha normalizada, os pontos de atenção, as perguntas sugeridas e o texto paginado antes de decidir.
2. **Estágio 2 — Decisão Explícita do Usuário:**
   - **Botão `Salvar na Memória`:** dispara `POST /api/documents`, persistindo definitivamente o documento, o texto paginado, as perguntas sugeridas e os metadados de tokens no banco `juristriage.db`. A partir desse momento, o documento passa a integrar o histórico da fila e o índice consultado pelo agente global ("Cérebro").
   - **Botão `Descartar`:** limpa o estado de *staging* na interface sem gravar nenhum registro no banco de dados.

---

## 6. Agente de Texto Generalizado (Chat RAG em Dois Modos)

O módulo de perguntas e respostas opera em dois modos claramente separados na interface:

### Modo 1 — Contexto do Documento Atual (`POST /api/documents/{id}/chat`)
- Consulta exclusivamente o texto paginado (`[Pág. X]`) do documento aberto.
- Mantém histórico de conversa isolado por documento (`chat_messages`).
- Exige citação de página no formato **`[Pág. X]`** para cada afirmação factual.
- Clicar em uma citação abre automaticamente o **Auditor de Texto** posicionado na página correspondente.

### Modo 2 — Base de Conhecimento Geral ("Cérebro") (`GET/POST/DELETE /api/chat/global`)
- Permite realizar perguntas cruzadas, auditorias comparativas e buscas por critério em **todos os documentos salvos na memória persistente** (ex.: *"Quais documentos têm urgência ALTA e prazos críticos?"*, *"Compare os valores e multas entre os contratos salvos"*, *"Liste todas as partes envolvidas nos processos salvos"*).
- O backend monta um contexto estruturado contendo os metadados normalizados e os trechos paginados de cada documento salvo (respeitando orçamento seguro de contexto e priorizando trechos relevantes aos critérios da consulta).
- Exige citação obrigatória no formato **`[Doc: nome_do_arquivo.ext | Pág. X]`** para cada dado recuperado.
- **Verificação server-side de citações:** antes de retornar a resposta ao frontend, o backend valida cada citação `[Doc: ... | Pág. X]` contra os documentos realmente existentes no banco, anexando o `document_id` e a `page` verificados. Clicar em uma citação no chat global navega diretamente para o documento correto na página citada.

---

## 7. Guardrails Anti-Alucinação (Estado da Arte)

A pipeline aplica múltiplas camadas complementares de *Grounding* para eliminar invenções do modelo:

1. **Rastreabilidade por Página e Documento:** todo texto entregue ao LLM contém marcadores explícitos `[Pág. X]` (e cabeçalhos de arquivo no modo global), impedindo citações genéricas sem fonte verificável.
2. **Parâmetros Determinísticos:**
   - Extração estruturada utiliza **`temperature = 0.0`** e **`seed = 42`** nos modelos que suportam temperatura (`gemini-3.1-flash-lite`, `gemini-2.5-flash` e `groq:llama-3.3-70b-versatile`).
   - Chat RAG utiliza **`temperature = 0.1`** e **`seed = 42`** para máxima fidelidade factual com fluidez controlada.
   - Para `gemini-4-hydrogen`, o parâmetro `temperature` é omitido conforme especificação oficial da API Gemini 4 (evitando erro HTTP 400), mantendo `seed = 42` e schema rígido.
3. **System Prompt com Restrição Estrita e Abstinência Literal:**
   - O modelo é instruído a usar **exclusivamente** o texto fornecido dentro das tags delimitadoras `<DOCUMENTO>` / `<BASE_DE_CONHECIMENTO>`.
   - Qualquer tentativa de comando contida no texto do PDF/TXT é tratada como dado inerte (*Prompt Injection Defense*).
   - Quando a informação solicitada não estiver literalmente amparada no texto, o modelo é obrigado a recusar de forma padronizada:
     - Modo Documento Atual: `"Esta informação não consta no documento analisado."`
     - Modo Base Geral ("Cérebro"): `"Esta informação não consta nos documentos salvos na base de conhecimento."`
4. **Validação de Schema e Allowlist de Modelos:**
   - Saídas de extração passam por validação estrita de campos e enum (`ALTA | MEDIA | BAIXA`).
   - Apenas modelos declarados na allowlist do backend podem ser selecionados pelo cliente.

---

## 8. Rastreabilidade e Governança de Consumo de Tokens

Cada chamada real à API de IA (Gemini ou Groq) captura o objeto nativo de consumo (`usage_metadata` no Gemini / `usage` na API Groq):

- **`input_tokens` (Prompt):** tokens consumidos pelo system prompt, texto do documento/base e pergunta do usuário.
- **`output_tokens` (Resposta):** tokens gerados pelo modelo.
- **`total_tokens`:** soma real reportada pelo provedor.
- **`model`:** identificador exato do modelo utilizado naquela operação.

### Persistência e Visibilidade
1. **Na extração:** exibido imediatamente no estado de *staging* e salvo na tabela `documents` (`extraction_input_tokens`, `extraction_output_tokens`, `extraction_total_tokens`, `extraction_model`) quando o usuário clica em **Salvar na Memória**.
2. **Em cada mensagem de chat:** persistido individualmente nas tabelas `chat_messages` (por documento) e `global_chat_messages` (base geral).
3. **Agregação global (`GET /api/metrics/tokens`):** consolida em tempo real o acumulado de tokens de extração, chat por documento, chat global e o total geral da base, exibido de forma discreta e tabular (`tabular-nums`) na barra lateral e no cabeçalho de cada ficha.
