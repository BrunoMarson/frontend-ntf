import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { AxiosError } from "axios";
import { Eye, EyeOff, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type PropsWithChildren } from "react";
import { fetchCart, login, mergeGuestCart, register } from "../api/client";
import { sessionQuery } from "../api/query";
import { RouteError } from "../components/route-header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { HomeBackdrop } from "./home";
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

function AuthLayout({ mode, redirect, children }: PropsWithChildren<{ mode: "login" | "register"; redirect: string }>) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input:not([type='hidden'])")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        void navigate({ to: "/" });
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate]);

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) void navigate({ to: "/" });
      }}
    >
      <section ref={dialogRef} className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-heading">
        <Button
          className="auth-close"
          variant="ghost"
          size="icon"
          aria-label="Fechar janela de acesso"
          onClick={() => void navigate({ to: "/" })}
        >
          <X aria-hidden="true" />
        </Button>
        <nav className="auth-tabs" aria-label="Acesso à conta">
          <Link className={mode === "login" ? "active" : ""} to="/login" search={{ redirect }}>Entrar</Link>
          <span aria-hidden="true">|</span>
          <Link className={mode === "register" ? "active" : ""} to="/register" search={{ redirect }}>Criar conta</Link>
        </nav>
        <h1 className="sr-only" id="auth-heading">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="auth-subtitle">Entre para gerenciar sua carteira, coleção e perfil de criador.</p>
        {children}
      </section>
    </div>
  );
}

function SocialProviders({ onUnavailable }: { onUnavailable: (provider: string) => void }) {
  return (
    <div className="auth-social">
      <div className="auth-divider"><span>Ou continue com</span></div>
      <Button type="button" variant="outline" onClick={() => onUnavailable("Google")}>
        <span className="social-google" aria-hidden="true">G</span>
        Continuar com Google
      </Button>
      <Button type="button" variant="outline" onClick={() => onUnavailable("Facebook")}>
        <span className="social-facebook" aria-hidden="true">f</span>
        Continuar com Facebook
      </Button>
    </div>
  );
}

export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState("");
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
    <>
      <HomeBackdrop />
      <AuthLayout mode="login" redirect={search.redirect}>
        <form className="auth-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="login-email">E-mail</label>
          <Input id="login-email" name="email" type="email" autoComplete="email" placeholder="contato@email.com" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "login-email-error" : undefined} />
          {fieldErrors.email && <span className="field-error" id="login-email-error">{fieldErrors.email}</span>}
          <label className="sr-only" htmlFor="login-password">Senha</label>
          <div className="auth-password-field">
            <Input id="login-password" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" placeholder="Senha" required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "login-password-error" : undefined} />
            <button type="button" className="auth-password-toggle" aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"} onClick={() => setPasswordVisible((visible) => !visible)}>
              {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          {fieldErrors.password && <span className="field-error" id="login-password-error">{fieldErrors.password}</span>}
          <button className="auth-forgot" type="button" onClick={() => setNotice("A recuperação de senha ainda não está disponível nesta demonstração.")}>Esqueceu a senha?</button>
          {formError && <RouteError message={formError} />}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <SocialProviders onUnavailable={(provider) => setNotice(`O acesso com ${provider} não está disponível nesta demonstração. Entre com e-mail e senha.`)} />
      </AuthLayout>
    </>
  );
}

export function RegisterPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/register" });
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
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
    <>
      <HomeBackdrop />
      <AuthLayout mode="register" redirect={search.redirect}>
        <form className="auth-form register-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="register-name">Nome completo</label>
          <Input id="register-name" name="name" autoComplete="name" placeholder="Nome completo" minLength={2} required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "register-name-error" : undefined} />
          {fieldErrors.name && <span className="field-error" id="register-name-error">{fieldErrors.name}</span>}
          <label className="sr-only" htmlFor="register-email">E-mail</label>
          <Input id="register-email" name="email" type="email" autoComplete="email" placeholder="contato@email.com" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "register-email-error" : undefined} />
          {fieldErrors.email && <span className="field-error" id="register-email-error">{fieldErrors.email}</span>}
          <label className="sr-only" htmlFor="register-password">Senha</label>
          <Input id="register-password" name="password" type="password" autoComplete="new-password" placeholder="Senha" minLength={8} required aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "register-password-error" : undefined} />
          {fieldErrors.password && <span className="field-error" id="register-password-error">{fieldErrors.password}</span>}
          {formError && <RouteError message={formError} />}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
        <SocialProviders onUnavailable={(provider) => setNotice(`O cadastro com ${provider} não está disponível nesta demonstração. Crie sua conta com e-mail e senha.`)} />
      </AuthLayout>
    </>
  );
}
