/**
 * Dados de demonstração — para visualizar o sistema populado.
 *
 *   node scripts/seed-demo.mjs up     # cria empresas/tarefas/etc fictícias
 *   node scripts/seed-demo.mjs down   # apaga tudo o que o "up" criou
 *
 * Lê as chaves de .env.local. Usa a service role (ignora RLS).
 * Tudo o que é criado leva o prefixo/marcador do domínio "@demo.local" ou
 * CNPJ começando em "99" para poder ser removido com segurança.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const iso = (d) => d.toISOString().slice(0, 10);
// Âncora tudo em UTC (ler e escrever) — misturar campos locais (setDate) com
// toISOString() (sempre UTC) faz a data escorregar pro dia seguinte
// dependendo do fuso e da hora exata em que o script roda.
const hoje = new Date();
const addDays = (n) => {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + n));
  return iso(d);
};
const comp = (offset = 0) => {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + offset, 1));
  return iso(d);
};
const pick = (arr, i) => arr[i % arr.length];

/* ------------------------------------------------------------------ */

const EMPRESAS = [
  {
    razao_social: "Agrocampo Comércio de Insumos Agrícolas LTDA",
    nome_fantasia: "Agrocampo Insumos",
    cnpj: "99001002000110",
    regime_tributario: "lucro_presumido",
    situacao: "ativa",
    cnae_principal: "4692-3/00",
    inscricao_estadual: "13.123.456-7",
    data_abertura: "2015-03-12",
    email: "financeiro@agrocampo.com.br",
    telefone: "(66) 3531-1200",
    cep: "78550-000",
    logradouro: "Av. dos Ipês",
    numero: "1450",
    bairro: "Setor Comercial",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: 1850,
    departamentos_responsaveis: ["fiscal", "contabil", "pessoal"],
    observacoes: "Cliente desde 2015. Faturamento alto no 2º semestre (safra).",
  },
  {
    razao_social: "Nova Safra Máquinas e Peças LTDA",
    nome_fantasia: "Nova Safra Máquinas",
    cnpj: "99002003000191",
    regime_tributario: "lucro_real",
    situacao: "ativa",
    cnae_principal: "4661-3/00",
    inscricao_estadual: "13.987.654-3",
    data_abertura: "2011-08-01",
    email: "contato@novasafra.com.br",
    telefone: "(66) 3211-4500",
    cep: "78890-000",
    logradouro: "Rod. BR-163, km 742",
    numero: "s/n",
    bairro: "Distrito Industrial",
    municipio: "Sorriso",
    uf: "MT",
    honorario_mensal: 3400,
    departamentos_responsaveis: ["fiscal", "contabil", "pessoal", "societario"],
  },
  {
    razao_social: "Transportadora Rota Norte EIRELI",
    nome_fantasia: "Rota Norte Transportes",
    cnpj: "99003004000172",
    regime_tributario: "lucro_presumido",
    situacao: "ativa",
    cnae_principal: "4930-2/02",
    data_abertura: "2018-05-20",
    email: "adm@rotanorte.com.br",
    telefone: "(66) 99912-3344",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: 2100,
    departamentos_responsaveis: ["fiscal", "pessoal"],
  },
  {
    razao_social: "Mercado Bom Preço de Sinop LTDA",
    nome_fantasia: "Supermercado Bom Preço",
    cnpj: "99004005000153",
    regime_tributario: "simples_nacional",
    situacao: "ativa",
    cnae_principal: "4711-3/02",
    data_abertura: "2009-11-03",
    email: "fiscal@bompreco.com.br",
    telefone: "(66) 3531-7788",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: 1200,
    departamentos_responsaveis: ["fiscal", "contabil", "pessoal"],
  },
  {
    razao_social: "Construtora Planalto Central LTDA",
    nome_fantasia: "Construtora Planalto",
    cnpj: "99005006000134",
    regime_tributario: "lucro_presumido",
    situacao: "ativa",
    cnae_principal: "4120-4/00",
    data_abertura: "2016-02-15",
    email: "obra@planaltoconstrutora.com.br",
    telefone: "(66) 3211-9090",
    municipio: "Sorriso",
    uf: "MT",
    honorario_mensal: 2650,
    departamentos_responsaveis: ["fiscal", "contabil", "pessoal", "societario"],
  },
  {
    razao_social: "Clínica Vida & Saúde LTDA",
    nome_fantasia: "Clínica Vida & Saúde",
    cnpj: "99006007000115",
    regime_tributario: "simples_nacional",
    situacao: "ativa",
    cnae_principal: "8630-5/03",
    data_abertura: "2019-09-10",
    email: "administrativo@vidaesaude.com.br",
    telefone: "(66) 3515-2020",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: 1450,
    departamentos_responsaveis: ["fiscal", "pessoal"],
  },
  {
    razao_social: "Restaurante Sabor do Campo LTDA",
    nome_fantasia: "Sabor do Campo",
    cnpj: "99007008000196",
    regime_tributario: "simples_nacional",
    situacao: "suspensa",
    cnae_principal: "5611-2/01",
    data_abertura: "2021-01-22",
    email: "sabor@sabordocampo.com.br",
    telefone: "(66) 99988-1122",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: 900,
    departamentos_responsaveis: ["fiscal", "pessoal"],
    observacoes: "Atividade suspensa desde 06/2026. Cliente avaliando reabertura.",
  },
  {
    razao_social: "MEI João Pereira Serviços de Manutenção",
    nome_fantasia: "JP Manutenção",
    cnpj: "99008009000177",
    regime_tributario: "mei",
    situacao: "ativa",
    cnae_principal: "3319-8/00",
    data_abertura: "2023-04-05",
    email: "joao.pereira@email.com",
    telefone: "(66) 99700-5566",
    municipio: "Sorriso",
    uf: "MT",
    honorario_mensal: 190,
    departamentos_responsaveis: ["fiscal"],
  },
  {
    razao_social: "Agropecuária Boi Forte LTDA",
    nome_fantasia: "Boi Forte Agropecuária",
    cnpj: "99009010000158",
    regime_tributario: "lucro_real",
    situacao: "ativa",
    cnae_principal: "0151-2/01",
    data_abertura: "2008-07-18",
    email: "fiscal@boiforte.agr.br",
    telefone: "(66) 3211-3030",
    municipio: "Nova Mutum",
    uf: "MT",
    honorario_mensal: 4200,
    departamentos_responsaveis: ["fiscal", "contabil", "pessoal", "societario", "ir"],
  },
  {
    razao_social: "Tech Norte Soluções em TI LTDA",
    nome_fantasia: "Tech Norte",
    cnpj: "99010011000139",
    regime_tributario: "simples_nacional",
    situacao: "em_abertura",
    cnae_principal: "6201-5/01",
    data_abertura: null,
    email: "contato@technorte.dev",
    telefone: "(66) 99655-4400",
    municipio: "Sinop",
    uf: "MT",
    honorario_mensal: null,
    departamentos_responsaveis: ["societario"],
    observacoes: "Processo de abertura em andamento na Junta Comercial.",
  },
];

