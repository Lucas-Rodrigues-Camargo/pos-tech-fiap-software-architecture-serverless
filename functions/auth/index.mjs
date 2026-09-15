import jwt from "jsonwebtoken";
import pg from "pg";

const { Pool } = pg;
let pool;

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

function database() {
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 5000
  });
  return pool;
}

export function createHandler({ queryCustomer, signToken } = {}) {
  const findCustomer = queryCustomer ?? (async (cpf) => {
    const result = await database().query(
      "select id, name, document, is_active from tb_customers where document = $1 limit 1",
      [cpf]
    );
    return result.rows[0];
  });

  const sign = signToken ?? ((claims) => jwt.sign(claims, process.env.JWT_KEY, {
    algorithm: "HS256",
    issuer: process.env.JWT_ISSUER ?? "OficinaMecanica",
    audience: process.env.JWT_AUDIENCE ?? "OficinaMecanica.Customer",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1h"
  }));

  return async (event) => {
    try {
      const payload = typeof event?.body === "string" ? JSON.parse(event.body) : (event?.body ?? event ?? {});
      const cpf = normalizeCpf(payload.cpf);
      if (!isValidCpf(cpf)) return response(400, { error: "CPF inválido." });
      if (!process.env.JWT_KEY && !signToken) return response(500, { error: "Configuração de autenticação indisponível." });

      const customer = await findCustomer(cpf);
      if (!customer || customer.is_active === false) return response(401, { error: "Cliente inexistente ou inativo." });

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

