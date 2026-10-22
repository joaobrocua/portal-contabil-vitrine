import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole, requireSession } from "@/core/auth/session";
import { createSupabaseAdminClient } from "@/core/db/admin";
import { createSupabaseServerClient } from "@/core/db/server";
import { registrarHistorico } from "@/core/lib/historico";
import { PAPEIS_INTERNOS } from "@/core/types/domain";

vi.mock("@/core/auth/session", () => ({
  requireRole: vi.fn(),
  requireSession: vi.fn(),
}));
vi.mock("@/core/db/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/core/db/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/core/lib/historico", () => ({ registrarHistorico: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { excluirDocumento, registrarDocumento, revisarDocumento, urlDownload } = await import(
  "./actions"
);

const requireRoleMock = vi.mocked(requireRole);
const requireSessionMock = vi.mocked(requireSession);
const serverClientMock = vi.mocked(createSupabaseServerClient);
const adminClientMock = vi.mocked(createSupabaseAdminClient);
const registrarHistoricoMock = vi.mocked(registrarHistorico);

const EMPRESA_ID = "550e8400-e29b-41d4-a716-446655440000";

const SESSION_STAFF = {
  userId: "staff-1",
  profile: { papel: "fiscal" },
} as unknown as Awaited<ReturnType<typeof requireSession>>;

const SESSION_CLIENTE = {
  userId: "cliente-1",
  profile: { papel: "cliente" },
} as unknown as Awaited<ReturnType<typeof requireSession>>;

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const PDF_REAL = new TextEncoder().encode("%PDF-1.4\nconteudo de teste");
const HTML_DISFARCADO = new TextEncoder().encode(
  "<html><body><script>alert(1)</script></body></html>",
);

function mockStorageDownload(bytes: Uint8Array) {
  return {
    arrayBuffer: () => Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireSessionMock.mockResolvedValue(SESSION_STAFF);
  requireRoleMock.mockResolvedValue(SESSION_STAFF);
});

describe("registrarDocumento", () => {
  const CAMPOS_VALIDOS = {
    empresa_id: EMPRESA_ID,
    departamento: "fiscal",
    titulo: "Guia DAS",
    storage_path: `${EMPRESA_ID}/guia-das.pdf`,
    mime: "application/pdf",
  };

  function mockServerClient(opts: {
    downloadBytes?: Uint8Array;
    downloadError?: unknown;
    insertData?: unknown;
    insertError?: unknown;
    /** o caminho do arquivo já pertence a um documento registrado */
    jaRegistrado?: boolean;
  } = {}) {
    adminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.jaRegistrado ? { id: "doc-existente" } : null }),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);
    const single = vi.fn().mockResolvedValue({
      data: opts.insertData ?? { id: "doc-1" },
      error: opts.insertError ?? null,
    });
    const select = vi.fn(() => ({ single }));
    const insertDocumentos = vi.fn(() => ({ select }));
    const insertAcessos = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const download = vi.fn().mockResolvedValue({
      data: opts.downloadError
        ? null
        : mockStorageDownload(opts.downloadBytes ?? PDF_REAL),
      error: opts.downloadError ?? null,
    });

    serverClientMock.mockResolvedValue({
      storage: { from: vi.fn(() => ({ download, remove })) },
      from: vi.fn((tabela: string) =>
        tabela === "documentos"
          ? { insert: insertDocumentos }
          : { insert: insertAcessos },
      ),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    return { insertDocumentos, insertAcessos, download, remove };
  }

  it("staff de outro departamento NÃO registra documento do Pessoal — recusa e apaga o arquivo enviado", async () => {
    const { insertDocumentos, download, remove } = mockServerClient();
    const r = await registrarDocumento(null, formData({ ...CAMPOS_VALIDOS, departamento: "pessoal" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Pessoal ou pelo administrador/);
    expect(remove).toHaveBeenCalledWith([CAMPOS_VALIDOS.storage_path]);
    expect(download).not.toHaveBeenCalled();
    expect(insertDocumentos).not.toHaveBeenCalled();
  });

  it("o Pessoal e o admin registram documento do Pessoal", async () => {
    for (const papel of ["pessoal", "admin"]) {
      requireSessionMock.mockResolvedValue({ userId: "u", profile: { papel } } as unknown as Awaited<ReturnType<typeof requireSession>>);
      mockServerClient();
      const r = await registrarDocumento(null, formData({ ...CAMPOS_VALIDOS, departamento: "pessoal" }));
      expect(r.ok).toBe(true);
    }
  });

  it("o cliente pode enviar para qualquer departamento (fica na pasta da própria empresa)", async () => {
    requireSessionMock.mockResolvedValue(SESSION_CLIENTE);
    mockServerClient();
    const r = await registrarDocumento(null, formData({ ...CAMPOS_VALIDOS, departamento: "pessoal" }));
    expect(r.ok).toBe(true);
  });

  it("NÃO apaga o arquivo quando o caminho já pertence a um documento (retry/pedido repetido)", async () => {
    const { remove } = mockServerClient({ insertError: { code: "23505", message: "duplicate key" }, jaRegistrado: true });
    const r = await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("nem na recusa por departamento: arquivo de documento já registrado não é apagado", async () => {
    const { remove } = mockServerClient({ jaRegistrado: true });
    const r = await registrarDocumento(null, formData({ ...CAMPOS_VALIDOS, departamento: "pessoal" }));
    expect(r.ok).toBe(false);
    expect(remove).not.toHaveBeenCalled();
  });

  it("exige uma sessão autenticada", async () => {
    mockServerClient();
    await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(requireSessionMock).toHaveBeenCalled();
  });

  it("aceita um PDF de verdade declarado como PDF", async () => {
    const { insertDocumentos } = mockServerClient({ downloadBytes: PDF_REAL });
    const r = await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(true);
    expect(insertDocumentos).toHaveBeenCalled();
  });

  it("rejeita e apaga do storage quando o conteúdo não bate com o MIME declarado", async () => {
    const { insertDocumentos, remove } = mockServerClient({
      downloadBytes: HTML_DISFARCADO,
    });
    const r = await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(insertDocumentos).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([CAMPOS_VALIDOS.storage_path]);
  });

  it("marca origem 'escritorio' e status 'recebido' quando enviado por staff", async () => {
    const { insertDocumentos } = mockServerClient();
    await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(insertDocumentos).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "escritorio", status: "recebido" }),
    );
  });

  it("marca origem 'cliente' e status 'pendente' quando enviado por um cliente", async () => {
    requireSessionMock.mockResolvedValue(SESSION_CLIENTE);
    const { insertDocumentos } = mockServerClient();
    await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(insertDocumentos).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "cliente", status: "pendente" }),
    );
  });

  it("rejeita storage_path de outra empresa (schema) sem sequer baixar o arquivo", async () => {
    const { download } = mockServerClient();
    const r = await registrarDocumento(
      null,
      formData({
        ...CAMPOS_VALIDOS,
        storage_path: "660e8400-e29b-41d4-a716-446655440001/arquivo.pdf",
      }),
    );
    expect(r.ok).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });

  it("registra o acesso de upload e o histórico no caminho feliz", async () => {
    const { insertAcessos } = mockServerClient({ insertData: { id: "doc-novo" } });
    await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(insertAcessos).toHaveBeenCalledWith(
      expect.objectContaining({
        documento_id: "doc-novo",
        profile_id: "staff-1",
        acao: "upload",
      }),
    );
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: "documento", entidadeId: "doc-novo" }),
    );
  });

  it("sem mime declarado, deriva da extensão e AINDA verifica a assinatura (não pula mais)", async () => {
    const { download, insertDocumentos } = mockServerClient({
      downloadBytes: PDF_REAL,
    });
    const { mime, ...semMime } = CAMPOS_VALIDOS; // storage_path termina em .pdf
    void mime;
    const r = await registrarDocumento(null, formData(semMime));
    expect(r.ok).toBe(true);
    expect(download).toHaveBeenCalled();
    expect(insertDocumentos).toHaveBeenCalledWith(
      expect.objectContaining({ mime: "application/pdf" }),
    );
  });

  it("sem mime declarado, rejeita e apaga do storage se o conteúdo não bate com o esperado pela extensão", async () => {
    const { insertDocumentos, remove } = mockServerClient({
      downloadBytes: HTML_DISFARCADO,
    });
    const { mime, ...semMime } = CAMPOS_VALIDOS;
    void mime;
    const r = await registrarDocumento(null, formData(semMime));
    expect(r.ok).toBe(false);
    expect(insertDocumentos).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([CAMPOS_VALIDOS.storage_path]);
  });

  it("apaga do storage quando o download pra verificação falha (não fica arquivo órfão)", async () => {
    const { insertDocumentos, remove } = mockServerClient({
      downloadError: { message: "falha de rede" },
    });
    const r = await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(insertDocumentos).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([CAMPOS_VALIDOS.storage_path]);
  });

  it("apaga do storage quando o insert em documentos falha (não fica arquivo órfão)", async () => {
    const { remove } = mockServerClient({
      downloadBytes: PDF_REAL,
      insertError: { message: "erro genérico do banco" },
    });
    const r = await registrarDocumento(null, formData(CAMPOS_VALIDOS));
    expect(r.ok).toBe(false);
    expect(remove).toHaveBeenCalledWith([CAMPOS_VALIDOS.storage_path]);
  });
});

