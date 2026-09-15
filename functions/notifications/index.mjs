import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const ses = new SESv2Client({});

export function createHandler({ sendEmail } = {}) {
  const send = sendEmail ?? ((input) => ses.send(new SendEmailCommand(input)));
  return async (event) => {
    const failures = [];
    for (const record of event.Records ?? []) {
      try {
        const message = JSON.parse(record.body);
        if (!message.customerEmail || !message.orderNumber || !message.status) {
          throw new Error("Evento sem customerEmail, orderNumber ou status.");
        }
        await send({
          FromEmailAddress: process.env.FROM_EMAIL,
          Destination: { ToAddresses: [message.customerEmail] },
          Content: {
            Simple: {
              Subject: { Data: `Atualização da OS ${message.orderNumber}`, Charset: "UTF-8" },
              Body: { Text: { Data: `Sua ordem de serviço está com o status ${message.status}.`, Charset: "UTF-8" } }
            }
          }
        });
        console.info(JSON.stringify({ level: "info", event: "notification_sent", orderId: message.orderId, correlationId: message.correlationId }));
      } catch (error) {
        console.error(JSON.stringify({ level: "error", event: "notification_failed", message: error.message, messageId: record.messageId }));
        failures.push({ itemIdentifier: record.messageId });
      }
    }
    return { batchItemFailures: failures };
  };
}

export const handler = createHandler();

