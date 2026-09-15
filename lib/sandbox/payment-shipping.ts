export type PaymentShippingSandboxScenario =
  | "stripe_connect_onboarding"
  | "protected_payment_hold"
  | "protected_payment_release"
  | "protected_payment_refund"
  | "correos_label_quote"
  | "shipping_aggregator_quote";

export type PaymentShippingSandboxPlan = {
  enabled: boolean;
  provider: "stripe_connect" | "correos" | "shipping_aggregator";
  scenario: PaymentShippingSandboxScenario;
  mode: "sandbox" | "test";
  nextSteps: string[];
  requiredEnv: string[];
  userVisible: false;
};

const STRIPE_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "ENABLE_PAYMENT_SANDBOX",
];

const SHIPPING_ENV = [
  "SHIPPING_SANDBOX_PROVIDER",
  "CORREOS_SANDBOX_CLIENT_ID",
  "CORREOS_SANDBOX_CLIENT_SECRET",
  "ENABLE_SHIPPING_SANDBOX",
];

export function buildSandboxPlan(scenario: PaymentShippingSandboxScenario): PaymentShippingSandboxPlan {
  const isStripe = scenario.startsWith("stripe") || scenario.startsWith("protected_payment");

  return {
    enabled: false,
    provider: isStripe ? "stripe_connect" : scenario.startsWith("correos") ? "correos" : "shipping_aggregator",
    scenario,
    mode: "sandbox",
    userVisible: false,
    requiredEnv: isStripe ? STRIPE_ENV : SHIPPING_ENV,
    nextSteps: isStripe
      ? [
          "Confirmar modelo Stripe Connect: Express accounts o cuenta equivalente.",
          "Probar PaymentIntent en modo test sin botón público.",
          "Definir política de cancelación, reembolso, disputa y liberación de fondos.",
          "No activar checkout hasta tener soporte operativo y condiciones legales revisadas.",
        ]
      : [
          "Comparar Correos directo frente a agregadores como Sendcloud, Packlink u Outvio.",
          "Validar si hay sandbox real, tarifas, etiquetas, tracking e incidencias.",
          "No pedir peso/dimensiones a usuarios hasta decidir integración logística.",
          "No activar envío integrado hasta medir demanda real.",
        ],
  };
}
