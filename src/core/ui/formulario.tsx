"use client";

import * as React from "react";

/**
 * `<form>` que NÃO apaga o que foi digitado quando o servidor recusa.
 *
 * No React 19, `<form action={fn}>` limpa todos os campos assim que a
 * action termina — mesmo quando ela devolve erro de validação. Resultado:
 * o usuário via "verifique os campos" e tinha que preencher tudo de novo.
 * Aqui o envio passa por `onSubmit` + transition, que chama a mesma action
 * (o `pending` do useActionState continua funcionando) sem o reset
 * automático. Formulários que devem limpar depois de salvar (ex. adicionar
 * sócio) já fazem isso explicitamente com `ref.current.reset()`.
 */
export function Formulario({
  action,
  ref,
  ...props
}: Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (formData: FormData) => void;
  ref?: React.Ref<HTMLFormElement>;
}) {
  const [, start] = React.useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(e.currentTarget, submitter);
    start(() => action(dados));
  }

  return <form ref={ref} onSubmit={enviar} {...props} />;
}