describe("revisarDocumento", () => {
  function mockServerClient(error: unknown = null) {
    const eq = vi.fn().mockResolvedValue({ error });
    const update = vi.fn(() => ({ eq }));
    serverClientMock.mockResolvedValue({
      from: vi.fn(() => ({ update })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { update, eq };
  }

  it("exige um papel interno (não um cliente)", async () => {
    mockServerClient();
    await revisarDocumento(
      null,
      formData({ id: "550e8400-e29b-41d4-a716-446655440000", status: "aprovado" }),
    );
    expect(requireRoleMock).toHaveBeenCalled();
  });

  it("marca revisado_por/revisado_em e registra histórico", async () => {
    const { update } = mockServerClient();
    const r = await revisarDocumento(
      null,
      formData({ id: "550e8400-e29b-41d4-a716-446655440000", status: "correcao", observacao: "faltou o CNPJ" }),
    );
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "correcao",
        revisado_por: expect.any(String),
      }),
    );
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ para: "correcao" }),
    );
  });

  it("rejeita status fora do enum", async () => {
    mockServerClient();
    const r = await revisarDocumento(
      null,
      formData({ id: "550e8400-e29b-41d4-a716-446655440000", status: "invalido" }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("urlDownload", () => {
  function mockDownload(opts: {
    doc: { storage_path: string } | null;
    signed?: { data: unknown; error: unknown };
  }) {
    const createSignedUrl = vi
      .fn()
      .mockResolvedValue(
        opts.signed ?? { data: { signedUrl: "https://sign.ed/url" }, error: null },
      );
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: opts.doc });
    serverClientMock.mockResolvedValue({
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
        insert,
      })),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { createSignedUrl, insert };
  }

  it("assina o caminho gravado no banco e registra o acesso de download", async () => {
    const { createSignedUrl, insert } = mockDownload({
      doc: { storage_path: `${EMPRESA_ID}/guia.pdf` },
    });

    const r = await urlDownload("doc-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.url).toBe("https://sign.ed/url");
    expect(createSignedUrl).toHaveBeenCalledWith(`${EMPRESA_ID}/guia.pdf`, 60);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ documento_id: "doc-1", acao: "download" }),
    );
  });

  it("recusa documento inexistente/invisível sem gerar URL nem registrar acesso", async () => {
    const { createSignedUrl, insert } = mockDownload({ doc: null });
    const r = await urlDownload("doc-x");
    expect(r.ok).toBe(false);
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("propaga erro ao gerar a URL", async () => {
    mockDownload({
      doc: { storage_path: `${EMPRESA_ID}/guia.pdf` },
      signed: { data: null, error: { message: "arquivo não existe" } },
    });
    const r = await urlDownload("doc-1");
    expect(r.ok).toBe(false);
  });
});

describe("excluirDocumento", () => {
  function mockExclusao(opts: {
    doc: unknown;
    trilhaError?: unknown;
    deleteError?: unknown;
    /** linhas que a RLS deixou apagar (padrão: 1) */
    apagados?: unknown[];
    storageError?: unknown;
  }) {
    const ordem: string[] = [];
    const trilhaInsert = vi.fn(async () => {
      ordem.push("trilha");
      return { error: opts.trilhaError ?? null };
    });
    const deleteSelect = vi.fn(async () => {
      ordem.push("delete");
      return { data: opts.deleteError ? null : (opts.apagados ?? [{ id: "doc-1" }]), error: opts.deleteError ?? null };
    });
    const deleteEq = vi.fn(() => ({ select: deleteSelect }));
    // O arquivo é removido pelo cliente de SERVIÇO (servidor), não pelo do usuário.
    const removeAdmin = vi.fn(async () => {
      ordem.push("arquivo");
      return { error: opts.storageError ?? null };
    });
    const removeUsuario = vi.fn();
    adminClientMock.mockReturnValue({
      storage: { from: vi.fn(() => ({ remove: removeAdmin })) },
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);
    serverClientMock.mockResolvedValue({
      storage: { from: vi.fn(() => ({ remove: removeUsuario })) },
      from: vi.fn((tabela: string) =>
        tabela === "documento_acessos"
          ? { insert: trilhaInsert }
          : {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: opts.doc }),
                })),
              })),
              delete: vi.fn(() => ({ eq: deleteEq })),
            },
      ),
    } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    return { ordem, trilhaInsert, deleteEq, removeAdmin, removeUsuario };
  }
  const DOC = { id: "doc-1", titulo: "Contrato", storage_path: `${EMPRESA_ID}/c.pdf`, empresa_id: EMPRESA_ID };

  it("registra na trilha ANTES de excluir, depois apaga registro e arquivo", async () => {
    const { ordem, trilhaInsert, removeAdmin } = mockExclusao({ doc: DOC });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(true);
    expect(ordem).toEqual(["trilha", "delete", "arquivo"]);
    expect(trilhaInsert).toHaveBeenCalledWith(
      expect.objectContaining({ documento_id: "doc-1", acao: "excluiu", profile_id: "staff-1" }),
    );
    expect(removeAdmin).toHaveBeenCalledWith([`${EMPRESA_ID}/c.pdf`]);
    expect(registrarHistoricoMock).toHaveBeenCalledWith(
      expect.objectContaining({ acao: "excluiu", descricao: expect.stringContaining("Contrato") }),
    );
  });

  it("linha forjada com caminho fora da pasta da empresa: o arquivo NÃO é apagado", async () => {
    const { removeAdmin } = mockExclusao({ doc: { ...DOC, storage_path: "outra-pasta/arquivo.pdf" } });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(true);
    expect(removeAdmin).not.toHaveBeenCalled();
    // a exclusão do registro segue o fluxo normal: histórico registrado
    expect(registrarHistoricoMock).toHaveBeenCalledWith(expect.objectContaining({ acao: "excluiu" }));
  });

  it("o arquivo é removido pelo servidor (chave de serviço), nunca pelo cliente do usuário", async () => {
    const { removeUsuario } = mockExclusao({ doc: DOC });
    await excluirDocumento("doc-1");
    expect(removeUsuario).not.toHaveBeenCalled();
  });

  it("RLS que barra a exclusão devolve ZERO linhas (sem erro): o arquivo NÃO pode ser apagado", async () => {
    const { ordem, removeAdmin } = mockExclusao({ doc: DOC, apagados: [] });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/permissão/i);
    expect(removeAdmin).not.toHaveBeenCalled();
    expect(ordem).toEqual(["trilha", "delete"]);
    expect(registrarHistoricoMock).not.toHaveBeenCalled();
  });

  it("se não conseguir registrar na trilha, não exclui nada", async () => {
    const { ordem } = mockExclusao({ doc: DOC, trilhaError: { code: "42501", message: "rls" } });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(false);
    expect(ordem).toEqual(["trilha"]);
  });

  it("se o banco recusar a exclusão, o arquivo fica", async () => {
    const { ordem, removeAdmin } = mockExclusao({ doc: DOC, deleteError: { code: "42501", message: "rls" } });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(false);
    expect(ordem).toEqual(["trilha", "delete"]);
    expect(removeAdmin).not.toHaveBeenCalled();
  });

  it("falha ao remover o arquivo não desfaz a exclusão (sobra só um órfão, vai pro log)", async () => {
    mockExclusao({ doc: DOC, storageError: { message: "boom" } });
    const r = await excluirDocumento("doc-1");
    expect(r.ok).toBe(true);
  });

  it("documento inexistente ou invisível", async () => {
    const { ordem } = mockExclusao({ doc: null });
    const r = await excluirDocumento("doc-x");
    expect(r.ok).toBe(false);
    expect(ordem).toEqual([]);
  });

  it("só equipe do escritório", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
    await expect(excluirDocumento("doc-1")).rejects.toThrow();
    expect(requireRoleMock).toHaveBeenCalledWith(...PAPEIS_INTERNOS);
  });
});
