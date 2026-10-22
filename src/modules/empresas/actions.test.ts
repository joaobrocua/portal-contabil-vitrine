import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/core/auth/session";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";

vi.mock("@/core/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  adicionarContato,
  adicionarSocio,
  alternarAtivoEmpresa,
  atualizarEmpresa,
  criarEmpresa,
  removerContato,
  removerSocio,
} = await import("./actions");

const requireRoleMock = vi.mocked(requireRole);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const SESSION = {
  userId: "user-1",
  profile: { papel: "admin" },
} as unknown as Awaited<ReturnType<typeof requireRole>>;

const SESSION_FISCAL = {
  userId: "user-2",
  profile: { papel: "fiscal" },
} as unknown as Awaited<ReturnType<typeof requireRole>>;
const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRoleMock.mockResolvedValue(SESSION);
});

const EMPRESA_VALIDA = {
  razao_social: "ABC Comércio LTDA",
  cnpj: "11.222.333/0001-81",
  regime_tributario: "simples_nacional",
};

/**
 * Cliente falso: `empresas` (insert/update) e `empresa_honorarios`
 * (upsert/delete) separados, para provar que o honorário vai para a tabela
 * própria — e que a linha da empresa nunca leva o campo.
 */
function clienteFalso(opts: {
  insertData?: unknown;
  empresaError?: unknown;
  honorarioError?: unknown;
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: opts.insertData ?? { id: "nova-empresa" },
    error: opts.empresaError ?? null,
  });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const eqUpdate = vi.fn().mockResolvedValue({ error: opts.empresaError ?? null });
  const update = vi.fn(() => ({ eq: eqUpdate }));
  const upsert = vi.fn().mockResolvedValue({ error: opts.honorarioError ?? null });
  const eqDelete = vi.fn().mockResolvedValue({ error: opts.honorarioError ?? null });
  const del = vi.fn(() => ({ eq: eqDelete }));
  const from = vi.fn((tabela: string) =>
    tabela === "empresa_honorarios" ? { upsert, delete: del } : { insert, update },
  );
  serverClientMock.mockResolvedValue({ from } as unknown as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >);
  return { insert, update, eqUpdate, upsert, del, eqDelete, from };
}

describe("criarEmpresa", () => {
  it("exige um papel interno", async () => {
    clienteFalso();
    await criarEmpresa(null, formData(EMPRESA_VALIDA));
    expect(requireRoleMock).toHaveBeenCalled();
  });

  it("cria a empresa e registra histórico no caminho feliz", async () => {
    clienteFalso({ insertData: { id: "nova-empresa" } });
    const r = await criarEmpresa(null, formData(EMPRESA_VALIDA));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("nova-empresa");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "empresa", entidadeId: "nova-empresa" }),
    );
  });

  it("rejeita CNPJ inválido antes de tocar o banco", async () => {
    const { insert } = clienteFalso();
    const r = await criarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, cnpj: "11.222.333/0001-82" }),
    );
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("traduz violação de CNPJ duplicado (23505) numa mensagem amigável", async () => {
    clienteFalso({ empresaError: { code: "23505" } });
    const r = await criarEmpresa(null, formData(EMPRESA_VALIDA));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/já existe/i);
  });

  it("admin: o honorário vai para empresa_honorarios, não para a linha da empresa", async () => {
    const { insert, upsert } = clienteFalso();
    const r = await criarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, honorario_mensal: "1500,00" }),
    );
    expect(r.ok).toBe(true);
    const linha = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(linha).not.toHaveProperty("honorario_mensal");
    expect(upsert).toHaveBeenCalledWith(
      { empresa_id: "nova-empresa", valor: 1500 },
      { onConflict: "empresa_id" },
    );
  });

  it("admin sem honorário informado: não grava nada em empresa_honorarios", async () => {
    const { upsert, del } = clienteFalso();
    await criarEmpresa(null, formData(EMPRESA_VALIDA));
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("staff não-admin: honorário enviado é ignorado (nem a tabela é tocada)", async () => {
    requireRoleMock.mockResolvedValue(SESSION_FISCAL);
    const { insert, upsert, from } = clienteFalso();
    await criarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, honorario_mensal: "1500,00" }),
    );
    const linha = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(linha).not.toHaveProperty("honorario_mensal");
    expect(upsert).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("empresa_honorarios");
  });

  it("se o honorário falha depois de criar a empresa, avisa (e não some em silêncio)", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    clienteFalso({ honorarioError: { message: "boom" } });
    const r = await criarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, honorario_mensal: "1500,00" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/honorário/i);
    // A empresa já existe: o histórico foi registrado mesmo com o honorário falhando.
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "empresa", entidadeId: "nova-empresa" }),
    );
    erro.mockRestore();
  });
});

