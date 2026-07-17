import { Resend } from "resend";

export async function sendProposalEmail(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY nije pronađen u .env.local. Dodajte ključ iz Resend dashboard-a."
    );
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  if (error) {
    throw new Error(error.message || "Resend nije uspeo da pošalje mejl.");
  }

  return data;
}
