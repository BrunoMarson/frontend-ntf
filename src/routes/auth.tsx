import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AxiosError } from "axios";
import { useState, type FormEvent } from "react";
import { fetchCart, login, mergeGuestCart, register } from "../api/client";
import { sessionQuery } from "../api/query";
import { RouteError } from "../components/route-header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { Cart, CollectorSession } from "../types/artwork";

interface ApiErrorBody {
  message?: string;
  fields?: Record<string, string>;
}

function getApiError(error: unknown) {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return {
      message: body?.message ?? error.message,
      fields: body?.fields ?? {},
    };
  }
  return { message: error instanceof Error ? error.message : "Não foi possível concluir a operação.", fields: {} };
}

async function establishSession(
  authenticate: () => ReturnType<typeof login> | ReturnType<typeof register>,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  const guestCart = await fetchCart();
  const session = await authenticate();
  queryClient.clear();
  const { token: _token, ...sessionData } = session;
  queryClient.setQueryData<CollectorSession>(sessionQuery.queryKey, sessionData);
  const mergedCart = await mergeGuestCart(guestCart.items.map((item) => ({
    artworkId: item.artwork.id,
    quantity: item.quantity,
  })));
  await queryClient.invalidateQueries();
  queryClient.setQueryData<Cart>(["cart"], mergedCart);
  return session;
}

function safeRedirect(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" to="/">KURIO</Link>
      <section className="auth-card" aria-labelledby="auth-heading">
        <h1 id="auth-heading">{title}</h1>
        <p>{subtitle}</p>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}

export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) =>
      establishSession(() => login(credentials), queryClient),
    onSuccess: async () => {
      await navigate({ to: safeRedirect(search.redirect) });
    },
    onError: (error) => {
      const result = getApiError(error);
      setFormError(result.message);
      setFieldErrors(result.fields);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  return (
    <AuthLayout
      title="Entre na sua conta"
      subtitle="Acesse sua coleção e continue de onde parou."
      footer={<>Ainda não tem uma conta? <Link to="/register" search={{ redirect: search.redirect }}>Cadastre-se</Link></>}
    >
      <form className="form-stack" onSubmit={submit}>
        <label htmlFor="login-email">E-mail</label>
        <Input id="login-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "login-email-error" : undefined} />
        {fieldErrors.email && <span className="field-error" id="login-email-error">{fieldErrors.email}</span>}
        <label htmlFor="login-password">Senha</label>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} />
        {fieldErrors.password && <span className="field-error" id="login-password-error">{fieldErrors.password}</span>}
        {formError && <RouteError message={formError} />}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <div className="demo-credentials">
        <strong>Contas fictícias para avaliação</strong>
        <span>colecionador@kurio.test · Kurio123!</span>
        <span>sara@kurio.test · Nft2026!</span>
      </div>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/register" });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: async (details: { name: string; email: string; password: string }) =>
      establishSession(() => register(details), queryClient),
    onSuccess: async () => {
      await navigate({ to: safeRedirect(search.redirect) });
    },
    onError: (error) => {
      const result = getApiError(error);
      setFormError(result.message);
      setFieldErrors(result.fields);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    const formData = new FormData(event.currentTarget);
    mutation.mutate({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  }

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Cadastre-se para favoritar obras e concluir compras."
      footer={<>Já tem uma conta? <Link to="/login" search={{ redirect: search.redirect }}>Entrar</Link></>}
    >
      <form className="form-stack" onSubmit={submit}>
        <label htmlFor="register-name">Nome completo</label>
        <Input id="register-name" name="name" autoComplete="name" minLength={2} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "register-name-error" : undefined} />
        {fieldErrors.name && <span className="field-error" id="register-name-error">{fieldErrors.name}</span>}
        <label htmlFor="register-email">E-mail</label>
        <Input id="register-email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "register-email-error" : undefined} />
        {fieldErrors.email && <span className="field-error" id="register-email-error">{fieldErrors.email}</span>}
        <label htmlFor="register-password">Senha</label>
        <Input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "register-password-error" : undefined} />
        {fieldErrors.password && <span className="field-error" id="register-password-error">{fieldErrors.password}</span>}
        {formError && <RouteError message={formError} />}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </AuthLayout>
  );
}
