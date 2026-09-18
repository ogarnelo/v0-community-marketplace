export type AuthErrorContext = "signup" | "login" | "forgot";

type AuthErrorLike = {
  code?: unknown;
  message?: unknown;
};

export function getAuthErrorMessage(error: AuthErrorLike | null | undefined, context: AuthErrorContext) {
  const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  const normalizedMessage = message.toLowerCase();

  if (
    code === "email_address_not_authorized" ||
    normalizedMessage.includes("error sending confirmation email") ||
    normalizedMessage.includes("email address not authorized")
  ) {
    return "No hemos podido enviar el email de activación y la cuenta no se ha creado. Inténtalo de nuevo cuando el servicio de correo esté disponible.";
  }

  if (code === "captcha_failed" || normalizedMessage.includes("captcha")) {
    return "No se pudo validar la verificación de seguridad. Vuelve a completarla e inténtalo de nuevo.";
  }

  if (
    code === "email_not_confirmed" ||
    normalizedMessage.includes("email not confirmed") ||
    normalizedMessage.includes("email address not confirmed")
  ) {
    return "Antes de iniciar sesión tienes que activar tu cuenta desde el email de confirmación. Revisa también Spam o Correo no deseado.";
  }

  if (
    code === "invalid_credentials" ||
    normalizedMessage.includes("invalid login credentials")
  ) {
    return "Email o contraseña incorrectos.";
  }

  if (
    code === "user_already_exists" ||
    normalizedMessage.includes("user already registered") ||
    normalizedMessage.includes("already been registered")
  ) {
    return "Ya existe una cuenta con este email. Inicia sesión o usa Recuperar contraseña.";
  }

  if (
    code.includes("rate_limit") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many requests")
  ) {
    return "Has hecho demasiados intentos seguidos. Espera un momento y vuelve a probar.";
  }

  if (message && !/^error sending/i.test(message)) {
    return message;
  }

  if (context === "login") {
    return "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.";
  }

  if (context === "forgot") {
    return "No se pudo enviar el enlace. Inténtalo de nuevo.";
  }

  return "No se pudo crear la cuenta. Inténtalo de nuevo.";
}