const NOMES = [
  "Carlos Henrique Almeida",
  "Marina Souza Ribeiro",
  "Rafael Oliveira Lima",
  "Patrícia Gomes Ferreira",
  "Anderson Luiz Costa",
  "Juliana Martins Rocha",
  "Eduardo Nogueira Pinto",
  "Fernanda Alves Barbosa",
];

async function up() {
  console.log("Criando dados de demonstração…");
  const { data: empresas, error: eErr } = await db
    .from("empresas")
    .upsert(EMPRESAS, { onConflict: "cnpj" })
    .select(
      "id, nome_fantasia, razao_social, regime_tributario, departamentos_responsaveis",
    );
  if (eErr) throw eErr;
  console.log(`  ${empresas.length} empresas`);

  // sócios (2 por empresa, exceto MEI e em_abertura)
  const socios = [];
  empresas.forEach((e, i) => {
    if (e.nome_fantasia === "JP Manutenção" || e.nome_fantasia === "Tech Norte")
      return;
    socios.push(
      {
        empresa_id: e.id,
        nome: pick(NOMES, i),
        cpf: String(10000000000 + i * 111111).padStart(11, "0"),
        participacao: 60,
        administrador: true,
      },
      {
        empresa_id: e.id,
        nome: pick(NOMES, i + 3),
        cpf: String(20000000000 + i * 222222).padStart(11, "0"),
        participacao: 40,
        administrador: false,
      },
    );
  });
  const { data: sociosSalvos } = await db
    .from("socios")
    .insert(socios)
    .select("id, empresa_id, nome");
  console.log(`  ${socios.length} sócios`);

  // contatos
  const contatos = [];
  empresas.forEach((e, i) => {
    contatos.push({
      empresa_id: e.id,
      nome: pick(NOMES, i + 1),
      cargo: "Financeiro",
      tipo: "financeiro",
      telefone: "(66) 99900-00" + String(10 + i),
      email: `financeiro${i}@demo.local`,
      recebe_comunicacoes: true,
    });
    if (i % 2 === 0)
      contatos.push({
        empresa_id: e.id,
        nome: pick(NOMES, i + 4),
        cargo: "Recursos Humanos",
        tipo: "rh",
        email: `rh${i}@demo.local`,
        recebe_comunicacoes: true,
      });
  });
  await db.from("contatos").insert(contatos);
  console.log(`  ${contatos.length} contatos`);

  // tarefas
  const DEP = ["fiscal", "pessoal", "contabil", "societario", "atendimento"];
  const ST = [
    "nao_iniciada",
    "em_andamento",
    "aguardando_cliente",
    "em_revisao",
    "concluida",
  ];
  const TITULOS = [
    "Apuração do Simples Nacional (DAS)",
    "Apuração de PIS/COFINS",
    "Folha de pagamento",
    "Fechamento contábil",
    "Conciliação bancária",
    "EFD-Contribuições",
    "EFD-Reinf",
    "DCTFWeb",
    "Envio do eSocial - eventos periódicos",
    "Provisão de férias e 13º",
    "Alteração contratual - endereço",
    "Baixa de inscrição estadual",
    "Emissão de guias do mês",
    "Atendimento: dúvida sobre pró-labore",
    "Solicitar documentos da competência",
    "Conferência de notas de entrada",
    "Apuração de ICMS",
    "Admissão de funcionário",
  ];
  const prazos = [-10, -4, -1, 0, 1, 2, 3, 5, 7, 9, 12, 15, 18, 22, 25, 4, 6, 30];
  const tarefas = TITULOS.map((titulo, i) => {
    const emp = empresas[i % empresas.length];
    const interna = titulo.startsWith("Atendimento") || i === 12;
    return {
      titulo,
      empresa_id: interna ? null : emp.id,
      departamento: pick(DEP, i),
      competencia: comp(0),
      prazo: addDays(prazos[i]),
      status: pick(ST, i),
      prioridade: pick(["baixa", "normal", "normal", "alta", "urgente"], i),
      origem: "manual",
    };
  });
  const { data: tf, error: tErr } = await db
    .from("tarefas")
    .insert(tarefas)
    .select("id, titulo");
  if (tErr) throw tErr;
  console.log(`  ${tf.length} tarefas`);

  // checklists em algumas tarefas
  const itens = [];
  tf.slice(0, 6).forEach((t) => {
    const base = [
      "Receber documentos do cliente",
      "Conferir e lançar",
      "Apurar",
      "Revisar",
      "Gerar guia / transmitir",
      "Disponibilizar ao cliente",
    ];
    base.forEach((descricao, ordem) =>
      itens.push({
        tarefa_id: t.id,
        descricao,
        ordem,
        feito: ordem < 2 + (t.titulo.length % 3),
      }),
    );
  });
  await db.from("tarefa_itens").insert(itens);
  console.log(`  ${itens.length} itens de checklist`);

  // eventos de agenda
  const eventos = [
    { titulo: "Reunião com Agrocampo", tipo: "reuniao", data: addDays(2), departamento: "atendimento" },
    { titulo: "Vencimento FGTS", tipo: "obrigacao", data: addDays(7), departamento: "pessoal" },
    { titulo: "Vencimento DAS", tipo: "obrigacao", data: addDays(20), departamento: "fiscal" },
    { titulo: "Entrega EFD-Reinf", tipo: "prazo", data: addDays(15), departamento: "fiscal" },
    { titulo: "Ligar para Rota Norte", tipo: "lembrete", data: addDays(1), departamento: "atendimento" },
    { titulo: "Fechamento do mês - contábil", tipo: "prazo", data: addDays(10), departamento: "contabil" },
  ].map((e) => ({ ...e, origem: "manual" }));
  await db.from("eventos_agenda").insert(eventos);
  console.log(`  ${eventos.length} eventos de agenda`);

  // documentos (metadados; arquivo fake)
  const docs = empresas.slice(0, 6).flatMap((e, i) => [
    {
      empresa_id: e.id,
      departamento: "fiscal",
      categoria: "nota_fiscal",
      competencia: comp(0),
      titulo: `Notas de entrada ${i + 1}.xml`,
      storage_path: `${e.id}/demo-notas-${i}.xml`,
      mime: "text/xml",
      origem: "cliente",
      status: pick(["pendente", "recebido", "aprovado"], i),
    },
    {
      empresa_id: e.id,
      departamento: "contabil",
      categoria: "extrato",
      competencia: comp(0),
      titulo: `Extrato bancário ${i + 1}.pdf`,
      storage_path: `${e.id}/demo-extrato-${i}.pdf`,
      mime: "application/pdf",
      origem: "cliente",
      status: "recebido",
    },
  ]);
  await db.from("documentos").insert(docs);
  console.log(`  ${docs.length} documentos`);

  // fiscal: recorrências + geração de obrigações (se o módulo já estiver migrado)
  try {
    const recBase = {
      simples_nacional: [
        { tipo: "das", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "fgts", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "defis", dia_vencimento: 31, meses_apos: 3, periodicidade: "anual" },
      ],
      lucro_presumido: [
        { tipo: "darf_pis", dia_vencimento: 25, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "darf_cofins", dia_vencimento: 25, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "darf_irpj", dia_vencimento: 30, meses_apos: 1, periodicidade: "trimestral" },
        { tipo: "dctfweb", dia_vencimento: 15, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "fgts", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
      ],
      lucro_real: [
        { tipo: "darf_pis", dia_vencimento: 25, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "darf_cofins", dia_vencimento: 25, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "efd_contribuicoes", dia_vencimento: 15, meses_apos: 2, periodicidade: "mensal" },
        { tipo: "dctfweb", dia_vencimento: 15, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "fgts", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
        { tipo: "efd_icms_ipi", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
      ],
      mei: [
        { tipo: "das_mei", dia_vencimento: 20, meses_apos: 1, periodicidade: "mensal" },
      ],
      imune_isenta: [],
    };
    const recs = [];
    for (const e of empresas) {
      for (const r of recBase[e.regime_tributario] ?? [])
        recs.push({ ...r, empresa_id: e.id, ativo: true });
    }
    const { error: rErr } = await db
      .from("obrigacao_recorrencias")
      .upsert(recs, { onConflict: "empresa_id,tipo" });
    if (rErr) throw rErr;
    console.log(`  ${recs.length} recorrências fiscais`);

    // gera direto (não usa a RPC gerar_obrigacoes: ela exige is_staff(), que
    // depende de auth.uid() e não existe com a service role do seed)
    const vencimento = (competencia, mesesApos, dia) => {
      const base = new Date(competencia);
      base.setMonth(base.getMonth() + mesesApos);
      const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(dia, ultimoDia));
      return iso(base);
    };
    let ger = 0;
    for (const off of [-2, -1, 0, 1]) {
      const competencia = comp(off);
      const mes = Number(competencia.slice(5, 7));
      const elegiveis = recs.filter((r) => {
        if (r.periodicidade === "mensal") return true;
        if (r.periodicidade === "trimestral") return mes % 3 === 0;
        if (r.periodicidade === "anual") return mes === 1;
        return false;
      });
      const rows = elegiveis.map((r) => ({
        empresa_id: r.empresa_id,
        competencia,
        tipo: r.tipo,
        vencimento: vencimento(competencia, r.meses_apos, r.dia_vencimento),
        status: "pendente",
      }));
      const { data: inseridas } = await db
        .from("obrigacoes")
        .upsert(rows, { onConflict: "empresa_id,competencia,tipo", ignoreDuplicates: true })
        .select("id");
      ger += inseridas?.length ?? 0;
    }
    // status variados p/ visualização
    const { data: obr } = await db
      .from("obrigacoes")
      .select("id")
      .order("vencimento");
    const st = ["pendente", "em_andamento", "gerada", "disponivel", "entregue", "paga"];
    for (let i = 0; i < (obr ?? []).length; i++) {
      if (i % 4 === 3) continue; // deixa 1/4 pendente
      await db
        .from("obrigacoes")
        .update({ status: st[i % st.length] })
        .eq("id", obr[i].id);
    }
    console.log(`  ${ger} obrigações geradas`);
  } catch (err) {
    console.log(
      `  (módulo Fiscal ainda não migrado — pulei obrigações: ${err.message})`,
    );
  }

  // pessoal: funcionários + processos de DP (se o módulo já estiver migrado)
  try {
    const CARGOS = ["Auxiliar Administrativo", "Motorista", "Vendedor", "Analista Fiscal", "Operador de Máquinas"];
    const funcs = empresas.slice(0, 6).flatMap((e, i) => [
      {
        empresa_id: e.id,
        nome: pick(NOMES, i + 2),
        cpf: String(30000000000 + i * 131313).padStart(11, "0"),
        cargo: pick(CARGOS, i),
        tipo_contrato: i % 3 === 0 ? "estagio" : "clt",
        data_admissao: addDays(-365 - i * 40),
        salario: 1800 + i * 350,
        status: "ativo",
      },
      {
        empresa_id: e.id,
        nome: pick(NOMES, i + 5),
        cpf: String(40000000000 + i * 141414).padStart(11, "0"),
        cargo: pick(CARGOS, i + 1),
        tipo_contrato: "clt",
        data_admissao: addDays(-200 - i * 20),
        salario: 2200 + i * 200,
        status: i === 0 ? "ferias" : "ativo",
      },
    ]);
    const { data: fns, error: fnErr } = await db
      .from("funcionarios")
      .insert(funcs)
      .select("id, nome, empresa_id");
    if (fnErr) throw fnErr;
    console.log(`  ${fns.length} funcionários`);

    const eventos = [
      { empresa_id: fns[0].empresa_id, funcionario_id: fns[0].id, tipo: "admissao", status: "em_andamento", data_referencia: addDays(-10) },
      { empresa_id: fns[1].empresa_id, funcionario_id: fns[1].id, tipo: "ferias", status: "aguardando_cliente", data_referencia: addDays(5) },
      { empresa_id: fns[2].empresa_id, funcionario_id: fns[2].id, tipo: "alteracao_salarial", status: "solicitado", data_referencia: addDays(3) },
      { empresa_id: fns[3].empresa_id, funcionario_id: null, tipo: "decimo_terceiro", status: "em_andamento", competencia: comp(0) },
      { empresa_id: fns[4].empresa_id, funcionario_id: fns[4].id, tipo: "demissao", status: "solicitado", data_referencia: addDays(7) },
      { empresa_id: fns[5].empresa_id, funcionario_id: fns[5].id, tipo: "admissao", status: "concluido", data_referencia: addDays(-30) },
    ];
    const { data: evs, error: evErr } = await db
      .from("eventos_dp")
      .insert(eventos)
      .select("id, tipo");
    if (evErr) throw evErr;

    const CHECKLIST = {
      admissao: ["Documentos recebidos", "Cadastro realizado", "Contrato gerado", "Assinaturas coletadas", "Envio ao eSocial", "Processo concluído"],
      demissao: ["Aviso prévio / comunicado", "Cálculo da rescisão", "Homologação / assinatura", "Envio ao eSocial", "Pagamento das verbas"],
    };
    const itensDp = evs.flatMap((e, i) => {
      const base = CHECKLIST[e.tipo] ?? ["Solicitação recebida", "Em andamento", "Concluído"];
      return base.map((descricao, ordem) => ({
        evento_id: e.id,
        descricao,
        ordem,
        feito: e.tipo === "admissao" && i === 5 ? true : ordem < 2,
      }));
    });
    await db.from("evento_dp_itens").insert(itensDp);
    console.log(`  ${evs.length} processos de DP, ${itensDp.length} itens de checklist`);
  } catch (err) {
    console.log(
      `  (módulo Departamento Pessoal ainda não migrado — pulei funcionários/processos: ${err.message})`,
    );
  }

  // contábil: fechamentos + checklist (se o módulo já estiver migrado)
  try {
    const CHECKLIST_FECHAMENTO = [
      "Lançamentos contábeis",
      "Conciliação bancária",
      "Apuração de resultado",
      "Balancete gerado",
      "DRE gerado",
      "Fechamento entregue ao cliente",
    ];
    const elegiveis = empresas.filter((e) => e.regime_tributario !== "mei");
    const STATUS_FECH = ["aberto", "em_andamento", "revisao", "fechado", "entregue"];
    const fechData = elegiveis.map((e, i) => ({
      empresa_id: e.id,
      competencia: comp(0),
      status: pick(STATUS_FECH, i),
    }));
    const { data: fechs, error: fechErr } = await db
      .from("fechamentos_contabeis")
      .insert(fechData)
      .select("id, status");
    if (fechErr) throw fechErr;

    const itensFech = fechs.flatMap((f) => {
      const idxStatus = STATUS_FECH.indexOf(f.status);
      // quanto mais avançado o status, mais itens já feitos
      const feitosAte = Math.min(idxStatus + 1, CHECKLIST_FECHAMENTO.length);
      return CHECKLIST_FECHAMENTO.map((descricao, ordem) => ({
        fechamento_id: f.id,
        descricao,
        ordem,
        feito: ordem < feitosAte,
      }));
    });
    await db.from("fechamento_itens").insert(itensFech);
    console.log(`  ${fechs.length} fechamentos contábeis, ${itensFech.length} itens de checklist`);
  } catch (err) {
    console.log(
      `  (módulo Contábil ainda não migrado — pulei fechamentos: ${err.message})`,
    );
  }

  // societário: processos + checklist (se o módulo já estiver migrado)
  try {
    const porNome = Object.fromEntries(empresas.map((e) => [e.nome_fantasia, e]));
    const CHECKLIST_SOC = {
      abertura: [
        "Documentos e dados recebidos",
        "Contrato social elaborado",
        "Assinaturas coletadas",
        "Registro na Junta Comercial",
        "Inscrição no CNPJ (Receita Federal)",
        "Inscrições estadual/municipal",
        "Alvará de funcionamento",
      ],
      alteracao_contratual: [
        "Documentos recebidos",
        "Alteração contratual elaborada",
        "Assinaturas coletadas",
        "Registro na Junta Comercial",
        "Atualização de dados cadastrais",
      ],
      encerramento: [
        "Distrato elaborado",
        "Assinaturas coletadas",
        "Baixa na Junta Comercial",
        "Baixa no CNPJ (Receita Federal)",
        "Baixa nas inscrições estadual/municipal",
        "Certidões negativas obtidas",
      ],
    };
    const processosData = [
      { empresa_id: porNome["Tech Norte"]?.id, tipo: "abertura", status: "aguardando_orgao", protocolo: "JC-2026-04471", descricao: "Abertura de nova empresa de tecnologia." },
      { empresa_id: porNome["Sabor do Campo"]?.id, tipo: "alteracao_contratual", status: "em_andamento", descricao: "Inclusão de novo sócio e ajuste de participação societária." },
      { empresa_id: porNome["Agrocampo Insumos"]?.id, tipo: "alteracao_contratual", status: "concluido", descricao: "Mudança de endereço da matriz." },
      { empresa_id: porNome["JP Manutenção"]?.id, tipo: "alteracao_contratual", status: "solicitado", descricao: "Inclusão de nova atividade (CNAE) no contrato social." },
      { empresa_id: porNome["Rota Norte Transportes"]?.id, tipo: "encerramento", status: "aguardando_cliente", descricao: "Encerramento de filial inativa." },
    ].filter((p) => p.empresa_id);

    const { data: procs, error: procErr } = await db
      .from("processos_societarios")
      .insert(processosData)
      .select("id, tipo, status");
    if (procErr) throw procErr;

    const STATUS_ORDEM = ["solicitado", "em_andamento", "aguardando_orgao", "aguardando_cliente", "concluido"];
    const itensSoc = procs.flatMap((p) => {
      const checklist = CHECKLIST_SOC[p.tipo] ?? [];
      const idxStatus = STATUS_ORDEM.indexOf(p.status);
      const feitosAte = p.status === "concluido" ? checklist.length : Math.max(idxStatus, 0);
      return checklist.map((descricao, ordem) => ({
        processo_id: p.id,
        descricao,
        ordem,
        feito: ordem < feitosAte,
      }));
    });
    await db.from("processo_societario_itens").insert(itensSoc);
    console.log(`  ${procs.length} processos societários, ${itensSoc.length} itens de checklist`);
  } catch (err) {
    console.log(
      `  (módulo Societário ainda não migrado — pulei processos: ${err.message})`,
    );
  }

  // IR: declarações de IRPF/IRPJ/ITR (se o módulo já estiver migrado)
  try {
    const porNomeIr = Object.fromEntries(empresas.map((e) => [e.nome_fantasia, e]));
    const sociosDe = (nome) =>
      (sociosSalvos ?? []).filter((s) => s.empresa_id === porNomeIr[nome]?.id);
    const ano = hoje.getUTCFullYear();

    const declaracoesData = [
      ...sociosDe("Agrocampo Insumos").map((s, i) => ({
        empresa_id: s.empresa_id,
        socio_id: s.id,
        tipo: "irpf",
        ano_exercicio: ano,
        status: i === 0 ? "documentos_recebidos" : "entregue",
        valor_a_restituir: i === 0 ? null : 842.5,
        prazo: `${ano}-04-30`,
      })),
      { empresa_id: porNomeIr["Nova Safra Máquinas"]?.id, socio_id: null, tipo: "irpj", ano_exercicio: ano, status: "em_elaboracao", prazo: `${ano}-05-31` },
      { empresa_id: porNomeIr["Construtora Planalto"]?.id, socio_id: null, tipo: "irpj", ano_exercicio: ano, status: "pendente", prazo: `${ano}-05-31` },
      { empresa_id: porNomeIr["Boi Forte Agropecuária"]?.id, socio_id: null, tipo: "itr", ano_exercicio: ano, status: "pendente", prazo: `${ano}-09-30` },
    ].filter((d) => d.empresa_id);

    const { error: irErr } = await db.from("declaracoes_ir").insert(declaracoesData);
    if (irErr) throw irErr;
    console.log(`  ${declaracoesData.length} declarações de IR`);
  } catch (err) {
    console.log(
      `  (módulo IR ainda não migrado — pulei declarações: ${err.message})`,
    );
  }

  // histórico
  const hist = tf.slice(0, 8).map((t, i) => ({
    entidade: "tarefa",
    entidade_id: t.id,
    acao: pick(["criou", "alterou_status", "alterou"], i),
    descricao: `Tarefa "${t.titulo}" ${pick(["criada", "atualizada", "movida para Em revisão"], i)}`,
  }));
  await db.from("historico").insert(hist);
  console.log(`  ${hist.length} registros de histórico`);

  console.log("Pronto. Entre no sistema para ver.");
}

async function down() {
  console.log("Removendo dados de demonstração…");
  const { data: empresas } = await db
    .from("empresas")
    .select("id")
    .like("cnpj", "99%");
  const ids = (empresas ?? []).map((e) => e.id);
  if (ids.length) {
    // tarefas internas (sem empresa) criadas pelo demo: apaga por título
    await db
      .from("tarefas")
      .delete()
      .in("titulo", [
        "Atendimento: dúvida sobre pró-labore",
        "Emissão de guias do mês",
      ])
      .is("empresa_id", null);
    await db.from("documentos").delete().in("empresa_id", ids);
    await db.from("tarefas").delete().in("empresa_id", ids);
    try {
      await db.from("obrigacoes").delete().in("empresa_id", ids);
      await db.from("obrigacao_recorrencias").delete().in("empresa_id", ids);
    } catch {
      /* módulo fiscal pode não existir */
    }
    try {
      await db.from("eventos_dp").delete().in("empresa_id", ids);
      await db.from("folhas").delete().in("empresa_id", ids);
      await db.from("funcionarios").delete().in("empresa_id", ids);
    } catch {
      /* módulo pessoal pode não existir */
    }
    try {
      await db.from("fechamentos_contabeis").delete().in("empresa_id", ids);
    } catch {
      /* módulo contábil pode não existir */
    }
    try {
      await db.from("processos_societarios").delete().in("empresa_id", ids);
    } catch {
      /* módulo societário pode não existir */
    }
    try {
      await db.from("declaracoes_ir").delete().in("empresa_id", ids);
    } catch {
      /* módulo IR pode não existir */
    }
    await db.from("contatos").delete().in("empresa_id", ids);
    await db.from("socios").delete().in("empresa_id", ids);
    await db.from("empresas").delete().in("id", ids);
  }
  await db
    .from("eventos_agenda")
    .delete()
    .in("titulo", [
      "Reunião com Agrocampo",
      "Vencimento FGTS",
      "Vencimento DAS",
      "Entrega EFD-Reinf",
      "Ligar para Rota Norte",
      "Fechamento do mês - contábil",
    ]);
  await db.from("historico").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log(`Removidas ${ids.length} empresas e dependências.`);
}

const cmd = process.argv[2];
if (cmd === "up") await up();
else if (cmd === "down") await down();
else console.log("uso: node scripts/seed-demo.mjs [up|down]");