describe("atualizarEmpresa", () => {
  it("recusa sem id de empresa", async () => {
    clienteFalso();
    const r = await atualizarEmpresa(null, formData(EMPRESA_VALIDA));
    expect(r.ok).toBe(false);
  });

  it("atualiza e revalida a página específica e a lista", async () => {
    const { eqUpdate } = clienteFalso();
    const r = await atualizarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID }),
    );
    expect(r.ok).toBe(true);
    expect(eqUpdate).toHaveBeenCalledWith("id", EMPRESA_ID);
  });

  it("traduz violação de CNPJ duplicado (23505)", async () => {
    clienteFalso({ empresaError: { code: "23505" } });
    const r = await atualizarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/já existe/i);
  });

  it("admin: grava o honorário na tabela própria, sem mandá-lo na linha da empresa", async () => {
    const { update, upsert } = clienteFalso();
    await atualizarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID, honorario_mensal: "2000,00" }),
    );
    const linha = (update.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(linha).not.toHaveProperty("honorario_mensal");
    expect(upsert).toHaveBeenCalledWith(
      { empresa_id: EMPRESA_ID, valor: 2000 },
      { onConflict: "empresa_id" },
    );
  });

  it("admin: campo de honorário vazio apaga o valor", async () => {
    const { del, eqDelete, upsert } = clienteFalso();
    await atualizarEmpresa(null, formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID }));
    expect(upsert).not.toHaveBeenCalled();
    expect(del).toHaveBeenCalled();
    expect(eqDelete).toHaveBeenCalledWith("empresa_id", EMPRESA_ID);
  });

  it("staff não-admin: não toca no honorário — campo vazio não zera o valor que já existe", async () => {
    requireRoleMock.mockResolvedValue(SESSION_FISCAL);
    const { upsert, del, from } = clienteFalso();
    // Como ficaria se o input estivesse oculto na tela para quem não é admin.
    await atualizarEmpresa(null, formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID }));
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith("empresa_honorarios");
  });

  it("se o honorário falha, avisa que os demais dados foram salvos", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    clienteFalso({ honorarioError: { message: "boom" } });
    const r = await atualizarEmpresa(
      null,
      formData({ ...EMPRESA_VALIDA, id: EMPRESA_ID, honorario_mensal: "2000,00" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/dados foram salvos/i);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "empresa", entidadeId: EMPRESA_ID }),
    );
    erro.mockRestore();
  });
});

describe("alternarAtivoEmpresa", () => {
  it("exige papel admin (não qualquer staff — inativar afeta todo mundo)", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await alternarAtivoEmpresa(EMPRESA_ID, false);
    expect(requireRoleMock).toHaveBeenCalledWith("admin");
  });

  it("ativa/inativa e descreve a ação certa no histórico", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    await alternarAtivoEmpresa(EMPRESA_ID, false);
    expect(update).toHaveBeenCalledWith({ ativo: false });
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "inativou" }),
    );

    await alternarAtivoEmpresa(EMPRESA_ID, true);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "reativou" }),
    );
  });
});

describe("sócios", () => {
  const SOCIO_VALIDO = {
    empresa_id: EMPRESA_ID,
    nome: "Carlos Henrique Almeida",
    cpf: "529.982.247-25",
  };

  it("adicionarSocio insere o sócio válido", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await adicionarSocio(null, formData(SOCIO_VALIDO));
    expect(r.ok).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Carlos Henrique Almeida" }),
    );
  });

  it("adicionarSocio rejeita CPF inválido", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await adicionarSocio(
      null,
      formData({ ...SOCIO_VALIDO, cpf: "111.111.111-11" }),
    );
    expect(r.ok).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("removerSocio deleta, busca o nome pra descrever no histórico e registra a exclusão", async () => {
    const single = vi.fn().mockResolvedValue({ data: { nome: "Sócio Removido" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await removerSocio("socio-1", EMPRESA_ID);
    expect(r.ok).toBe(true);
    expect(deleteEq).toHaveBeenCalledWith("id", "socio-1");
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entidade: "empresa",
        entidadeId: EMPRESA_ID,
        acao: "excluiu",
        descricao: expect.stringContaining("Sócio Removido"),
      }),
    );
  });

  it("removerSocio ainda registra o histórico (com o id) mesmo se o nome não for encontrado", async () => {
    const single = vi.fn().mockResolvedValue({ data: null });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await removerSocio("socio-1", EMPRESA_ID);
    expect(r.ok).toBe(true);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: expect.stringContaining("socio-1") }),
    );
  });

  it("removerSocio dá mensagem amigável quando há declaração de IR vinculada (FK restrict)", async () => {
    const single = vi.fn().mockResolvedValue({ data: { nome: "Sócio Com IR" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({
      error: { code: "23503", message: "violates foreign key constraint" },
    });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await removerSocio("socio-1", EMPRESA_ID);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/declarações de IR/i);
      expect(r.error).not.toMatch(/constraint|violates/i);
    }
    expect(registrarHistoricoMock).not.toHaveBeenCalled();
  });
});

describe("contatos", () => {
  const CONTATO_VALIDO = { empresa_id: EMPRESA_ID, nome: "Financeiro" };

  it("adicionarContato insere o contato válido", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ insert })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await adicionarContato(null, formData(CONTATO_VALIDO));
    expect(r.ok).toBe(true);
  });

  it("removerContato deleta e registra o histórico", async () => {
    const single = vi.fn().mockResolvedValue({ data: { nome: "Contato Removido" } });
    const selectEq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn(() => ({ eq: deleteEq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ select, delete: del })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const r = await removerContato("contato-1", EMPRESA_ID);
    expect(r.ok).toBe(true);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ descricao: expect.stringContaining("Contato Removido") }),
    );
  });
});
