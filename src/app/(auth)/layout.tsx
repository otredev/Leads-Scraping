/** Pantallas de acceso (sin menú lateral): iniciar sesión, crear cuenta y recuperar la contraseña. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-bg">{children}</div>;
}
