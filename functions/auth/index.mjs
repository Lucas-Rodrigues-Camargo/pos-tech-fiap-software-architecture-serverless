import jwt from "jsonwebtoken";

export function normalizeCpf(value = "") {
  return String(value).replace(/\D/g, "");
}

export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (size) => {
    let total = 0;
    for (let index = 0; index < size; index += 1) total += Number(cpf[index]) * (size + 1 - index);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function createHandler({ queryCustomer, signToken } = {}) {
  const findCustomer = queryCustomer ?? (async (cpf, correlationId) => {
    if (!process.env.CUSTOMER_API_URL || !process.env.INTERNAL_API_KEY) throw new Error("OS API configuration required");
    const result = await fetch(process.env.CUSTOMER_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY, "X-Correlation-ID": correlationId },
      body: JSON.stringify({ cpf }),
      signal: AbortSignal.timeout(5000)
    });
    if (result.status === 404) return null;
    if (!result.ok) throw new Error("OS service unavailable");
    return result.json();
  });

  const sign = signToken ?? ((claims) => jwt.sign(claims, process.env.JWT_KEY, {
    algorithm: "HS256",
    issuer: process.env.JWT_ISSUER ?? "OficinaMecanica",
    audience: process.env.JWT_AUDIENCE ?? "OficinaMecanica.Customer",
    expiresIn: "1h"
  }));

  return async (event) => {
    try {
      const payload = typeof event?.body === "string" ? JSON.parse(event.body) : (event?.body ?? event ?? {});
      const cpf = normalizeCpf(payload.cpf);
      if (!isValidCpf(cpf)) return response(400, { error: "CPF inválido." });
      if (!process.env.JWT_KEY && !signToken) return response(500, { error: "Configuração de autenticação indisponível." });

      const customer = await findCustomer(cpf, event?.requestContext?.requestId ?? crypto.randomUUID());
      if (!customer || customer.is_active !== true) return response(401, { error: "Cliente inexistente ou inativo." });

      const expiresInSeconds = 3600;
      const token = sign({
        sub: String(customer.id),
        name: customer.name,
        cpf: customer.document,
        role: "Customer"
      });

      return response(200, { token, tokenType: "Bearer", expiresIn: expiresInSeconds });
    } catch (error) {
      console.error(JSON.stringify({ level: "error", event: "customer_auth_failed", message: error.message }));
      return response(500, { error: "Não foi possível autenticar o cliente." });
    }
  };
}

export const handler = createHandler();

