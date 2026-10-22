"use client";

import { useState, useTransition } from "react";

import { formatData } from "@/core/lib/format";
import {
  DEPARTAMENTO_LABEL,
  PAPEL_LABEL,
  type Departamento,
  type Papel,
} from "@/core/types/domain";
import type { ProfileRow } from "@/core/db/types";
import {
  Badge,
  Button,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/core/ui";

import { atualizarUsuario, redefinirSenhaUsuario } from "../actions";

/** Senha provisória pra quem esqueceu a própria (sem e-mail de
 * recuperação, é o admin que resolve). Some depois de salvar. */
function RedefinirSenha({ id, nome }: { id: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [pending, start] = useTransition();

  function salvar() {
    setMsg(null);
    start(async () => {
      const res = await redefinirSenhaUsuario({ id, senha });
      if (res.ok) {
        setSenha("");
        setAberto(false);
        setMsg({
          ok: true,
          texto: `Senha de ${nome} redefinida. Passe a senha provisória pra pessoa e peça pra trocar em Minha conta.`,
        });
      } else {
        setMsg({ ok: false, texto: res.error });
      }
    });
  }

  return (
    <div className="mt-1 space-y-1">
      {aberto ? (
        <div className="flex items-center gap-2">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Senha provisória (mín. 8)"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="h-8 w-48"
          />
          <Button size="sm" onClick={salvar} disabled={pending || senha.length < 8}>
            {pending ? "…" : "Definir"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAberto(false);
              setSenha("");
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAberto(true);
            setMsg(null);
          }}
          className="text-xs text-[var(--color-text-dim)] underline-offset-2 hover:text-[var(--color-text)] hover:underline"
        >
          Redefinir senha
        </button>
      )}
      {msg ? (
        <p
          className={
            msg.ok
              ? "text-xs text-[var(--color-info)]"
              : "text-xs text-[var(--color-carmine-bright)]"
          }
        >
          {msg.texto}
        </p>
      ) : null}
    </div>
  );
}

const PAPEIS: Papel[] = [
  "admin",
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "atendimento",
  "cliente",
];
const DEPS: Departamento[] = [
  "fiscal",
  "pessoal",
  "contabil",
  "societario",
  "ir",
  "atendimento",
  "geral",
];

function Linha({ u, isSelf }: { u: ProfileRow; isSelf: boolean }) {
  const [papel, setPapel] = useState<Papel>(u.papel);
  const [dep, setDep] = useState<string>(u.departamento ?? "");
  const [ativo, setAtivo] = useState(u.ativo);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const dirty =
    papel !== u.papel ||
    dep !== (u.departamento ?? "") ||
    ativo !== u.ativo;

  function salvar() {
    setErro(null);
    start(async () => {
      const res = await atualizarUsuario({
        id: u.id,
        papel,
        departamento: dep || null,
        ativo,
      });
      if (!res.ok) setErro(res.error);
    });
  }

  return (
    <TR>
      <TD>
        <p className="font-medium text-neutral-900">{u.nome}</p>
        <p className="text-xs text-neutral-400">{u.email}</p>
        {erro ? <p className="text-xs text-[var(--color-carmine-bright)]">{erro}</p> : null}
        {isSelf ? null : <RedefinirSenha id={u.id} nome={u.nome} />}
      </TD>
      <TD>
        <Select
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
          className="h-8 w-auto"
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {PAPEL_LABEL[p]}
            </option>
          ))}
        </Select>
      </TD>
      <TD>
        <Select
          value={dep}
          onChange={(e) => setDep(e.target.value)}
          className="h-8 w-auto"
        >
          <option value="">—</option>
          {DEPS.map((d) => (
            <option key={d} value={d}>
              {DEPARTAMENTO_LABEL[d]}
            </option>
          ))}
        </Select>
      </TD>
      <TD>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ativo}
            disabled={isSelf}
            onChange={(e) => setAtivo(e.target.checked)}
            className="size-4 accent-[var(--color-brand)]"
          />
          {ativo ? "Ativo" : "Inativo"}
        </label>
      </TD>
      <TD className="text-xs text-neutral-400">{formatData(u.created_at)}</TD>
      <TD>
        {dirty ? (
          <Button size="sm" onClick={salvar} disabled={pending}>
            {pending ? "…" : "Salvar"}
          </Button>
        ) : (
          <Badge tone="neutral">—</Badge>
        )}
      </TD>
    </TR>
  );
}

export function UsuariosTable({
  usuarios,
  selfId,
}: {
  usuarios: ProfileRow[];
  selfId: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-[var(--color-surface)]">
      <Table>
        <THead>
          <TR>
            <TH>Usuário</TH>
            <TH>Papel</TH>
            <TH>Departamento</TH>
            <TH>Situação</TH>
            <TH>Desde</TH>
            <TH></TH>
          </TR>
        </THead>
        <TBody>
          {usuarios.map((u) => (
            <Linha key={u.id} u={u} isSelf={u.id === selfId} />
          ))}
        </TBody>
      </Table>
    </div>
  );
}
